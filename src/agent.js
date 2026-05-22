import { config } from "./config.js";
import {
  formatScheduledInZone,
  formatTimezoneLabel,
  nextDailyAt as nextDailyAtInZone,
  parseReminderSchedule,
  parseTimezoneFromText
} from "./timezone.js";

const habits = [
  { id: "medicacao", label: "medicação" },
  { id: "ginasio", label: "ginásio" },
  { id: "boys", label: "Boys" },
  { id: "tuxa", label: "Ligar à Tuxa" },
  { id: "outros", label: "Outros" }
];

const welcomeMessages = [
  "Hey cutie! Sim, ambos sabemos que a tua namorada é chata, tanta mensagem para te lembrares disto ou daquilo, mas ela só se preocupa.",
  "Agora sou eu a chata, o meu nome é Joana e comigo podes chatear-te que não quero muito saber ❤️"
];

const twoHoursMs = 2 * 60 * 60 * 1000;
const pendingTimeReplyMs = Number(process.env.PENDING_TIME_REPLY_MS || 15 * 60 * 1000);
const defaultName = "Pedro";
const thirdReminderName = "Pedro Emanuel";

const fallbackReplies = [
  `${defaultName}, manda "lembra-me de..." e eu trato.`,
  `Manda lá, ${defaultName}. Estou de serviço.`,
  `${defaultName}, isso passou-me. Tenta "lembra-me de...".`,
  `${defaultName}, escreve-me bonito: "lembra-me de..." e eu porto-me bem.`
];

const unclearChoiceReplies = [
  `${defaultName}, não apanhei. Manda números ou nomes.`,
  `Isso veio enigmático, ${defaultName}. Tipo: 1, 2, 4.`,
  `${defaultName}, traduz para Joana: 1, 2, 3, 4 ou 5.`
];

const invalidTimeReplies = [
  `${defaultName}, dá-me uma hora tipo 08:00.`,
  `Preciso de uma hora, ${defaultName}. Tipo 18h ou 21:30.`,
  `${defaultName}, sem hora não há milagre.`
];

const missingTimeReplies = [
  `${defaultName}, com ou sem horário definido?`,
  `Responde só: com horário ou sem horário, bonito.`,
  `${defaultName}, preciso dessa parte: com ou sem horário?`
];

const repeatConfirmations = [
  `Feito, ${defaultName}. Vou insistir sobre {text}.`,
  `Combinado. Modo chata ativado para {text}.`,
  `Ok, ${defaultName}. Vou lembrar-te de {text} de 2 em 2 horas.`,
  `Fechado, bonito. {text} fica por minha conta.`
];

const onceConfirmations = [
  `Feito, ${defaultName}. Vou lembrar-te de {text}.`,
  `Guardado, ${defaultName}: {text}.`,
  `Apontado. {text} fica comigo.`,
  `Sim senhor, bonito. {text} está guardado.`
];

const HELP_TEXT = [
  `📌 Joana — regras rápidas`,
  ``,
  `• Primeira vez: segue o onboarding (hábitos → fuso → horários). Só uma vez.`,
  `• Lembretes: "lembra-me de comprar pão" ou "lembra-me de X às 18h"`,
  `• Daqui a pouco: "lembra-me em 2 minutos de X" ou "lembra-me de X em 5 minutos"`,
  `• Com hora: responde "18h" / "18:30" ou põe a hora na mesma frase`,
  `• Sem hora fixa: "sem horário" → avisos de 2 em 2 h (até 4)`,
  `• Fuso (tua hora): "sim" = Lisboa · "fuso Açores" · "fuso Europe/London"`,
  `• Ajuda: escreve "ajuda" ou "regras"`,
  ``,
  `Não precisas de repetir o olá todos os dias.`
].join("\n");

export class JoanaAgent {
  constructor(store, messenger) {
    this.store = store;
    this.messenger = messenger;
  }

  /**
   * Inicia onboarding por WhatsApp a partir da página web (sem simular uma mensagem do utilizador).
   * @returns {"started" | "in_progress" | "done"}
   */
  async startSignupWhatsApp(phone) {
    const contact = this.store.getContact(phone);
    if (contact.onboardingStep === "done") return "done";
    if (contact.onboardingStep !== "new") return "in_progress";

    await this.sendWelcome(phone);
    this.store.updateContact(phone, { onboardingStep: "choose_habits" });
    await this.askHabitQuestion(phone);
    return "started";
  }

  contactTimezone(phone) {
    const contact = this.store.getContact(phone);
    return contact.timezone || config.defaultTimezone;
  }

  async receive(phone, text) {
    const contact = this.store.getContact(phone);
    const cleanText = normalize(text);

    if (contact.onboardingStep === "confirm_timezone") {
      await this.handleTimezoneConfirmation(phone, text);
      return;
    }

    if (/^(ajuda|help|regras|comandos|menu|instrucoes|instruções)$/i.test(cleanText.trim())) {
      await this.messenger.sendText(phone, HELP_TEXT);
      return;
    }

    const explicitTz = parseTimezoneFromText(text);
    if (explicitTz && /\b(fuso|timezone|tz|horario|horário)\b/i.test(text)) {
      this.store.updateContact(phone, { timezone: explicitTz });
      await this.messenger.sendText(
        phone,
        `Fuso atualizado: ${formatTimezoneLabel(explicitTz)}. Os lembretes usam a tua hora local.`
      );
      return;
    }

    if (contact.onboardingStep === "new") {
      await this.sendWelcome(phone);
      this.store.updateContact(phone, { onboardingStep: "choose_habits" });
      await this.askHabitQuestion(phone);
      return;
    }

    if (contact.onboardingStep === "choose_habits") {
      await this.handleHabitSelection(phone, cleanText);
      return;
    }

    if (contact.onboardingStep === "set_habit_times") {
      await this.handleHabitTime(phone, text);
      return;
    }

    if (contact.pendingReminder) {
      await this.handlePendingReminderTime(phone, text);
      return;
    }

    if (contact.onboardingStep === "done" && !contact.timezone) {
      this.store.updateContact(phone, { onboardingStep: "confirm_timezone" });
      await this.askTimezone(phone);
      return;
    }

    const reminderText = extractReminderText(text);
    if (reminderText) {
      const tz = this.contactTimezone(phone);
      const at = parseReminderSchedule(text, tz);
      if (at) {
        const label = stripScheduleFromReminderText(reminderText, text) || reminderText;
        this.store.addReminder({
          phone,
          kind: "once",
          text: label,
          nextAt: at.toISOString(),
          maxSends: 1
        });
        console.log(
          `[Joana] Lembrete agendado (once) ${label} → ${at.toISOString()} (${tz})`
        );
        await this.sendOnceConfirmation(phone, label, at, tz);
        return;
      }

      this.store.updateContact(phone, {
        pendingReminder: {
          text: reminderText,
          step: "time_choice",
          askedAt: new Date().toISOString()
        }
      });
      await this.sendVariant(phone, "reminder_time_question", reminderTimeQuestions(), reminderText, reminderText);
      return;
    }

    await this.sendVariant(phone, "fallback", fallbackReplies, text);
  }

  async tick() {
    await this.expirePendingReminderQuestions();
    const due = this.store.dueReminders();
    for (const reminder of due) {
      console.log(`[Joana] Lembrete a enviar (${reminder.kind}) → ${reminder.phone}: ${reminder.text}`);
      await this.messenger.sendText(reminder.phone, reminderNudge(reminder));

      if (reminder.kind === "daily") {
        const tz = this.contactTimezone(reminder.phone);
        this.store.updateReminder(reminder.id, {
          nextAt: nextDailyAtInZone(reminder.time, tz).toISOString(),
          sentCount: reminder.sentCount + 1
        });
        continue;
      }

      const sentCount = reminder.sentCount + 1;
      if (sentCount >= reminder.maxSends) {
        this.store.updateReminder(reminder.id, {
          active: false,
          sentCount
        });
      } else {
        this.store.updateReminder(reminder.id, {
          sentCount,
          nextAt: new Date(Date.now() + twoHoursMs).toISOString()
        });
      }
    }
  }

  async sendWelcome(phone) {
    for (const message of welcomeMessages) {
      await this.messenger.sendText(phone, message);
    }
  }

  async askHabitQuestion(phone) {
    await this.messenger.sendText(phone, [
      `Então vamos lá, ${defaultName}. O que precisas de te lembrar todos os dias?`,
      "Podes escolher mais do que uma opção, que eu hoje estou generosa. Responde com números ou nomes, separados por vírgulas:",
      "1. medicação",
      "2. ginásio",
      "3. Boys",
      "4. Ligar à Tuxa",
      "5. Outros"
    ].join("\n"));
  }

  async handleHabitSelection(phone, cleanText) {
    const selected = parseHabitSelection(cleanText);
    if (selected.length === 0) {
      await this.sendVariant(phone, "unclear_choice", unclearChoiceReplies, cleanText);
      return;
    }

    this.store.updateContact(phone, {
      selectedHabits: selected,
      pendingHabitIndex: 0,
      onboardingStep: "confirm_timezone"
    });

    await this.askTimezone(phone);
  }

  async askTimezone(phone) {
    await this.messenger.sendText(
      phone,
      [
        `Antes dos horários, ${defaultName}: os lembretes usam a **tua** hora (a do teu Telegram/telemóvel).`,
        "Estás em Portugal continental (Lisboa)? Responde **sim**.",
        "Ou diz o fuso: **Açores**, **Madeira**, **fuso Europe/London**, etc."
      ].join("\n")
    );
  }

  async handleTimezoneConfirmation(phone, text) {
    const zone = parseTimezoneFromText(text);
    if (!zone) {
      await this.messenger.sendText(
        phone,
        "Não percebi o fuso. Responde **sim** (Lisboa) ou, por exemplo, **Açores** / **fuso Europe/Lisbon**."
      );
      return;
    }

    this.store.updateContact(phone, { timezone: zone });
    const contact = this.store.getContact(phone);

    if (contact.selectedHabits?.length && contact.onboardingStep === "confirm_timezone") {
      this.store.updateContact(phone, { onboardingStep: "set_habit_times" });
      await this.messenger.sendText(
        phone,
        `Perfeito — hora de ${formatTimezoneLabel(zone)}. Agora os horários dos hábitos.`
      );
      await this.askNextHabitTime(phone);
      return;
    }

    this.store.updateContact(phone, { onboardingStep: "done" });
    await this.messenger.sendText(
      phone,
      `Feito. Lembretes na hora de ${formatTimezoneLabel(zone)}. Manda "lembra-me de...".`
    );
  }

  async askNextHabitTime(phone) {
    const contact = this.store.getContact(phone);
    const habit = habits.find((item) => item.id === contact.selectedHabits[contact.pendingHabitIndex]);
    if (!habit) {
      this.store.updateContact(phone, {
        onboardingStep: "done",
        selectedHabits: [],
        pendingHabitIndex: 0
      });
      await this.sendVariant(phone, "setup_done", setupDoneMessages(), contact.phone);
      return;
    }

    await this.messenger.sendText(phone, habitTimeQuestion(habit.label, contact.pendingHabitIndex));
  }

  async handleHabitTime(phone, text) {
    const contact = this.store.getContact(phone);
    const habitId = contact.selectedHabits[contact.pendingHabitIndex];
    const habit = habits.find((item) => item.id === habitId);
    const times = parseTimes(text);

    if (times.length === 0) {
      await this.sendVariant(phone, "invalid_time", invalidTimeReplies, text);
      return;
    }

    const tz = this.contactTimezone(phone);
    for (const time of times) {
      this.store.addReminder({
        phone,
        kind: "daily",
        text: habit.label,
        time,
        nextAt: nextDailyAtInZone(time, tz).toISOString()
      });
    }

    this.store.updateContact(phone, {
      pendingHabitIndex: contact.pendingHabitIndex + 1
    });

    await this.askNextHabitTime(phone);
  }

  async handlePendingReminderTime(phone, text) {
    const contact = this.store.getContact(phone);
    const reminderText = contact.pendingReminder.text;
    const tz = this.contactTimezone(phone);
    const specificDate = parseReminderSchedule(text, tz);

    if (specificDate) {
      this.store.addReminder({
        phone,
        kind: "once",
        text: reminderText,
        nextAt: specificDate.toISOString(),
        maxSends: 1
      });
      console.log(
        `[Joana] Lembrete agendado (once) ${reminderText} → ${specificDate.toISOString()} (${tz})`
      );
      this.store.updateContact(phone, { pendingReminder: null });
      await this.sendOnceConfirmation(phone, reminderText, specificDate, tz);
      return;
    }

    if (isSpecificTimeIntent(text)) {
      this.store.updateContact(phone, {
        pendingReminder: {
          text: reminderText,
          step: "specific_time"
        }
      });
      await this.sendVariant(phone, "missing_time", missingTimeReplies, text);
      return;
    }

    if (isNoSpecificTime(text)) {
      this.store.addReminder({
        phone,
        kind: "repeat",
        text: reminderText,
        nextAt: new Date(Date.now() + twoHoursMs).toISOString(),
        maxSends: 4
      });
      this.store.updateContact(phone, { pendingReminder: null });
      await this.sendVariant(phone, "repeat_confirmation", repeatConfirmations, reminderText, reminderText);
      return;
    }

    await this.sendVariant(phone, "missing_time", missingTimeReplies, text);
  }

  async expirePendingReminderQuestions() {
    const now = Date.now();
    for (const contact of Object.values(this.store.state.contacts)) {
      const pending = contact.pendingReminder;
      if (!pending || pending.step !== "time_choice" || !pending.askedAt) continue;
      if (now - new Date(pending.askedAt).getTime() < pendingTimeReplyMs) continue;

      this.store.addReminder({
        phone: contact.phone,
        kind: "repeat",
        text: pending.text,
        nextAt: new Date(Date.now() + twoHoursMs).toISOString(),
        maxSends: 4
      });
      this.store.updateContact(contact.phone, { pendingReminder: null });
      await this.sendVariant(contact.phone, "repeat_confirmation", repeatConfirmations, pending.text, pending.text);
    }
  }

  async sendOnceConfirmation(phone, label, at, timeZone) {
    const when = formatScheduledInZone(at, timeZone);
    await this.messenger.sendText(
      phone,
      `Feito, ${defaultName}. Às ${when} (tua hora) lembro-te: ${label}.`
    );
  }

  async sendVariant(phone, group, options, seed = "", fillText = null) {
    const contact = this.store.getContact(phone);
    const responseVariants = { ...(contact.responseVariants || {}) };
    let index = pickIndex(options, seed);

    if (options.length > 1 && responseVariants[group] === index) {
      index = (index + 1) % options.length;
    }

    responseVariants[group] = index;
    this.store.updateContact(phone, { responseVariants });
    const message = fillText === null ? options[index] : fill(options[index], fillText);
    await this.messenger.sendText(phone, message);
  }
}

function reminderNudge(reminder) {
  const name = reminder.kind === "repeat" && reminder.sentCount === 2 ? thirdReminderName : defaultName;
  const repeatNudges = [
    `${name}, não te esqueças de {text}.`,
    `${name}, segunda chamada para {text}.`,
    `${name}, agora é sério: {text}.`,
    `${name}, último toque para {text}.`
  ];
  const dailyNudges = [
    `${name}, lembra-te de {text}.`,
    `${name}, está na hora de {text}.`,
    `${name}, chamada rápida: {text}.`,
    `${name}, vá, charme depois. Agora: {text}.`
  ];
  const nudges = reminder.kind === "repeat" ? repeatNudges : dailyNudges;
  return fill(nudges[reminder.sentCount % nudges.length], reminder.text);
}

function reminderTimeQuestions(text) {
  return [
    `Claro, ${defaultName}. Com ou sem horário definido?`,
    `${defaultName}, para "{text}": com ou sem horário definido?`,
    `"{text}" é com ou sem horário definido?`
  ];
}

function habitTimeQuestion(label, index) {
  const variants = [
    `${defaultName}, a que horas para {text}?`,
    `Boa. E para {text}, qual é o horário, ${defaultName}?`,
    `${defaultName}, dá-me o horário de {text}.`
  ];
  return fill(variants[index % variants.length], label);
}

function setupDoneMessages() {
  return [
    `tá feito, ${defaultName}. Agora manda "lembra-me de x".`,
    `Pronto, ${defaultName}. Agenda montada.`,
    `Fechámos, ${defaultName}. Já estou ao serviço.`
  ];
}

function pick(options, seed = "") {
  return options[pickIndex(options, seed)];
}

function pickIndex(options, seed = "") {
  const text = String(seed || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash % options.length;
}

function fill(template, text) {
  return template.replaceAll("{text}", text);
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function parseHabitSelection(text) {
  const selected = new Set();
  const parts = text.split(/[,\n;]+/).map((part) => part.trim()).filter(Boolean);
  const allText = parts.length ? parts : [text];

  for (const part of allText) {
    if (/\b1\b/.test(part) || part.includes("medic")) selected.add("medicacao");
    if (/\b2\b/.test(part) || part.includes("ginas")) selected.add("ginasio");
    if (/\b3\b/.test(part) || part.includes("boy")) selected.add("boys");
    if (/\b4\b/.test(part) || part.includes("tuxa") || part.includes("ligar")) selected.add("tuxa");
    if (/\b5\b/.test(part) || part.includes("outro")) selected.add("outros");
  }

  return [...selected];
}

function parseTimes(text) {
  const matches = [
    ...text.matchAll(/(?:\b(?:as|às|a)\s*)?([01]?\d|2[0-3])(?:(?:[:hH])([0-5]\d)?|h)?\b/gi)
  ];
  return [...new Set(matches.map((match) => `${match[1].padStart(2, "0")}:${match[2] || "00"}`))];
}

function stripTimeFromReminderText(text) {
  return text
    .replace(/(?:^|\s)(?:as|às|a)\s*\d{1,2}(?:(?:[:hH][0-5]?\d?)|h)\b/gi, "")
    .replace(/(?:^|\s)(?:as|às|a)\s*\d{1,2}:\d{2}\b/gi, "")
    .replace(/\b(?:amanha|amanhã)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripScheduleFromReminderText(reminderText, fullText) {
  let label = reminderText;
  label = label.replace(
    /^(?:em|daqui a|daqui|dentro de)\s+[\w\d]+\s*(?:minutos?|min|m|horas?|h)\s+(?:de|d)\s+/i,
    ""
  );
  label = label.replace(
    /\s+(?:em|daqui a|daqui|dentro de)\s+[\w\d]+\s*(?:minutos?|min|m|horas?|h)\b/gi,
    ""
  );
  return stripTimeFromReminderText(label).trim();
}

function extractReminderText(text) {
  const cleaned = text.trim();

  const relativeWithDe = cleaned.match(
    /(?:lembra|lembre|lebra|leba|lemba|lemb|recorda|relembra|avisa)\s*-?\s*me\s+(?:em|daqui a|daqui|dentro de)\s+[\w\d]+\s*(?:minutos?|min|m|horas?|h)\s+(?:de|d)\s+(.+)/i
  );
  if (relativeWithDe?.[1]) return cleanReminderText(relativeWithDe[1]);

  const deWithRelative = cleaned.match(
    /(?:lembra|lembre|lebra|leba|lemba|lemb|recorda|relembra|avisa)\s*-?\s*me\s+(?:de|d)\s+(.+?)\s+(?:em|daqui a|daqui|dentro de)\s+[\w\d]+\s*(?:minutos?|min|m|horas?|h)\b/i
  );
  if (deWithRelative?.[1]) return cleanReminderText(deWithRelative[1]);

  const directPatterns = [
    /(?:lembra|lembre|lebra|leba|lemba|lemb)\s*-?\s*me\s+(?:de\s+|d\s+)?(.+)/i,
    /(?:lembra|lembre|lebra|leba|lemba|lemb)\s+(?:de\s+|d\s+)?(.+)/i,
    /(?:nao|não|n)\s+(?:me\s+)?(?:deixes|deixa|dexes|dexa)\s+(?:esquecer|eskecer)\s+(?:de\s+|d\s+)?(.+)/i,
    /(?:nao|não|n)\s+(?:te\s+)?(?:esquecas|esqueças|eskecas|eskças)\s+(?:de\s+|d\s+)?(.+)/i,
    /(?:recorda|relembra|avisa)\s*-?\s*me\s+(?:de\s+|d\s+)?(.+)/i
  ];

  for (const pattern of directPatterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return cleanReminderText(match[1]);
  }

  const normalized = normalize(cleaned);
  const patterns = [
    /(?:lembra|lembre|lebra|leba|lemba|lemb)\s*-?\s*me\s+(?:de\s+|d\s+)?(.+)/i,
    /(?:lembra|lembre|lebra|leba|lemba|lemb)\s+(?:de\s+|d\s+)?(.+)/i,
    /(?:nao|n|não)\s+(?:me\s+)?(?:deixes|deixa|dexes|dexa)\s+(?:esquecer|eskecer)\s+(?:de\s+|d\s+)?(.+)/i,
    /(?:nao|n|não)\s+(?:te\s+)?(?:esquecas|esqueças|eskecas|eskças)\s+(?:de\s+|d\s+)?(.+)/i,
    /(?:recorda|relembra|avisa)\s*-?\s*me\s+(?:de\s+|d\s+)?(.+)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return cleanReminderText(match[1]);
  }

  const fuzzyMatch = fuzzyReminderText(normalized);
  return fuzzyMatch ? cleanReminderText(fuzzyMatch) : null;
}

function fuzzyReminderText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const triggerIndex = words.findIndex((word) => editDistance(word, "lembra") <= 2 || editDistance(word, "lembre") <= 2);
  if (triggerIndex === -1) return null;

  let start = triggerIndex + 1;
  if (["me", "m"].includes(words[start])) start += 1;
  if (["de", "d"].includes(words[start])) start += 1;

  return words.slice(start).join(" ");
}

function cleanReminderText(text) {
  const cleaned = text
    .trim()
    .replace(/^(de|d)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  return correctReminderText(cleaned);
}

function correctReminderText(text) {
  const normalized = normalize(text).replace(/\s+/g, " ").trim();
  const exactCorrections = new Map([
    ["comprar pao", "comprar pão"],
    ["beber agua", "beber água"],
    ["tomar medicacao", "tomar medicação"],
    ["medicacao", "medicação"],
    ["ginasio", "ginásio"],
    ["ligar a tuxa", "ligar à Tuxa"],
    ["ligar para a tuxa", "ligar à Tuxa"],
    ["chamar a tuxa", "ligar à Tuxa"]
  ]);

  if (exactCorrections.has(normalized)) return exactCorrections.get(normalized);

  return text
    .replace(/\bpao\b/gi, "pão")
    .replace(/\bagua\b/gi, "água")
    .replace(/\bmedicacao\b/gi, "medicação")
    .replace(/\bginasio\b/gi, "ginásio")
    .replace(/\bligar a tuxa\b/gi, "ligar à Tuxa")
    .replace(/\btuxa\b/gi, "Tuxa");
}

function editDistance(a, b) {
  const costs = Array.from({ length: a.length + 1 }, (_, index) => index);
  for (let j = 1; j <= b.length; j += 1) {
    let previous = costs[0];
    costs[0] = j;
    for (let i = 1; i <= a.length; i += 1) {
      const current = costs[i];
      costs[i] = a[i - 1] === b[j - 1]
        ? previous
        : Math.min(previous, costs[i - 1], costs[i]) + 1;
      previous = current;
    }
  }
  return costs[a.length];
}

function isNoSpecificTime(text) {
  const n = normalize(text);
  return /sem horario|sem hora|\bsem\b|nao|não|tanto faz|quando der/.test(n);
}

function isSpecificTimeIntent(text) {
  return /\bcom horario\b|\bcom hora\b|\bhorario definido\b|\bhora definida\b|\bhora marcada\b|^com$/i.test(normalize(text));
}


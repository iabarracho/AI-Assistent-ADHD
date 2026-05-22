import { DateTime } from "luxon";

export const DEFAULT_TIMEZONE = process.env.JOANA_DEFAULT_TIMEZONE || "Europe/Lisbon";

const ALIASES = new Map([
  ["portugal", "Europe/Lisbon"],
  ["lisboa", "Europe/Lisbon"],
  ["lisbon", "Europe/Lisbon"],
  ["continental", "Europe/Lisbon"],
  ["acores", "Atlantic/Azores"],
  ["azores", "Atlantic/Azores"],
  ["madeira", "Atlantic/Madeira"],
  ["london", "Europe/London"],
  ["madrid", "Europe/Madrid"],
  ["paris", "Europe/Paris"]
]);

export function isValidTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Interpreta resposta do utilizador (Telegram não envia fuso — guardamos por contacto).
 * @returns {string|null} IANA, ex. Europe/Lisbon
 */
export function parseTimezoneFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (/^(sim|yes|ok|s|y|portugal|pt)$/.test(normalized)) {
    return DEFAULT_TIMEZONE;
  }

  const explicit = raw.match(/(?:fuso|timezone|tz|horario|horário)\s*[:\-]?\s*([A-Za-z0-9_/+-]+)/i);
  if (explicit) {
    const candidate = explicit[1].trim();
    if (isValidTimeZone(candidate)) return candidate;
    const alias = ALIASES.get(candidate.toLowerCase());
    if (alias) return alias;
  }

  for (const [key, zone] of ALIASES) {
    if (normalized.includes(key)) return zone;
  }

  if (isValidTimeZone(raw)) return raw;

  for (const token of raw.split(/\s+/)) {
    if (isValidTimeZone(token)) return token;
  }

  return null;
}

/** Próxima ocorrência de HH:MM no fuso do utilizador. */
export function scheduleAtLocalTime(timeZone, time, text) {
  const [hours, minutes] = time.split(":").map(Number);
  let dt = DateTime.now().setZone(timeZone).set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0
  });

  if (/amanha|amanhã/i.test(text)) {
    dt = dt.plus({ days: 1 });
  } else if (dt <= DateTime.now().setZone(timeZone)) {
    dt = dt.plus({ days: 1 });
  }

  return dt.toUTC().toJSDate();
}

export function nextDailyAt(time, timeZone) {
  return scheduleAtLocalTime(timeZone, time, "");
}

/**
 * "em 2 minutos", "daqui a 1 hora", "dentro de 30 min"
 * @returns {Date|null}
 */
const WORD_NUMBERS = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  quinze: 15,
  vinte: 20,
  trinta: 30,
  meia: 30
};

function parseDelayAmount(raw) {
  if (raw == null || raw === "") return null;
  const digits = Number(raw);
  if (Number.isFinite(digits) && digits > 0) return digits;
  return WORD_NUMBERS[String(raw).toLowerCase()] ?? null;
}

export function textLooksRelativeDelay(text) {
  const n = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return /(?:daqui|dentro de|em\s+\d|em\s+(?:um|uma|dois|duas|tres|três|\d+))\s*(?:min|hora)|\d+\s*minutos?|\b(?:um|uma|dois|duas)\s*minuto/.test(
    n
  );
}

export function parseRelativeDelay(text, timeZone) {
  const n = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const minutePatterns = [
    /(?:em|daqui a|daqui|dentro de)\s+(\d{1,3}|[a-z]+)\s*(?:minutos?|min|m)\b/,
    /\b(\d{1,3}|[a-z]+)\s*(?:minutos?|min|m)\b/
  ];
  for (const pattern of minutePatterns) {
    const match = n.match(pattern);
    if (match) {
      const minutes = parseDelayAmount(match[1]);
      if (minutes > 0 && minutes <= 24 * 60) {
        return DateTime.now().setZone(timeZone).plus({ minutes }).toUTC().toJSDate();
      }
    }
  }

  const hourPatterns = [
    /(?:em|daqui a|daqui|dentro de)\s+(\d{1,3}|[a-z]+)\s*(?:horas?|h)\b/,
    /\b(\d{1,3}|[a-z]+)\s*(?:horas?|h)\b/
  ];
  for (const pattern of hourPatterns) {
    const match = n.match(pattern);
    if (match) {
      const hours = parseDelayAmount(match[1]);
      if (hours > 0 && hours <= 168) {
        return DateTime.now().setZone(timeZone).plus({ hours }).toUTC().toJSDate();
      }
    }
  }

  return null;
}

/** Hora fixa (18h) ou daqui a X minutos/horas. */
export function parseReminderSchedule(text, timeZone) {
  return parseRelativeDelay(text, timeZone) || scheduleAtLocalTimeFromText(text, timeZone);
}

function scheduleAtLocalTimeFromText(text, timeZone) {
  if (textLooksRelativeDelay(text)) return null;
  const time = parseClockTime(text);
  if (!time) return null;
  const n = String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (/\bsem horario\b|\bsem hora\b/.test(n)) return null;
  return scheduleAtLocalTime(timeZone, time, text);
}

/** HH:MM a partir do texto (18h, às 18:30) — ignora "2 minutos". */
export function parseClockTime(text) {
  if (textLooksRelativeDelay(text)) return null;

  const matches = [
    ...String(text || "").matchAll(
      /(?:\b(?:as|às)\s*)?([01]?\d|2[0-3])(?:(?:[:hH])([0-5]\d)?|h)\b/gi
    )
  ];
  if (!matches.length) return null;
  const match = matches[0];
  return `${match[1].padStart(2, "0")}:${match[2] || "00"}`;
}

/** Hora local legível para confirmar ao utilizador. */
export function formatScheduledInZone(date, timeZone) {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(timeZone).toFormat("HH:mm");
}

export function formatTimezoneLabel(timeZone) {
  try {
    const label = new Intl.DateTimeFormat("pt-PT", {
      timeZone,
      timeZoneName: "long"
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return label || timeZone;
  } catch {
    return timeZone;
  }
}

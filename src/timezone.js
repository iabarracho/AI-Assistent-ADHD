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

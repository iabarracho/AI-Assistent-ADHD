import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

export const config = {
  rootDir,
  /** Pasta com `store.json`; na cloud usa disco persistente ou BD. */
  dataDir: process.env.JOANA_DATA_DIR
    ? path.resolve(process.env.JOANA_DATA_DIR)
    : path.join(rootDir, "data"),
  port: Number(process.env.PORT || 3000),
  /** Fuso por defeito até o utilizador confirmar o dele (Telegram não envia fuso). */
  defaultTimezone: process.env.JOANA_DEFAULT_TIMEZONE || "Europe/Lisbon",
  /** whatsapp (API Meta) | baileys (WhatsApp Web, não oficial) | telegram | web */
  messenger: process.env.JOANA_MESSENGER || "whatsapp",
  provider: process.env.WHATSAPP_PROVIDER || "cloud",
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    /** Opcional: @username do bot (senão obtém-se via getMe ao arrancar) */
    botUsername: process.env.TELEGRAM_BOT_USERNAME
  },
  cloud: {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "joana-local-dev",
    appSecret: process.env.WHATSAPP_APP_SECRET
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM
  },
  transcription: {
    openAiApiKey: process.env.OPENAI_API_KEY
  }
};

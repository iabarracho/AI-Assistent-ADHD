import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import QRCode from "qrcode";
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import { config } from "./config.js";

let socket = null;
let latestQr = null;
let connectionState = "starting";

function authDir() {
  const dir = path.join(config.dataDir, "baileys-auth");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function toJid(phone) {
  const digits = String(phone).replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

function fromJid(jid) {
  return String(jid || "").replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");
}

function extractText(message) {
  if (!message) return "";
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    ""
  ).trim();
}

/**
 * WhatsApp Web (não oficial). Risco de banimento pela Meta.
 * @param {{ onText: (phone: string, text: string) => Promise<void>, sendText: (phone: string, text: string) => Promise<void> }} handlers
 */
export async function startBaileys(handlers) {
  const { state, saveCreds } = await useMultiFileAuthState(authDir());

  const connect = async () => {
    connectionState = "connecting";
    socket = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        latestQr = qr;
        connectionState = "qr";
      }
      if (connection === "open") {
        latestQr = null;
        connectionState = "open";
        console.log("[Joana] Baileys ligado ao WhatsApp");
      }
      if (connection === "close") {
        connectionState = "closed";
        const status = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = status !== DisconnectReason.loggedOut;
        console.warn("[Joana] Baileys desligado", status ?? "", shouldReconnect ? "a reconectar..." : "");
        if (shouldReconnect) {
          setTimeout(connect, 3000);
        } else {
          latestQr = null;
        }
      }
    });

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const item of messages) {
        if (!item.message || item.key.fromMe || item.key.remoteJid?.endsWith("@g.us")) continue;
        const text = extractText(item.message);
        if (!text) continue;
        const phone = fromJid(item.key.remoteJid);
        try {
          await handlers.onText(phone, text);
        } catch (error) {
          console.error(`[Joana] Erro ao processar mensagem de ${phone}:`, error.message);
        }
      }
    });
  };

  handlers.sendText = async (phone, text) => {
    if (!socket || connectionState !== "open") {
      console.warn(`[Joana] Baileys offline; não enviou para ${phone}: ${text}`);
      return;
    }
    await socket.sendMessage(toJid(phone), { text });
  };

  await connect();
}

export function getBaileysStatus() {
  return { state: connectionState, hasQr: Boolean(latestQr) };
}

export async function getBaileysQrDataUrl() {
  if (!latestQr) return null;
  return QRCode.toDataURL(latestQr, { margin: 1, width: 280 });
}

export function renderBaileysLinkPage() {
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ligar Joana ao WhatsApp</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 32px auto; padding: 0 16px; color: #221f1c; }
    h1 { font-family: Georgia, serif; color: #264653; font-size: 1.4rem; }
    img { width: 100%; max-width: 280px; display: block; margin: 16px 0; border: 1px solid #ded4c7; border-radius: 8px; }
    .ok { color: #1d6b5c; font-weight: 600; }
    .warn { font-size: 0.88rem; color: #7a7268; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Ligar ao WhatsApp</h1>
  <p class="warn">Modo não oficial (WhatsApp Web). Pode haver risco de limitação da conta pela Meta.</p>
  <p id="status">A carregar…</p>
  <img id="qr" alt="QR Code" hidden>
  <ol class="warn">
    <li>No telemóvel com o WhatsApp desse número: <strong>Aparelhos ligados</strong> → <strong>Ligar um aparelho</strong></li>
    <li>Escaneia o QR (só aparece enquanto estiver desligado)</li>
  </ol>
  <p><a href="/health">Estado do servidor</a></p>
  <script>
    async function refresh() {
      const res = await fetch("/wa/status");
      const data = await res.json();
      const status = document.getElementById("status");
      const img = document.getElementById("qr");
      if (data.state === "open") {
        status.innerHTML = '<span class="ok">Ligado. Podes fechar esta página e testar com olá no WhatsApp.</span>';
        img.hidden = true;
        return;
      }
      if (data.qrDataUrl) {
        status.textContent = "Escaneia este QR no WhatsApp:";
        img.src = data.qrDataUrl;
        img.hidden = false;
      } else {
        status.textContent = "A aguardar QR… (recarrega dentro de segundos)";
        img.hidden = true;
      }
    }
    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`;
}

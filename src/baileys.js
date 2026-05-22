import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import QRCode from "qrcode";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import { config } from "./config.js";

let socket = null;
let latestQr = null;
let connectionState = "starting";
let lastError = "";
let handlersRef = null;
let connectGeneration = 0;
let stuckTimer = null;
let reconnectAttempts = 0;

const MAX_RECONNECT = 3;

function authDir() {
  const dir = path.join(config.dataDir, "baileys-auth");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function clearAuthDir() {
  const dir = authDir();
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
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

function scheduleStuckCheck() {
  if (stuckTimer) clearTimeout(stuckTimer);
  stuckTimer = setTimeout(() => {
    if ((connectionState === "connecting" || connectionState === "starting") && !latestQr) {
      console.warn("[Joana] Sem QR após 25s — a limpar sessão e tentar de novo");
      resetBaileysSession().catch((error) => console.error("[Joana] Reset Baileys falhou:", error.message));
    }
  }, 25000);
}

/**
 * WhatsApp Web (não oficial). Risco de banimento pela Meta.
 */
export async function startBaileys(handlers) {
  handlersRef = handlers;
  await connectBaileys();
}

function shouldStopReconnecting(status) {
  return (
    status === 405 ||
    status === DisconnectReason.loggedOut ||
    status === DisconnectReason.forbidden ||
    status === DisconnectReason.multideviceMismatch ||
    status === DisconnectReason.badSession
  );
}

function describeDisconnect(status) {
  if (status === 405) {
    return "WhatsApp recusou a ligação (405). Comum com número só na API Cloud ou IP de datacenter (Render). Tenta no teu PC com npm start.";
  }
  if (status === DisconnectReason.multideviceMismatch) {
    return "Multi-dispositivo não disponível neste número.";
  }
  if (status === DisconnectReason.loggedOut) {
    return "Sessão terminada. Gera novo QR.";
  }
  return `Ligação fechada (código ${status ?? "?"}).`;
}

async function connectBaileys() {
  const generation = ++connectGeneration;
  connectionState = "connecting";
  latestQr = null;
  scheduleStuckCheck();

  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(authDir());

  socket = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Joana"),
    syncFullHistory: false,
    markOnlineOnConnect: false
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", (update) => {
    if (generation !== connectGeneration) return;
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      latestQr = qr;
      connectionState = "qr";
      console.log("[Joana] QR disponível em /wa/link");
    }
    if (connection === "open") {
      latestQr = null;
      connectionState = "open";
      lastError = "";
      reconnectAttempts = 0;
      if (stuckTimer) clearTimeout(stuckTimer);
      console.log("[Joana] Baileys ligado ao WhatsApp");
    }
    if (connection === "close") {
      const status = lastDisconnect?.error?.output?.statusCode;
      lastError = describeDisconnect(status);
      console.warn("[Joana] Baileys desligado", status ?? "", "-", lastError);

      if (status === DisconnectReason.restartRequired) {
        clearAuthDir();
        setTimeout(() => connectBaileys().catch((e) => console.error(e.message)), 2000);
        return;
      }

      if (shouldStopReconnecting(status) || reconnectAttempts >= MAX_RECONNECT) {
        reconnectAttempts = 0;
        clearAuthDir();
        connectionState = "error";
        latestQr = null;
        if (stuckTimer) clearTimeout(stuckTimer);
        return;
      }

      reconnectAttempts += 1;
      connectionState = "closed";
      setTimeout(() => connectBaileys().catch((e) => console.error(e.message)), 5000);
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" || !handlersRef) return;
    for (const item of messages) {
      if (!item.message || item.key.fromMe || item.key.remoteJid?.endsWith("@g.us")) continue;
      const text = extractText(item.message);
      if (!text) continue;
      const phone = fromJid(item.key.remoteJid);
      try {
        await handlersRef.onText(phone, text);
      } catch (error) {
        console.error(`[Joana] Erro ao processar mensagem de ${phone}:`, error.message);
      }
    }
  });

  if (handlersRef) {
    handlersRef.sendText = async (phone, text) => {
      if (!socket || connectionState !== "open") {
        console.warn(`[Joana] Baileys offline; não enviou para ${phone}`);
        return;
      }
      await socket.sendMessage(toJid(phone), { text });
    };
  }
}

export async function resetBaileysSession() {
  connectGeneration += 1;
  latestQr = null;
  connectionState = "starting";
  if (stuckTimer) clearTimeout(stuckTimer);
  try {
    socket?.end?.();
  } catch {
    // ignore
  }
  socket = null;
  clearAuthDir();
  if (handlersRef) await connectBaileys();
}

export function getBaileysStatus() {
  return { state: connectionState, hasQr: Boolean(latestQr), error: lastError || null };
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
    button { margin-top: 12px; padding: 10px 14px; border: 0; border-radius: 8px; background: #264653; color: white; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Ligar ao WhatsApp</h1>
  <p class="warn">Modo não oficial (WhatsApp Web). Pode haver risco de limitação da conta pela Meta.</p>
  <p id="status">A carregar…</p>
  <img id="qr" alt="QR Code" hidden>
  <button type="button" id="resetBtn">Gerar novo QR</button>
  <ol class="warn">
    <li>No telemóvel com o WhatsApp desse número: <strong>Aparelhos ligados</strong> → <strong>Ligar um aparelho</strong></li>
    <li>Escaneia o QR quando aparecer abaixo</li>
  </ol>
  <p><a href="/health">Estado do servidor</a></p>
  <script>
    async function refresh() {
      const res = await fetch("/wa/status");
      const data = await res.json();
      const status = document.getElementById("status");
      const img = document.getElementById("qr");
      if (data.state === "open") {
        status.innerHTML = '<span class="ok">Ligado. Fecha esta página e manda olá no WhatsApp.</span>';
        img.hidden = true;
        return;
      }
      if (data.state === "error" && data.error) {
        status.textContent = data.error;
        img.hidden = true;
        return;
      }
      if (data.qrDataUrl) {
        status.textContent = "Escaneia este QR no WhatsApp:";
        img.src = data.qrDataUrl;
        img.hidden = false;
      } else {
        status.textContent = "A aguardar QR… (pode demorar ~30s na primeira vez)";
        img.hidden = true;
      }
    }
    document.getElementById("resetBtn").addEventListener("click", async () => {
      document.getElementById("status").textContent = "A gerar novo QR…";
      await fetch("/wa/reset", { method: "POST" });
      setTimeout(refresh, 2000);
    });
    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`;
}

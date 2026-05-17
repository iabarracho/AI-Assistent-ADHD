import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { config } from "./config.js";
import { Store } from "./store.js";
import { JoanaAgent } from "./agent.js";
import { normalizeWaPhone, PLACEHOLDER_WA_ID } from "./phone.js";
import { verifyMetaWebhookSignature } from "./webhookVerify.js";
import { WhatsAppMessenger, parseCloudWebhook, parseRequestBody } from "./whatsapp.js";
import { renderPrivacyPage, renderTermsPage } from "./legalPages.js";

const store = new Store();
const realMessenger = new WhatsAppMessenger();
const devOutbox = {};
const messenger = {
  async sendText(to, text) {
    if (!devOutbox[to]) devOutbox[to] = [];
    devOutbox[to].push({ from: "Joana", text, at: new Date().toISOString() });
    await realMessenger.sendText(to, text);
  }
};
const agent = new JoanaAgent(store, messenger);

const joinHits = new Map();
const joinWindowMs = 60 * 60 * 1000;
const joinMaxPerWindow = 30;

function devChatEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.JOANA_DEV_CHAT === "1";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function clientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket?.remoteAddress || "unknown";
}

function joinRateOk(ip) {
  const now = Date.now();
  let rec = joinHits.get(ip);
  if (!rec || now - rec.start > joinWindowMs) {
    joinHits.set(ip, { start: now, n: 1 });
    return true;
  }
  if (rec.n >= joinMaxPerWindow) return false;
  rec.n += 1;
  return true;
}

setInterval(() => {
  agent.tick().catch((error) => console.error("Reminder tick failed", error));
}, 30 * 1000);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        ok: true,
        name: "Joana",
        whatsapp: {
          token: Boolean(config.cloud.token),
          phoneNumberId: Boolean(config.cloud.phoneNumberId),
          appSecret: Boolean(config.cloud.appSecret)
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderLanding());
      return;
    }

    if (request.method === "GET" && url.pathname === "/privacy") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderPrivacyPage());
      return;
    }

    if (request.method === "GET" && url.pathname === "/terms") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderTermsPage());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/join") {
      return handleJoin(request, response);
    }

    if (request.method === "GET" && url.pathname === "/demo.html") {
      if (!devChatEnabled()) return sendJson(response, 404, { error: "Not found" });
      const demoPath = path.join(config.rootDir, "demo.html");
      if (!fs.existsSync(demoPath)) return sendJson(response, 404, { error: "Not found" });
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(fs.readFileSync(demoPath, "utf8"));
      return;
    }

    if (request.method === "GET" && url.pathname === "/dev") {
      if (!devChatEnabled()) return sendJson(response, 404, { error: "Not found" });
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderDevChat());
      return;
    }

    if (request.method === "GET" && url.pathname === "/webhook") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === config.cloud.verifyToken) {
        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end(challenge);
        return;
      }

      return sendJson(response, 403, { error: "Invalid verification token" });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      console.log("[Joana] POST /webhook (pedido da Meta ou teste)");
      const raw = await readRawBody(request);
      const sig = request.headers["x-hub-signature-256"];
      if (!verifyMetaWebhookSignature(raw, sig, config.cloud.appSecret)) {
        console.error("[Joana] Webhook POST rejeitado: assinatura inválida (confirma WHATSAPP_APP_SECRET na Render)");
        return sendJson(response, 403, { error: "Invalid webhook signature" });
      }
      let payload = {};
      try {
        payload = raw.length ? JSON.parse(raw.toString("utf8")) : {};
      } catch {
        return sendJson(response, 400, { error: "Invalid JSON" });
      }
      const messages = parseCloudWebhook(payload);
      console.log(`[Joana] Webhook: ${messages.length} mensagem(ns)`);
      if (!config.cloud.phoneNumberId) {
        console.error("[Joana] WHATSAPP_PHONE_NUMBER_ID em falta — respostas não são enviadas ao WhatsApp");
      }
      for (const message of messages) {
        try {
          await handleIncomingMessage(message);
        } catch (error) {
          console.error(`[Joana] Erro ao responder a ${message.from}:`, error.message);
        }
      }
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === "POST" && url.pathname === "/webhook/twilio") {
      const body = await parseRequestBody(request);
      if (body.From && body.Body) {
        await agent.receive(body.From.replace(/^whatsapp:\+?/, ""), body.Body);
      } else if (body.From && body.MediaUrl0 && String(body.MediaContentType0 || "").startsWith("audio/")) {
        const from = body.From.replace(/^whatsapp:\+?/, "");
        const text = await realMessenger.transcribeTwilioAudio(body.MediaUrl0);
        if (text) {
          await agent.receive(from, text);
        } else {
          await messenger.sendText(from, "Pedro, ouvi o áudio mas ainda não consigo transcrever. Escreve-me isso, vá.");
        }
      }
      response.writeHead(200, { "Content-Type": "text/xml" });
      response.end("<Response></Response>");
      return;
    }

    if (request.method === "POST" && url.pathname === "/dev/message") {
      if (!devChatEnabled()) return sendJson(response, 404, { error: "Not found" });
      const body = await parseRequestBody(request);
      const from = body.from || PLACEHOLDER_WA_ID;
      const before = devOutbox[from]?.length || 0;
      await agent.receive(from, body.text || "olá");
      return sendJson(response, 200, {
        ok: true,
        messages: (devOutbox[from] || []).slice(before)
      });
    }

    return sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: error.message });
  }
});

server.listen(config.port, () => {
  console.log(`Joana is listening on http://localhost:${config.port}`);
  if (isProduction()) {
    if (config.cloud.verifyToken === "joana-local-dev") {
      console.warn("[Joana] Produção: define WHATSAPP_VERIFY_TOKEN forte no .env (não uses o valor por defeito).");
    }
    if (!config.cloud.appSecret) {
      console.warn("[Joana] Produção: define WHATSAPP_APP_SECRET e valida X-Hub-Signature-256 no webhook.");
    }
  }
});

async function handleJoin(request, response) {
  const ip = clientIp(request);
  if (!joinRateOk(ip)) {
    return sendJson(response, 429, { error: "Demasiados pedidos. Tenta mais tarde." });
  }

  const body = await parseRequestBody(request);
  if (!body.consent) {
    return sendJson(response, 400, { error: "Tens de aceitar receber mensagens da Joana no WhatsApp." });
  }

  const phone = normalizeWaPhone(body.phone);
  if (!phone) {
    return sendJson(response, 400, {
      error: "Indica um número válido com indicativo internacional (ex.: +351 912 345 678 ou 351912345678)."
    });
  }

  try {
    const status = await agent.startSignupWhatsApp(phone);
    if (status === "started") {
      return sendJson(response, 200, {
        ok: true,
        status,
        message: "Feito. Abre o WhatsApp no teu telemóvel — a Joana acabou de te enviar as primeiras mensagens."
      });
    }
    if (status === "in_progress") {
      return sendJson(response, 200, {
        ok: true,
        status,
        message: "Já tinhas começado o registo. Abre o WhatsApp e continua a conversa com a Joana."
      });
    }
    return sendJson(response, 200, {
      ok: true,
      status: "done",
      message: "Já estás configurado. Escreve à Joana no WhatsApp quando quiseres."
    });
  } catch (error) {
    console.error("Join / WhatsApp send failed", error);
    const hint = isProduction()
      ? "Não foi possível enviar pelo WhatsApp. Confirma token, Phone number ID, opt-in e templates aprovados (regras da Meta)."
      : "Não foi possível enviar pelo WhatsApp. Confirma token, Phone number ID e, na consola Meta, se o número está na lista de teste (dev).";
    return sendJson(response, 502, { error: hint });
  }
}

async function handleIncomingMessage(message) {
  if (message.text) {
    await agent.receive(message.from, message.text);
    return;
  }

  if (message.audio?.provider === "cloud") {
    const text = await realMessenger.transcribeCloudAudio(message.audio.id);
    if (text) {
      await agent.receive(message.from, text);
    } else {
      await messenger.sendText(message.from, "Pedro, ouvi o áudio mas ainda não consigo transcrever. Escreve-me isso, vá.");
    }
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function renderLanding() {
  const devHint = devChatEnabled()
    ? `<p class="foot"><a href="/dev">Chat de desenvolvimento</a> · <a href="/demo.html">Demo só no browser</a></p>`
    : "";

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Joana — a tua assistente no WhatsApp</title>
  <style>
    :root { color-scheme: light; font-family: Georgia, "Times New Roman", serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #f5f1ea; color: #221f1c; }
    .wrap { max-width: 520px; margin: 0 auto; padding: 48px 20px 32px; }
    h1 { font-size: 2rem; margin: 0 0 8px; color: #264653; }
    .tag { font-family: system-ui, sans-serif; font-size: 0.95rem; color: #5c5348; line-height: 1.5; margin: 0 0 28px; }
    .card {
      font-family: system-ui, -apple-system, sans-serif;
      background: #fffaf2;
      border: 1px solid #ded4c7;
      border-radius: 12px;
      padding: 24px 22px 22px;
      box-shadow: 0 8px 24px rgba(38, 70, 83, 0.06);
    }
    label { display: block; font-size: 0.88rem; font-weight: 600; color: #264653; margin-bottom: 8px; }
    input[type="tel"] {
      width: 100%; font-size: 1.05rem; padding: 14px 14px; border-radius: 8px;
      border: 1px solid #c9bdae; margin-bottom: 16px;
    }
    .check { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 20px; font-size: 0.88rem; line-height: 1.45; color: #3d3830; }
    .check input { margin-top: 3px; width: 18px; height: 18px; flex-shrink: 0; }
    button {
      width: 100%; font-size: 1.05rem; font-weight: 600; padding: 14px 18px;
      border: 0; border-radius: 8px; cursor: pointer;
      background: #e76f51; color: white;
    }
    button:disabled { opacity: 0.65; cursor: not-allowed; }
    #msg { margin-top: 16px; font-size: 0.9rem; min-height: 1.4em; font-family: system-ui, sans-serif; }
    #msg.ok { color: #1d6b5c; }
    #msg.err { color: #9b2c2c; }
    .foot { margin-top: 28px; font-family: system-ui, sans-serif; font-size: 0.8rem; color: #7a7268; line-height: 1.5; }
    .foot a { color: #264653; }
    .legal { margin-top: 14px; font-size: 0.75rem; color: #8a8278; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Tens a tua Joana</h1>
    <p class="tag">Lembretes e conversa no WhatsApp — a sério, mas com piada. Clica, deixa o teu número com indicativo, e recebes já a primeira mensagem.</p>
    <div class="card">
      <form id="join">
        <label for="phone">O teu WhatsApp (com indicativo do país)</label>
        <input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="+351 912 345 678" required>
        <label class="check">
          <input id="consent" type="checkbox" required>
          <span>Autorizo a Joana a enviar-me mensagens por WhatsApp neste número (opt-in).</span>
        </label>
        <button type="submit" id="btn">Quero a minha Joana</button>
        <p id="msg" role="status"></p>
      </form>
    </div>
    <p class="legal">Serviço via WhatsApp Business. Ao inscrever-te aceitas receber mensagens neste número. O primeiro contacto por WhatsApp segue as regras da Meta (opt-in e, quando aplicável, mensagens modelo aprovadas). <a href="/privacy">Privacidade</a> · <a href="/terms">Termos</a>.</p>
    ${devHint}
  </div>
  <script>
    const form = document.getElementById("join");
    const msg = document.getElementById("msg");
    const btn = document.getElementById("btn");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "";
      msg.className = "";
      btn.disabled = true;
      try {
        const phone = document.getElementById("phone").value;
        const consent = document.getElementById("consent").checked;
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, consent })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Algo correu mal.");
        msg.textContent = data.message || "OK.";
        msg.className = "ok";
      } catch (err) {
        msg.textContent = err.message || "Erro.";
        msg.className = "err";
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function renderDevChat() {
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Joana — dev</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; }
    body { margin: 0; min-height: 100vh; background: #f5f1ea; color: #221f1c; display: grid; place-items: center; }
    main { width: min(760px, calc(100vw - 28px)); height: min(760px, calc(100vh - 28px)); display: grid; grid-template-rows: auto 1fr auto; background: #fffaf2; border: 1px solid #ded4c7; border-radius: 8px; overflow: hidden; }
    header { padding: 18px 20px; background: #264653; color: white; }
    h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
    p { margin: 4px 0 0; color: #d9ebe9; font-size: 14px; }
    #chat { padding: 18px; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
    .msg { max-width: 78%; padding: 10px 12px; border-radius: 8px; line-height: 1.35; white-space: pre-wrap; }
    .me { align-self: flex-end; background: #2a9d8f; color: white; }
    .joana { align-self: flex-start; background: #efe7da; color: #221f1c; }
    form { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px; border-top: 1px solid #ded4c7; background: white; }
    input, button { font: inherit; border-radius: 8px; border: 1px solid #c9bdae; padding: 12px; }
    button { background: #e76f51; color: white; border: 0; cursor: pointer; min-width: 96px; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Joana (dev)</h1>
      <p>Simula conversas sem WhatsApp. Define o número em <code>from</code> no script se precisares.</p>
    </header>
    <section id="chat"></section>
    <form id="form">
      <input id="text" autocomplete="off" placeholder="Escreve aqui, Pedro..." autofocus>
      <button>Enviar</button>
    </form>
  </main>
  <script>
    const chat = document.querySelector("#chat");
    const form = document.querySelector("#form");
    const input = document.querySelector("#text");
    const from = "${PLACEHOLDER_WA_ID}";

    function addMessage(kind, text) {
      const el = document.createElement("div");
      el.className = "msg " + kind;
      el.textContent = text;
      chat.appendChild(el);
      chat.scrollTop = chat.scrollHeight;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      addMessage("me", text);
      const response = await fetch("/dev/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, text })
      });
      const data = await response.json();
      for (const message of data.messages || []) addMessage("joana", message.text);
    });
  </script>
</body>
</html>`;
}

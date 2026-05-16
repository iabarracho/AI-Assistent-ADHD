import { config } from "./config.js";

export class WhatsAppMessenger {
  async sendText(to, text) {
    if (config.provider === "twilio") {
      return this.sendWithTwilio(to, text);
    }

    return this.sendWithCloudApi(to, text);
  }

  async sendWithCloudApi(to, text) {
    if (!isConfigured(config.cloud.token) || !isConfigured(config.cloud.phoneNumberId)) {
      console.log(`[dev whatsapp -> ${to}] ${text}`);
      return;
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${config.cloud.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cloud.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: {
          preview_url: false,
          body: text
        }
      })
    });

    if (!response.ok) {
      throw new Error(`WhatsApp Cloud API failed: ${response.status} ${await response.text()}`);
    }
  }

  async sendWithTwilio(to, text) {
    if (!isConfigured(config.twilio.accountSid) || !isConfigured(config.twilio.authToken) || !isConfigured(config.twilio.from)) {
      console.log(`[dev twilio -> ${to}] ${text}`);
      return;
    }

    const auth = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64");
    const body = new URLSearchParams({
      From: config.twilio.from,
      To: to.startsWith("whatsapp:") ? to : `whatsapp:+${to.replace(/^\+/, "")}`,
      Body: text
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error(`Twilio failed: ${response.status} ${await response.text()}`);
    }
  }

  async transcribeCloudAudio(mediaId) {
    if (!isConfigured(config.cloud.token) || !isConfigured(config.transcription.openAiApiKey)) return "";

    const mediaResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${config.cloud.token}`
      }
    });

    if (!mediaResponse.ok) {
      throw new Error(`Could not get WhatsApp audio media: ${mediaResponse.status} ${await mediaResponse.text()}`);
    }

    const media = await mediaResponse.json();
    const audioResponse = await fetch(media.url, {
      headers: {
        Authorization: `Bearer ${config.cloud.token}`
      }
    });

    if (!audioResponse.ok) {
      throw new Error(`Could not download WhatsApp audio: ${audioResponse.status} ${await audioResponse.text()}`);
    }

    return transcribeAudioBlob(await audioResponse.blob(), "audio.ogg");
  }

  async transcribeTwilioAudio(mediaUrl) {
    if (!isConfigured(config.twilio.accountSid) || !isConfigured(config.twilio.authToken) || !isConfigured(config.transcription.openAiApiKey)) return "";

    const auth = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64");
    const audioResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    if (!audioResponse.ok) {
      throw new Error(`Could not download Twilio audio: ${audioResponse.status} ${await audioResponse.text()}`);
    }

    return transcribeAudioBlob(await audioResponse.blob(), "audio.ogg");
  }
}

function isConfigured(value) {
  return Boolean(value && !String(value).startsWith("COLA_AQUI"));
}

async function transcribeAudioBlob(blob, filename) {
  const form = new FormData();
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("file", blob, filename);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.transcription.openAiApiKey}`
    },
    body: form
  });

  if (!response.ok) {
    throw new Error(`Audio transcription failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  return result.text || "";
}

export function parseCloudWebhook(payload) {
  const messages = [];
  const entries = payload.entry || [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || "";
        if (message.from && text) {
          messages.push({ from: message.from, text });
        } else if (message.from && message.audio?.id) {
          messages.push({
            from: message.from,
            audio: {
              provider: "cloud",
              id: message.audio.id,
              mimeType: message.audio.mime_type
            }
          });
        }
      }
    }
  }

  return messages;
}

export async function parseRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = request.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    return raw ? JSON.parse(raw) : {};
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  return raw ? JSON.parse(raw) : {};
}

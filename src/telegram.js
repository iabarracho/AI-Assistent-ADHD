import { config } from "./config.js";

function isConfigured() {
  return Boolean(config.telegram.botToken);
}

export async function sendTelegramText(chatId, text) {
  if (!isConfigured()) {
    console.log(`[dev telegram -> ${chatId}] ${text}`);
    return;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    }
  );

  if (!response.ok) {
    throw new Error(`Telegram send failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Long polling da API do Telegram (sem webhook extra na Render).
 * @param {(chatId: string, text: string) => Promise<void>} onMessage
 */
export function startTelegramPolling(onMessage) {
  if (!isConfigured()) return;

  let offset = 0;
  let busy = false;

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const url = new URL(`https://api.telegram.org/bot${config.telegram.botToken}/getUpdates`);
      url.searchParams.set("timeout", "25");
      if (offset) url.searchParams.set("offset", String(offset));

      const response = await fetch(url);
      if (!response.ok) {
        console.error("[Joana] Telegram getUpdates failed:", response.status, await response.text());
        return;
      }

      const data = await response.json();
      for (const update of data.result || []) {
        offset = update.update_id + 1;
        const message = update.message;
        const text = message?.text?.trim();
        if (!message?.chat?.id || !text) continue;
        await onMessage(String(message.chat.id), text);
      }
    } catch (error) {
      console.error("[Joana] Telegram polling error:", error.message);
    } finally {
      busy = false;
    }
  };

  console.log("[Joana] Telegram ativo (long polling)");
  tick();
  setInterval(tick, 1000);
}

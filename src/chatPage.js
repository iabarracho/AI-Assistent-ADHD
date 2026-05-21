export function renderChatPage() {
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#264653">
  <title>Joana</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #f5f1ea; color: #221f1c; }
    main {
      max-width: 520px; margin: 0 auto; min-height: 100vh;
      display: grid; grid-template-rows: auto 1fr auto;
      background: #fffaf2; border-left: 1px solid #ded4c7; border-right: 1px solid #ded4c7;
    }
    header { padding: 16px 18px; background: #264653; color: white; }
    header h1 { margin: 0; font-family: Georgia, serif; font-size: 1.35rem; }
    header p { margin: 4px 0 0; font-size: 0.82rem; color: #d9ebe9; }
    #setup { padding: 20px 18px; }
    #setup label { display: block; font-size: 0.88rem; font-weight: 600; color: #264653; margin-bottom: 8px; }
    #setup input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #c9bdae; font-size: 1rem; }
    #setup button { margin-top: 12px; width: 100%; padding: 12px; border: 0; border-radius: 8px; background: #e76f51; color: white; font-weight: 600; font-size: 1rem; cursor: pointer; }
    #panel { display: none; grid-template-rows: 1fr auto; min-height: 0; }
    #panel.open { display: grid; }
    #messages { padding: 16px; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
    .msg { max-width: 85%; padding: 10px 12px; border-radius: 12px; line-height: 1.4; white-space: pre-wrap; font-size: 0.95rem; }
    .me { align-self: flex-end; background: #2a9d8f; color: white; border-bottom-right-radius: 4px; }
    .joana { align-self: flex-start; background: #efe7da; border-bottom-left-radius: 4px; }
    #composer { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px; border-top: 1px solid #ded4c7; background: white; padding-bottom: max(12px, env(safe-area-inset-bottom)); }
    #composer input { padding: 12px; border-radius: 8px; border: 1px solid #c9bdae; font-size: 1rem; }
    #composer button { padding: 12px 16px; border: 0; border-radius: 8px; background: #e76f51; color: white; font-weight: 600; cursor: pointer; }
    .hint { font-size: 0.75rem; color: #7a7268; margin-top: 10px; line-height: 1.4; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Joana</h1>
      <p>Lembretes e conversa — guarda no ecrã inicial como uma app.</p>
    </header>
    <section id="setup">
      <label for="phone">O teu WhatsApp (só para te reconhecer neste telemóvel)</label>
      <input id="phone" type="tel" autocomplete="tel" placeholder="+351 9XX XXX XXX">
      <button type="button" id="startBtn">Começar</button>
      <p class="hint">Não enviamos SMS. O número fica guardado só neste browser para continuar a conversa.</p>
    </section>
    <section id="panel">
      <div id="messages"></div>
      <form id="composer">
        <input id="text" autocomplete="off" placeholder="Escreve à Joana..." required>
        <button type="submit">Enviar</button>
      </form>
    </section>
  </main>
  <script>
    const storageKey = "joana_chat_phone";
    const setup = document.getElementById("setup");
    const panel = document.getElementById("panel");
    const phoneInput = document.getElementById("phone");
    const startBtn = document.getElementById("startBtn");
    const messages = document.getElementById("messages");
    const form = document.getElementById("composer");
    const textInput = document.getElementById("text");

    function getPhone() {
      return (localStorage.getItem(storageKey) || phoneInput.value || "").trim();
    }

    function addMessage(kind, text) {
      const el = document.createElement("div");
      el.className = "msg " + kind;
      el.textContent = text;
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
    }

    function openChat(phone) {
      localStorage.setItem(storageKey, phone);
      setup.style.display = "none";
      panel.classList.add("open");
      textInput.focus();
    }

    async function sendText(text) {
      const phone = getPhone();
      if (!phone) return;
      addMessage("me", text);
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao enviar.");
      for (const message of data.messages || []) addMessage("joana", message.text);
    }

    startBtn.addEventListener("click", async () => {
      const phone = phoneInput.value.trim();
      if (!phone) return;
      openChat(phone);
      try {
        await sendText("olá");
      } catch (err) {
        addMessage("joana", err.message);
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = textInput.value.trim();
      if (!text) return;
      textInput.value = "";
      try {
        await sendText(text);
      } catch (err) {
        addMessage("joana", err.message);
      }
    });

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      phoneInput.value = saved;
      openChat(saved);
    }
  </script>
</body>
</html>`;
}

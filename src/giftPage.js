/**
 * Página-surpresa para abrir o bot no Telegram (link só após o clique).
 * @param {string|null} telegramUrl ex. https://t.me/Pedro_assistant_joana_Bot
 */
export function renderGiftPage(telegramUrl) {
  const hasLink = Boolean(telegramUrl);
  const openUrl = hasLink
    ? telegramUrl.includes("?")
      ? telegramUrl
      : `${telegramUrl}?start=pedro`
    : "";

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Para o Pedro 🤍</title>
  <meta name="robots" content="noindex">
  <style>
    :root {
      color-scheme: light;
      --bg: #1a1420;
      --card: #fff9f3;
      --accent: #e76f51;
      --tg: #2aabee;
      --text: #2b2622;
      --muted: #6b6358;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      background: radial-gradient(ellipse 120% 80% at 50% 0%, #3d2a4a 0%, var(--bg) 55%);
      color: var(--text);
      display: grid;
      place-items: center;
      padding: 24px 16px;
    }
    .card {
      width: min(420px, 100%);
      background: var(--card);
      border-radius: 20px;
      padding: 32px 28px 28px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.35);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: "🎁";
      position: absolute;
      top: -8px;
      right: 16px;
      font-size: 2.5rem;
      opacity: 0.35;
      transform: rotate(12deg);
    }
    .badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 12px;
    }
    h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.75rem;
      margin: 0 0 10px;
      color: #264653;
      line-height: 1.2;
    }
    .lead {
      margin: 0 0 28px;
      color: var(--muted);
      font-size: 0.98rem;
      line-height: 1.55;
    }
    #btn {
      width: 100%;
      border: 0;
      border-radius: 14px;
      padding: 16px 20px;
      font-size: 1.08rem;
      font-weight: 700;
      cursor: pointer;
      background: linear-gradient(135deg, var(--accent), #d45a3f);
      color: white;
      box-shadow: 0 8px 24px rgba(231, 111, 81, 0.45);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    #btn:hover:not(:disabled) { transform: translateY(-2px); }
    #btn:active:not(:disabled) { transform: translateY(0); }
    #btn:disabled {
      cursor: default;
      background: var(--tg);
      box-shadow: 0 8px 24px rgba(42, 171, 238, 0.4);
    }
    #reveal {
      margin-top: 22px;
      min-height: 1.4em;
      font-size: 0.92rem;
      color: var(--muted);
      line-height: 1.5;
    }
    #reveal strong { color: #264653; }
    .hint {
      margin-top: 20px;
      font-size: 0.78rem;
      color: #9a9288;
    }
    .open-now {
      display: none;
      margin-top: 16px;
    }
    .open-now.visible { display: block; }
    .open-now a {
      display: inline-block;
      padding: 12px 22px;
      border-radius: 10px;
      background: var(--tg);
      color: white;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
    }
    @keyframes pop {
      0% { transform: scale(0.9); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .pop { animation: pop 0.35s ease; }
    @media (prefers-reduced-motion: reduce) {
      .pop { animation: none; }
      #btn { transition: none; }
    }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">Confidencial · só para o Pedro</span>
    <h1>Tens um presente digital</h1>
    <p class="lead">
      A tua namorada não aguentava mais ver-te esquecer tudo.<br>
      Por isso contratou reforços. O nome dela é <strong>Joana</strong>.
    </p>
    <button type="button" id="btn" ${hasLink ? "" : "disabled"}>
      ${hasLink ? "Desbloquear o presente" : "Telegram ainda não configurado"}
    </button>
    <p id="reveal"></p>
    <p class="open-now" id="fallback"><a href="#" id="fallbackLink">Abrir no Telegram</a></p>
    <p class="hint">Precisas da app Telegram no telemóvel. Depois manda <strong>olá</strong>.</p>
  </main>
  <script>
    const TG_URL = ${JSON.stringify(openUrl)};
    const btn = document.getElementById("btn");
    const reveal = document.getElementById("reveal");
    const fallback = document.getElementById("fallback");
    const fallbackLink = document.getElementById("fallbackLink");

    if (!TG_URL) {
      reveal.textContent = "O link ainda não está pronto. Pede à Inês o link do bot.";
    } else {
      fallbackLink.href = TG_URL;
      btn.addEventListener("click", () => {
        btn.disabled = true;
        btn.textContent = "A abrir o Telegram…";
        reveal.innerHTML = '<span class="pop"><strong>Joana</strong> está à tua espera.<br>Manda <strong>olá</strong> e responde <strong>sim</strong> à hora.</span>';
        fallback.classList.add("visible");
        setTimeout(() => {
          window.location.href = TG_URL;
        }, 900);
      });
    }
  </script>
</body>
</html>`;
}

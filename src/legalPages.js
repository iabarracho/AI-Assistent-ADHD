const CONTACT_EMAIL = "inesbarracho.perc@gmail.com";
const APP_NAME = "Joana ASSIST";
const LAST_UPDATED = "16 de maio de 2026";

function legalShell(title, bodyHtml) {
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — ${APP_NAME}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0; font-family: system-ui, -apple-system, sans-serif;
      background: #f5f1ea; color: #221f1c; line-height: 1.55;
    }
    .wrap { max-width: 640px; margin: 0 auto; padding: 40px 20px 48px; }
    h1 { font-family: Georgia, serif; font-size: 1.75rem; color: #264653; margin: 0 0 8px; }
    .meta { font-size: 0.85rem; color: #7a7268; margin-bottom: 28px; }
    h2 { font-size: 1.05rem; color: #264653; margin: 28px 0 10px; }
    p, li { font-size: 0.95rem; color: #3d3830; }
    ul { padding-left: 1.25rem; }
    a { color: #264653; }
    nav { margin-top: 32px; font-size: 0.88rem; }
  </style>
</head>
<body>
  <div class="wrap">
    ${bodyHtml}
    <nav><a href="/">Início</a> · <a href="/privacy">Privacidade</a> · <a href="/data-deletion">Eliminar dados</a> · <a href="/terms">Termos</a></nav>
  </div>
</body>
</html>`;
}

export function renderPrivacyPage() {
  const body = `
    <h1>Política de privacidade</h1>
    <p class="meta">${APP_NAME} · Última atualização: ${LAST_UPDATED}</p>

    <h2>1. Quem somos</h2>
    <p>${APP_NAME} é um assistente pessoal de lembretes e hábitos que funciona através do WhatsApp. O serviço é operado para utilizadores que aderem voluntariamente (opt-in).</p>

    <h2>2. Que dados recolhemos</h2>
    <ul>
      <li><strong>Número de telefone</strong> (WhatsApp), quando te inscreves ou nos escreves.</li>
      <li><strong>Mensagens</strong> que envias à Joana (texto e, se ativado, áudio para transcrição).</li>
      <li><strong>Preferências e lembretes</strong> que defines na conversa (horários, hábitos, textos de lembretes).</li>
      <li><strong>Dados técnicos</strong> mínimos para o funcionamento do serviço (ex.: registos de entrega de mensagens pela API WhatsApp).</li>
    </ul>

    <h2>3. Para que usamos os dados</h2>
    <ul>
      <li>Enviar e receber mensagens no WhatsApp no âmbito do assistente.</li>
      <li>Guardar lembretes e preferências que pedires.</li>
      <li>Melhorar respostas no contexto da conversa (sem venda de dados a terceiros).</li>
    </ul>

    <h2>4. Base legal (RGPD)</h2>
    <p>Tratamos os dados com base no <strong>teu consentimento</strong> (opt-in no WhatsApp e/ou no formulário do site) e na <strong>execução do serviço</strong> que solicitas.</p>

    <h2>5. Partilha com terceiros</h2>
    <p>Usamos a <strong>Meta WhatsApp Business Platform</strong> para entregar mensagens. Os dados de mensagens transitam pelos sistemas da Meta conforme a política deles. O alojamento da aplicação pode usar fornecedores de cloud (ex.: Render) apenas para operar o serviço.</p>
    <p><strong>Não vendemos</strong> os teus dados pessoais.</p>

    <h2>6. Conservação</h2>
    <p>Conservamos os dados enquanto usares o serviço. Podes pedir eliminação a qualquer momento (ver secção 8).</p>

    <h2>7. Segurança</h2>
    <p>Aplicamos medidas técnicas razoáveis (ligações HTTPS, acesso restrito às credenciais da API). Nenhum sistema é 100% seguro.</p>

    <h2>8. Os teus direitos e eliminação de dados</h2>
    <p>Podes pedir <strong>acesso, retificação ou eliminação</strong> dos teus dados, ou retirar o consentimento:</p>
    <ul>
      <li>Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></li>
      <li>Ou envia no WhatsApp: pedido para apagar os teus dados / deixar de receber mensagens.</li>
    </ul>
    <p>Respondemos em prazo razoável (até 30 dias quando aplicável o RGPD).</p>

    <h2>9. Menores</h2>
    <p>O serviço não se destina a menores de 16 anos sem autorização de quem exerce responsabilidades parentais.</p>

    <h2>10. Alterações</h2>
    <p>Podemos atualizar esta página. A data no topo indica a versão em vigor.</p>

    <h2>11. Contacto</h2>
    <p>Questões sobre privacidade: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
  `;
  return legalShell("Privacidade", body);
}

export function renderTermsPage() {
  const body = `
    <h1>Termos de utilização</h1>
    <p class="meta">${APP_NAME} · Última atualização: ${LAST_UPDATED}</p>

    <h2>1. Serviço</h2>
    <p>${APP_NAME} é um assistente automatizado de lembretes por WhatsApp, fornecido “tal como está”, para uso pessoal dos utilizadores que aderem.</p>

    <h2>2. Opt-in</h2>
    <p>Só enviamos mensagens a quem deu consentimento (checkbox no site e/ou primeira conversa no WhatsApp, conforme as regras da Meta).</p>

    <h2>3. Uso aceitável</h2>
    <p>Não uses o serviço para conteúdo ilegal, spam ou abuso. Podemos suspender o acesso em caso de uso inadequado.</p>

    <h2>4. Limitação de responsabilidade</h2>
    <p>A Joana apoia lembretes mas <strong>não substitui</strong> aconselhamento médico, jurídico ou profissional. És responsável por decisões que tomes com base nas mensagens.</p>

    <h2>5. WhatsApp e Meta</h2>
    <p>O WhatsApp é operado pela Meta. O uso do canal WhatsApp está sujeito aos termos da Meta e às políticas do WhatsApp Business.</p>

    <h2>6. Privacidade</h2>
    <p>Ver <a href="/privacy">Política de privacidade</a>.</p>

    <h2>7. Contacto</h2>
    <p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
  `;
  return legalShell("Termos", body);
}

export function renderDataDeletionPage() {
  const body = `
    <h1>Eliminação de dados do utilizador</h1>
    <p class="meta">${APP_NAME} · Última atualização: ${LAST_UPDATED}</p>

    <p>Se usas a Joana no WhatsApp ou no site, podes pedir que apaguemos os teus dados pessoais.</p>

    <h2>O que apagamos</h2>
    <ul>
      <li>Número de telefone associado à conta/conversa</li>
      <li>Mensagens e preferências guardadas (lembretes, horários, onboarding)</li>
      <li>Dados no ficheiro de contacto do serviço no nosso servidor</li>
    </ul>

    <h2>Como pedir eliminação</h2>
    <p><strong>Opção 1 — Email</strong><br>
    Envia para <a href="mailto:${CONTACT_EMAIL}?subject=Pedido%20elimina%C3%A7%C3%A3o%20de%20dados%20Joana">${CONTACT_EMAIL}</a>
    com o assunto <em>Pedido eliminação de dados Joana</em> e indica o teu número de WhatsApp com indicativo (ex. +351 …).</p>

    <p><strong>Opção 2 — WhatsApp</strong><br>
  Escreve à Joana no mesmo número onde recebes mensagens e pede explicitamente:
  <em>“Quero apagar os meus dados”</em> ou <em>“Quero deixar de receber mensagens”</em>.</p>

    <h2>Prazo</h2>
    <p>Respondemos e tratamos o pedido em até <strong>30 dias</strong> (RGPD), normalmente mais depressa.</p>

    <h2>Depois de apagar</h2>
    <p>Deixas de receber lembretes. Se voltares a usar o serviço, um novo registo pode criar dados novos.</p>

    <h2>Mais informação</h2>
    <p>Consulta a <a href="/privacy">política de privacidade</a> completa.</p>
  `;
  return legalShell("Eliminação de dados", body);
}

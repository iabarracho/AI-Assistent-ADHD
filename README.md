# Joana, agente de WhatsApp para lembretes

Este projeto cria uma agente chamada Joana que conversa por WhatsApp como um contacto real. Ela faz o onboarding inicial, guarda preferências de lembretes diários e cria lembretes a partir de mensagens como `lembra-me de comprar pão`.

## Começa aqui — o que fazer **primeiro** (por ordem)

Não precisas de número novo **só para começar**: em modo teste a Meta dá-te um **número de teste** da app; só precisas de **adicionar o teu WhatsApp** à lista deles. Faz **um passo de cada vez**:

1. **Conta Facebook** com telemóvel verificado (é com o que entras na Meta).
2. **Criar a app:** abre [developers.facebook.com/apps](https://developers.facebook.com/apps/) → **Create App** → escolhe o caso de uso **WhatsApp** (ou **Other** e adicionas o produto WhatsApp depois).
3. **Autorizar o teu telemóvel:** na app → menu **WhatsApp** → **API Setup** → **Manage phone number list** (lista de teste) → adiciona o **teu** número de WhatsApp e confirma o código que eles enviam.
4. **Anota três valores:** na mesma **API Setup** copia o **Temporary access token** e o **Phone number ID**; depois em **App settings** (engrenagem) → **Basic** copia o **App secret** (não é o mesmo que o token de mensagens).
5. **No teu computador:** na pasta do projeto, copia `.env.example` para `.env` e cola lá `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`. Escolhe uma palavra-passe qualquer para `WHATSAPP_VERIFY_TOKEN` e **anota-a** — vais repetir **exactamente** o mesmo texto na Meta no passo 7.
6. **Pôr o Joana na internet com HTTPS** (a Meta não fala com `localhost`):
   - **Mais simples para já:** instala um túnel (ex. [ngrok](https://ngrok.com/) ou [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)) → corre `node src/server.js` no PC → aponta o túnel para a porta **3000** → ficas com um endereço `https://…`.
   - **Ou** segue **só** a secção **«Primeiros passos na Render»** mais abaixo (GitHub + Render + variáveis no painel) e usa o URL `https://….onrender.com` — assim não precisas do PC ligado depois do deploy.
7. **Webhook na Meta:** na app → **WhatsApp** → **Configuration** (ou secção Webhook) → **Callback URL** = `https://O_TEU_URL/webhook` (o URL do passo 6 + `/webhook`) → **Verify token** = o **mesmo** `WHATSAPP_VERIFY_TOKEN` do `.env` → **Verify and save** → em **Webhook fields** ativa **messages**.
8. **Testar:** no WhatsApp do **teu** telemóvel, envia uma mensagem ao **número de teste** que a Meta mostra na **API Setup** (é o “From” / número da app, **não** o teu número pessoal). Escreve por exemplo `olá`. A Joana deve responder.

Se algo falhar, **para nesse passo** e corrige (o mais comum é token expirado: volta à **API Setup** e gera token novo no `.env` / na cloud).

**Queres mais detalhe** (eSIM, número próprio, produção comercial)? Lê a secção **«Guia completo»** logo a seguir — é a mesma ordem, com explicações extra.

## O que já faz

- Envia as duas mensagens de boas-vindas pedidas.
- Faz o questionário inicial:
  - medicação
  - ginásio
  - Boys
  - Ligar à Tuxa
  - Outros
- Permite escolher várias opções de uma vez.
- Pergunta horários específicos para cada escolha.
- Guarda lembretes diários.
- Percebe mensagens do género `lembra-me de x`.
- Pergunta "com ou sem horário definido?".
- Se não houver resposta à pergunta do horário durante 15 minutos, assume sem horário.
- Se não houver horário, envia até 4 lembretes de 2 em 2 horas.
- Corrige erros comuns no texto do lembrete, como `pao`, `agua`, `ginasio` e `medicacao`.
- Recebe áudio no webhook e tenta transcrever quando `OPENAI_API_KEY` está configurada.
- Pode enviar via WhatsApp Cloud API ou Twilio.

## Guia completo: do número à Joana na cloud

Isto **repete a mesma ordem** do **«Começa aqui»**, com mais pormenor (número novo, eSIM, produção, etc.). Se já seguiste «Começa aqui» e funciona, podes ler isto só quando fores a **produção** ou a **mudar de número**.

Há duas fases: **desenvolvimento** (número de teste da Meta + lista de telemóveis autorizados) e **produção** (número Business verificado pela Meta, templates, etc.). Os passos de API são parecidos; o que muda é o tipo de número e as regras no [Meta for Developers](https://developers.facebook.com/).

---

### 1. Número de telefone (eSIM ou SIM físico)

1. **Decide o número** que vais associar à WhatsApp Business / à app (idealmente uma linha **só para a Joana**, para não misturares com o teu WhatsApp pessoal no mesmo número).
2. **eSIM ou cartão físico** é indiferente para a Meta: o que conta é seres **dona do número** e conseguires receber **SMS ou chamada** com o código de verificação. Usa um **móvel real** da operadora; evita números “virtuais” duvidosos que a Meta costuma recusar ([documentação sobre tipos de número](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/)).
3. No dia em que fores **registar o número** no painel da Meta, deixa o telemóvel com esse eSIM/SIM **ligado e com rede**.
4. Se o número **já tiver WhatsApp pessoal** ativo, a Meta pode pedir-te fluxo de **migração** ou outro número — segue sempre o que o assistente deles mostrar (não forces o mesmo número sem ler os avisos).

---

### 2. Conta Meta, negócio e app

1. Conta **Facebook** pessoal com telemóvel verificado; de preferência **autenticação em dois passos** ativada.
2. Vai a [developers.facebook.com](https://developers.facebook.com/) e aceita ser **programador(a)** (registo gratuito).
3. Abre [developers.facebook.com/apps](https://developers.facebook.com/apps/) → **Create App**.
4. Em **Use case** escolhe **Connect with customers through WhatsApp** → **Next** (se não aparecer, escolhe **Other** e adiciona o produto **WhatsApp** mais tarde nas definições da app).
5. Nome da app (ex. `Joana`), email de contacto, **Business portfolio** (podes criar um portfolio de negócio gratuito se pedirem).
6. **Create app** e confirma password se pedirem.
7. No menu lateral: **WhatsApp** → **API Setup**. A Meta mostra um **número de teste** da app, o **Temporary access token** e o **Phone number ID** — vais precisar disto no `.env` (passo 4).

---

### 3. Autorizar o teu telemóvel (modo desenvolvimento)

Enquanto a app estiver em **desenvolvimento**, só certos números recebem mensagens da app:

1. Na mesma página **API Setup**, em **To** (ou equivalente), abre **Manage phone number list** (ou “lista de números de teste”).
2. Adiciona o **teu número pessoal** de WhatsApp (com indicativo). Recebes um **código no WhatsApp** para confirmar.
3. Sem este passo, a Joana **não** consegue enviar-te respostas a partir da API de teste.

---

### 4. Ficheiro `.env` no projeto

1. Na raiz do repositório, copia `.env.example` para `.env` (o ficheiro `.env` **não** deve ir para o Git).
2. No painel **WhatsApp → API Setup**, copia:
   - **Temporary access token** → `WHATSAPP_TOKEN=...`
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID=...`
3. Escolhe um **verify token** à tua escolha (uma palavra-passe só tua) → `WHATSAPP_VERIFY_TOKEN=...` (no exemplo antigo usava-se `joana-local-dev`; em produção usa algo **único e forte**).
4. No painel da app: **Settings** → **Basic** → copia o **App Secret** (não o confundas com o token de mensagens) → `WHATSAPP_APP_SECRET=...` (o servidor valida o webhook com isto).
5. Opcional: `OPENAI_API_KEY` se quiseres transcrever **áudio** recebido no WhatsApp.

---

### 5. Servidor com HTTPS (obrigatório para o webhook)

A Meta **não** chama `http://localhost`. Tens de expor o teu `node` num URL **HTTPS** público.

**Opção A — Cloud 24/7 (recomendado, não precisas do PC ligado)**  
Segue a secção **«Alojamento 24/7 na cloud»** mais abaixo neste README: por exemplo **Render** com `render.yaml`, comando **`npm run start:prod`**, variáveis de ambiente iguais ao `.env`. Anota o URL, ex.: `https://joana-xxxx.onrender.com`.

**Opção B — Teste rápido no teu PC**  
Corre `node src/server.js` e usa um **túnel** (ngrok, Cloudflare Tunnel, etc.) que aponte para `http://localhost:3000` e te dê um `https://…`.

---

### 6. Webhook na Meta

1. Na app: **WhatsApp** → **Configuration** (ou **API Setup**, conforme a interface) → secção **Webhook**.
2. **Callback URL:** `https://O_TEU_DOMINIO/webhook` (sem barra no fim; substitui pelo URL da Render ou do túnel).
3. **Verify token:** o **mesmo** texto que puseste em `WHATSAPP_VERIFY_TOKEN` no `.env` / painel da cloud.
4. Clica em **Verify and save** (a Meta faz um pedido `GET` ao teu servidor; o endpoint `/webhook` tem de estar acessível).
5. Em **Webhook fields**, subscreve pelo menos **`messages`** (e o que mais precisares).

---

### 7. Testar no WhatsApp

1. No telemóvel onde adicionaste o número na **lista de teste**, abre o **WhatsApp**.
2. Envia uma mensagem para o **número de teste** que a Meta mostra na **API Setup** (não é o teu número pessoal — é o número “From” / business de teste da app).
3. Escreve por exemplo **`olá`**. A Joana deve responder com as **boas-vindas** e o questionário inicial.

Se der **401** ou erro de autenticação, renova o **Temporary access token** no painel e atualiza `WHATSAPP_TOKEN` no `.env` / variáveis da cloud, e reinicia o serviço.

---

### 8. Depois: produção “a sério”

- Passa o fluxo de **número Business** e **verificação comercial** que a Meta pedir para sair do modo só-teste.
- Usa **token de longa duração** (fluxo System User, etc.), não só o token temporário do painel.
- Primeira mensagem **iniciada por ti** para clientes que nunca falaram contigo costuma exigir **template** aprovado — vê a [documentação de opt-in](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/) e a nota no README sobre templates.

---

## Como correr

```bash
node src/server.js
```

O servidor abre por defeito em `http://localhost:3000`. A página inicial (`/`) é a **adesão pública**; o webhook da Meta continua em `/webhook`.

### Arranque em modo produção

Usa isto no servidor alojado (Render, Railway, VPS, etc.):

```bash
npm run start:prod
```

Isto define `NODE_ENV=production`: **desliga** `/dev`, `/dev/message` e `/demo.html` (a não ser que cries `JOANA_DEV_CHAT=1`). No arranque, o processo avisa se faltarem `WHATSAPP_APP_SECRET` ou um `WHATSAPP_VERIFY_TOKEN` forte.

Também tens uma demo visual **só para desenvolvimento** (`demo.html`), servida em `/demo.html` quando o modo dev está ativo, ou abrindo o ficheiro diretamente no browser.

## Configuração

Copia `.env.example` para `.env` e preenche os dados do fornecedor de WhatsApp.

Para áudio, acrescenta também:

```text
OPENAI_API_KEY=coloca_a_chave_aqui
```

## Como o WhatsApp chega ao agente

O WhatsApp não dá acesso direto a uma conta pessoal normal. A Joana precisa de falar através da WhatsApp Business Platform, usando a Cloud API da Meta ou um intermediário como Twilio.

O caminho é este:

```text
Pedro no WhatsApp
  -> número WhatsApp Business
  -> webhook público do teu servidor
  -> agente Joana
  -> API do WhatsApp
  -> mensagem de volta ao Pedro
```

Para isto funcionar fora do teu computador, o servidor tem de estar publicado num endereço HTTPS, por exemplo:

```text
https://joana-o-teu-dominio.com/webhook
```

Em desenvolvimento podes usar um túnel como ngrok ou Cloudflare Tunnel. Para **24 horas por dia sem ligar o teu PC ou telemóvel**, aloja o Node num serviço na cloud — vê a secção **Alojamento 24/7 na cloud** abaixo.

Nota importante: se a Joana for a primeira a mandar mensagem ao Pedro, o WhatsApp exige uma mensagem template aprovada pela Meta. Depois de o Pedro responder, abre-se a janela normal de conversa e a Joana pode mandar mensagens livres durante essa janela.

### Checklist “produto” na Meta (não é “modo teste” da app)

1. **Conta comercial** e número WhatsApp Business **live** (ou processo de verificação concluído, conforme a Meta).
2. **Token** de longa duração adequado (System User / fluxo suportado pela Meta), não só o token temporário do painel.
3. **Webhook** em HTTPS com `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_APP_SECRET` configurados neste projeto.
4. **Opt-in** e **templates** para mensagens iniciadas por ti (ex.: formulário em `/` + `POST /api/join`), conforme a [documentação de opt-in](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/) da Meta.

O código da Joana já está preparado para conversas reais; o que distingue “teste” de “produto” é sobretudo **a configuração e aprovação na Meta**, não uma flag no repositório.

## Alojamento 24/7 na cloud (PC e telemóvel podem estar desligados)

A Joana corre **no servidor remoto**, não no teu telemóvel. O teu computador e o teu telemóvel pessoal **podem estar desligados**; o que tem de estar sempre ligado é o **serviço na internet** onde publicaste o `node`.

### Primeiros passos na Render (rápido)

1. Cria conta em [https://render.com](https://render.com) e autoriza o GitHub.
2. **New +** → **Blueprint** → escolhe o repositório com este projeto (ficheiro `render.yaml` na raiz).
3. Em **Environment** do serviço, cola as variáveis do teu `.env` (pelo menos `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`; opcional `OPENAI_API_KEY`, `JOANA_DATA_DIR`, etc.).
4. Faz **deploy** e espera o estado **Live**.
5. Na Meta, define o callback do webhook como **`https://o-url-que-a-render-te-deu.onrender.com/webhook`** (o mesmo `WHATSAPP_VERIFY_TOKEN` que puseste no painel).
6. Se mais tarde quiseres lembretes que **sobrevivam** a redeploys, configura disco persistente + `JOANA_DATA_DIR` (explicado mais abaixo).

### Outras plataformas (Railway, Fly.io, VPS…)

O fluxo é o mesmo que na Render: repositório Git, serviço **Node**, comando **`npm run start:prod`**, variáveis de ambiente como no `.env.example`, URL **HTTPS** público e webhook na Meta em **`https://o-teu-dominio/webhook`** com o mesmo `WHATSAPP_VERIFY_TOKEN`.

### Render (detalhe e limites do plano free)

Na [Render](https://render.com) também podes criar **Web Service** manual (sem Blueprint): **Build** `npm install`, **Start** `npm run start:prod`. A Render injeta `PORT` automaticamente.

**Plano free:** o serviço pode **hibernar** após inatividade; o primeiro pedido depois disso demora mais uns segundos (cold start). Para WhatsApp a sério, costuma valer a pena um plano **que não durma** ou um mínimo sempre ligado.

**Dados (`store.json`):** no disco efémero de muitos hosts **gratuitos**, os ficheiros podem **perder-se** ao reiniciar ou fazer novo deploy. Para lembretes não desaparecerem:

- Define **`JOANA_DATA_DIR`** para uma pasta num **disco persistente** que a plataforma permita montar (na Render isso costuma ser opção paga), **ou**
- Liga mais tarde uma **base de dados** (Postgres, etc.) em vez de só ficheiro.

Variável opcional no `.env` / painel:

```text
JOANA_DATA_DIR=/caminho/para/pasta/persistente
```

### Railway / Fly.io

Ideia idêntica: serviço **Node**, comando **`npm run start:prod`**, mesmas variáveis de ambiente, HTTPS público, webhook na Meta apontado para `/webhook`.

### WhatsApp Cloud API

Usa:

- `WHATSAPP_PROVIDER=cloud`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET` (App Secret no painel da app, separado do token de API) — **recomendado em produção**: o servidor valida o cabeçalho `X-Hub-Signature-256` em cada `POST /webhook` e rejeita pedidos falsos.

No painel da Meta, configura o webhook para:

```text
https://o-teu-dominio.com/webhook
```

O token de verificação deve ser igual a `WHATSAPP_VERIFY_TOKEN`.

### Twilio

Usa:

- `WHATSAPP_PROVIDER=twilio`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM`

Configura o webhook de mensagens recebidas para:

```text
https://o-teu-dominio.com/webhook/twilio
```

## Teste local simples (só com modo dev)

Com `NODE_ENV` diferente de `production` (ou com `JOANA_DEV_CHAT=1`), o endpoint `/dev/message` simula o WhatsApp:

```bash
curl -X POST http://localhost:3000/dev/message \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"15550100001\",\"text\":\"olá\"}"
```

O valor `from` acima é **fictício** (prefixo internacional 555-01xx reservado a exemplos; não uses números reais de terceiros como placeholder no código).

As respostas aparecem no terminal quando não há credenciais reais configuradas.

## Dados guardados

A pasta `data/` no projeto (ou `JOANA_DATA_DIR` na cloud) guarda o estado. A entrada `data/` está no `.gitignore` para não subires dados de clientes para o Git. É simples de trocar depois por uma base de dados.

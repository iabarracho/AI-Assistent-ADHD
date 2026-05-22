# Joana no Telegram (canal oficial)

A mesma agente (onboarding, hábitos, lembretes). Sem Meta, sem PC ligado, sem telemóvel — só a **Render** e um bot no Telegram.

## 1. Criar o bot

1. No Telegram, abre **@BotFather**.
2. Envia `/newbot`.
3. Nome visível (ex. `Joana`).
4. Username (tem de acabar em `bot`, ex. `joana_pedro_bot`).
5. Copia o **token** (formato `123456789:AAH...`).

## 2. Render — variáveis de ambiente

No serviço **joana** → **Environment**:

| Variável | Valor |
|----------|--------|
| `JOANA_MESSENGER` | `telegram` |
| `TELEGRAM_BOT_TOKEN` | token do BotFather |
| `OPENAI_API_KEY` | (opcional, para áudio no futuro; lembretes funcionam sem) |

Opcional:

| Variável | Valor |
|----------|--------|
| `TELEGRAM_BOT_USERNAME` | `joana_pedro_bot` (sem @) — link na página `/` antes do getMe |
| `JOANA_DATA_DIR` | pasta persistente se tiveres disco na Render |

Podes **remover** ou ignorar as vars WhatsApp (`JOANA_MESSENGER=baileys` etc.) — não são necessárias no Telegram.

**Save** → **Manual Deploy** (ou espera redeploy automático).

## 3. Confirmar que está vivo

1. Logs: `[Joana] Telegram ativo — @teu_bot (long polling)`.
2. Browser: `https://joana-puwe.onrender.com/health`  
   - `"messenger": "telegram"`  
   - `"telegram": { "botToken": true, "botLink": "https://t.me/..." }`
3. Página: `https://joana-puwe.onrender.com/` — instruções + botão **Abrir no Telegram**.

## 4. Testar (tu)

1. Telegram → procura `@teu_bot` ou abre o link `t.me/...`.
2. Manda **`olá`**.
3. A Joana deve responder com as mensagens de boas-vindas e o questionário.

## Texto para o Pedro ver no Telegram (BotFather)

No **@BotFather** → `/mybots` → teu bot → **Edit Bot**:

**Description** (copiar):

```
Joana — lembretes e conversa com piada (presente personalizado).

Regras: manda "ajuda" no chat.
Lembretes: "lembra-me de …" ou "lembra-me de … às 18h".
Primeira vez: segue o onboarding (hábitos + hora local); não repetes todos os dias.
```

**About** (curto):

```
Lembretes no Telegram. Escreve "ajuda" para regras.
```

**Commands** (opcional, `/setcommands`):

```
ajuda - Regras e como usar
regras - Igual a ajuda
```

No chat, **ajuda** / **regras** também mostram o menu (código da Joana).

## OpenAI na Render

Variável `OPENAI_API_KEY` — hoje serve sobretudo para **transcrever áudios no WhatsApp**. No **Telegram**, as mensagens são texto; a Joana **não** usa ChatGPT para conversar (só as frases que estão programadas). Podes colocar a chave na Render; não muda muito o Telegram até haver áudio/IA extra.

## 5. Dar ao Pedro

Texto simples:

> Instala o Telegram (se não tiveres). Abre este link: **https://t.me/TEU_BOT** e manda **olá**. É a Joana — lembretes e aquela conversa.

## Lembretes à hora certa

1. **Fuso horário:** a Joana **pergunta no onboarding** (ou respondes **sim** = Lisboa). Cada pessoa tem o fuso guardado — a hora do lembrete é a **dele**, não a do servidor. O Telegram **não** envia fuso; por isso confirmamos uma vez. Para mudar: `fuso Açores` ou `fuso Europe/London`.
2. **Como pedir:**  
   - Uma mensagem: `lembra-me de comprar pão às 18h`  
   - Ou: `lembra-me de X` → responde `18h` ou `com horário` e depois `18h`
3. **Plano free Render:** o serviço **adormece** sem tráfego. Para lembretes “daqui a 2 min”, o cron em `/health` deve ser **de 1 em 1 minuto** (ou 2 min), não de 5 em 5 — cada ping também **dispara** lembretes em atraso.
4. **Dados:** sem disco persistente na Render, um redeploy pode apagar lembretes guardados. Opção paga: disco + `JOANA_DATA_DIR`.

Nos logs, quando agenda: `[Joana] Lembrete agendado (once) …`. Quando envia: `[Joana] Lembrete a enviar …`.

## Notas

- **Plano free Render:** o serviço pode “adormecer”; a primeira mensagem depois disso pode demorar ~30 s.
- **Dados:** contactos guardados por `chat_id` do Telegram em `data/store.json` (ou `JOANA_DATA_DIR`).
- **Voltar ao WhatsApp** no futuro: `JOANA_MESSENGER=whatsapp` + vars Meta + redeploy.

# Testar a Joana no WhatsApp

## 0. Criar a app na Meta (só na primeira vez)

Antes de tudo precisas de ter uma app criada em [Meta for Developers](https://developers.facebook.com/).

Requisitos:

- Conta Facebook pessoal com telemóvel verificado e, de preferência, autenticação em dois passos ativada.
- Aceitar o registo como developer em [developers.facebook.com](https://developers.facebook.com/) (gratuito).

Passos:

1. Vai a [developers.facebook.com/apps](https://developers.facebook.com/apps/) e clica em **Create App**.
2. Em "Use case" escolhe **Connect with customers through WhatsApp** → **Next**. (Se não vires esta opção, podes escolher **Other** e adicionar o produto WhatsApp manualmente mais à frente.)
3. Dá um nome à app (ex.: `Joana Dev`) e um email de contacto. Em "Business portfolio" deixa o que aparece por defeito ou cria um novo gratuito quando te pedirem.
4. Clica em **Create app** e confirma a tua password do Facebook se for pedida.
5. A app já vem com o produto WhatsApp configurado. Vai a **WhatsApp → API Setup** no menu lateral. A Meta cria automaticamente um número de teste e mostra-te o **Temporary access token** e o **Phone number ID**.
6. Ainda na página **API Setup**, em "To", clica em **Manage phone number list** e adiciona o teu número pessoal de WhatsApp. Vais receber um código por WhatsApp para confirmar (sem este passo a Joana não te pode responder enquanto a app estiver em modo de desenvolvimento).

Feito isto já tens app + número de teste e podes seguir para o passo 1.

## 1. Dados que tens de copiar da Meta

Vai a [Meta for Developers](https://developers.facebook.com/apps/) e abre a tua app.

No produto WhatsApp, página **API Setup**, copia:

- **Temporary access token**
- **Phone number ID**

Cola esses valores no ficheiro `.env`:

```text
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
```

## 2. Arrancar o servidor

```bash
node src/server.js
```

O servidor local fica em:

```text
http://localhost:3000
```

## 3. Criar um link público

A Meta não consegue chamar `localhost`. Precisas de um túnel HTTPS, por exemplo:

- Cloudflare Tunnel
- ngrok

O túnel deve apontar para:

```text
http://localhost:3000
```

E vai dar-te um link parecido com:

```text
https://qualquer-coisa.trycloudflare.com
```

## 4. Configurar webhook na Meta

Na configuração do webhook da app Meta:

Callback URL:

```text
https://O_TEU_LINK_PUBLICO/webhook
```

Verify token:

```text
joana-local-dev
```

Depois subscreve o campo:

```text
messages
```

## 5. Testar

No WhatsApp, manda uma mensagem para o número de teste da Meta:

```text
olá
```

A Joana deve responder com as boas-vindas.

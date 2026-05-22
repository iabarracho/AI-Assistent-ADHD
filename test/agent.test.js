import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { JoanaAgent } from "../src/agent.js";
import { normalizeWaPhone, PLACEHOLDER_WA_ID, PLACEHOLDER_WA_ID_2 } from "../src/phone.js";
import { Store } from "../src/store.js";
import { parseCloudWebhook } from "../src/whatsapp.js";

test("normalizeWaPhone strips non-digits and country prefix", () => {
  assert.equal(normalizeWaPhone("+351 912 345 678"), "351912345678");
  assert.equal(normalizeWaPhone("00351912345678"), "351912345678");
  assert.equal(normalizeWaPhone("abc"), null);
});

test("startSignupWhatsApp sends welcome only for brand-new contacts", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  const agent = new JoanaAgent(store, messenger);

  const first = await agent.startSignupWhatsApp(PLACEHOLDER_WA_ID_2);
  assert.equal(first, "started");
  assert.equal(sent[0].text, "Hey cutie! Sim, ambos sabemos que a tua namorada é chata, tanta mensagem para te lembrares disto ou daquilo, mas ela só se preocupa.");
  assert.equal(store.state.contacts[PLACEHOLDER_WA_ID_2].onboardingStep, "choose_habits");

  const second = await agent.startSignupWhatsApp(PLACEHOLDER_WA_ID_2);
  assert.equal(second, "in_progress");
  assert.equal(sent.length, 3);

  store.updateContact(PLACEHOLDER_WA_ID_2, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const third = await agent.startSignupWhatsApp(PLACEHOLDER_WA_ID_2);
  assert.equal(third, "done");
  assert.equal(sent.length, 3);
});

test("Joana runs onboarding and creates reminders", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "ola");
  await agent.receive(PLACEHOLDER_WA_ID, "1, 2, 4");
  await agent.receive(PLACEHOLDER_WA_ID, "sim");
  await agent.receive(PLACEHOLDER_WA_ID, "09:00 e 21:30");
  await agent.receive(PLACEHOLDER_WA_ID, "18h");
  await agent.receive(PLACEHOLDER_WA_ID, "10:15");

  assert.equal(sent[0].text, "Hey cutie! Sim, ambos sabemos que a tua namorada é chata, tanta mensagem para te lembrares disto ou daquilo, mas ela só se preocupa.");
  assert.equal(sent[1].text, "Agora sou eu a chata, o meu nome é Joana e comigo podes chatear-te que não quero muito saber ❤️");
  assert.match(sent.at(-1).text, /Pedro/);
  assert.equal(store.state.reminders.length, 4);
  assert.equal(store.state.contacts[PLACEHOLDER_WA_ID].onboardingStep, "done");
});

test("Joana creates a two-hour repeat reminder without a specific time", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lembra-me de comprar pão");
  await agent.receive(PLACEHOLDER_WA_ID, "sem horário");

  assert.equal(store.state.reminders.length, 1);
  assert.equal(store.state.reminders[0].kind, "repeat");
  assert.equal(store.state.reminders[0].text, "comprar pão");
  assert.equal(store.state.reminders[0].maxSends, 4);
});

test("Joana uses Pedro Emanuel only on the third repeat reminder", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  const agent = new JoanaAgent(store, messenger);

  store.addReminder({
    phone: PLACEHOLDER_WA_ID,
    kind: "repeat",
    text: "comprar pão",
    nextAt: new Date(Date.now() - 1000).toISOString(),
    maxSends: 4
  });

  for (let index = 0; index < 4; index += 1) {
    const reminder = store.state.reminders[0];
    store.updateReminder(reminder.id, { nextAt: new Date(Date.now() - 1000).toISOString() });
    await agent.tick();
  }

  assert.match(sent[0].text, /^Pedro,/);
  assert.match(sent[1].text, /^Pedro,/);
  assert.match(sent[2].text, /^Pedro Emanuel,/);
  assert.match(sent[3].text, /^Pedro,/);
  assert.equal(new Set(sent.map((message) => message.text)).size, sent.length);
});

test("Joana avoids repeating the same dynamic reply twice in a row", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "hmm");
  await agent.receive(PLACEHOLDER_WA_ID, "hmm");

  assert.equal(sent.length, 2);
  assert.notEqual(sent[0].text, sent[1].text);
});

test("Joana keeps dynamic messages short", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lembra-me de comprar pão");
  await agent.receive(PLACEHOLDER_WA_ID, "sem horário");

  const reminder = store.state.reminders[0];
  for (let index = 0; index < 4; index += 1) {
    store.updateReminder(reminder.id, { nextAt: new Date(Date.now() - 1000).toISOString() });
    await agent.tick();
  }

  assert.ok(sent.every((message) => message.text.length <= 95));
});

test("Joana understands messy reminder spelling", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "leba me disto");
  await agent.receive(PLACEHOLDER_WA_ID, "sem horário");

  assert.equal(store.state.reminders.length, 1);
  assert.equal(store.state.reminders[0].text, "disto");
  assert.equal(store.state.reminders[0].kind, "repeat");
});

test("Joana corrects spelling in saved reminders", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lemb me de comprar pao");
  await agent.receive(PLACEHOLDER_WA_ID, "sem horário");

  assert.equal(store.state.reminders[0].text, "comprar pão");
  assert.ok(sent.some((message) => message.text.includes("comprar pão")));
});

test("Joana asks whether a reminder has a defined time", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lembra-me de beber agua");

  assert.match(sent.at(-1).text, /com ou sem horário definido/i);
});

test("Joana does not treat vague answers as no defined time", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lembra-me de comprar pao");
  await agent.receive(PLACEHOLDER_WA_ID, "ok depois vejo");

  assert.equal(store.state.reminders.length, 0);
  assert.equal(store.state.contacts[PLACEHOLDER_WA_ID].pendingReminder.text, "comprar pão");
  assert.match(sent.at(-1).text, /com ou sem horário|com horário ou sem horário/i);
});

test("Joana assumes no defined time only after no reply", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lembra-me de comprar pao");
  store.updateContact(PLACEHOLDER_WA_ID, {
    pendingReminder: {
      ...store.state.contacts[PLACEHOLDER_WA_ID].pendingReminder,
      askedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString()
    }
  });
  await agent.tick();

  assert.equal(store.state.reminders.length, 1);
  assert.equal(store.state.reminders[0].kind, "repeat");
  assert.equal(store.state.reminders[0].text, "comprar pão");
  assert.equal(store.state.contacts[PLACEHOLDER_WA_ID].pendingReminder, null);
});

test("Joana schedules reminder for daqui a X minutos", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lembra-me daqui a 3 minutos de tomar agua");

  assert.equal(store.state.reminders.length, 1);
  assert.equal(store.state.reminders[0].text, "tomar água");
  assert.ok(sent.some((m) => m.text.includes("Às") && m.text.includes("tomar")));
});

test("Joana schedules once reminder in a few minutes", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lembra-me em 2 minutos de testar o bot");

  assert.equal(store.state.reminders.length, 1);
  assert.equal(store.state.reminders[0].kind, "once");
  assert.equal(store.state.reminders[0].text, "testar o bot");
  const due = new Date(store.state.reminders[0].nextAt).getTime();
  const delta = due - Date.now();
  assert.ok(delta > 60_000 && delta < 180_000, `expected ~2min, got ${delta}ms`);
});

test("Joana schedules once reminder when time is in the same message", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lembra-me de comprar pão às 18h");

  assert.equal(store.state.reminders.length, 1);
  assert.equal(store.state.reminders[0].kind, "once");
  assert.equal(store.state.reminders[0].text, "comprar pão");
  assert.equal(store.state.contacts[PLACEHOLDER_WA_ID].pendingReminder, null);
  assert.ok(sent.some((message) => message.text.includes("comprar pão")));
});

test("Joana asks for the exact time when Pedro says it has a time", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "lembra-me de beber agua");
  await agent.receive(PLACEHOLDER_WA_ID, "com horário");
  await agent.receive(PLACEHOLDER_WA_ID, "18h");

  assert.equal(store.state.reminders.length, 1);
  assert.equal(store.state.reminders[0].kind, "once");
  assert.equal(store.state.reminders[0].text, "beber água");
});

test("Joana understands alternate reminder wording", async () => {
  fs.rmSync("./data", { recursive: true, force: true });

  const sent = [];
  const messenger = {
    sendText: async (to, text) => sent.push({ to, text })
  };

  const store = new Store();
  store.updateContact(PLACEHOLDER_WA_ID, { onboardingStep: "done", timezone: "Europe/Lisbon" });
  const agent = new JoanaAgent(store, messenger);

  await agent.receive(PLACEHOLDER_WA_ID, "n me deixes eskecer de ligar à Tuxa");
  await agent.receive(PLACEHOLDER_WA_ID, "18h");

  assert.equal(store.state.reminders.length, 1);
  assert.equal(store.state.reminders[0].text, "ligar à Tuxa");
  assert.equal(store.state.reminders[0].kind, "once");
});

test("WhatsApp Cloud webhook recognises incoming audio", () => {
  const messages = parseCloudWebhook({
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: PLACEHOLDER_WA_ID,
            audio: {
              id: "audio-media-id",
              mime_type: "audio/ogg"
            }
          }]
        }
      }]
    }]
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].from, PLACEHOLDER_WA_ID);
  assert.equal(messages[0].audio.id, "audio-media-id");
});

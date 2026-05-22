import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const dataDir = config.dataDir;
const storePath = path.join(dataDir, "store.json");

const defaultState = {
  contacts: {},
  reminders: []
};

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(defaultState, null, 2));
  }
}

export class Store {
  constructor() {
    ensureStore();
    this.state = this.read();
  }

  read() {
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  }

  save() {
    fs.writeFileSync(storePath, JSON.stringify(this.state, null, 2));
  }

  getContact(phone) {
    if (!this.state.contacts[phone]) {
      this.state.contacts[phone] = {
        phone,
        onboardingStep: "new",
        timezone: null,
        selectedHabits: [],
        pendingHabitIndex: 0,
        pendingReminder: null,
        createdAt: new Date().toISOString()
      };
      this.save();
    }

    return this.state.contacts[phone];
  }

  updateContact(phone, patch) {
    const contact = this.getContact(phone);
    Object.assign(contact, patch);
    this.save();
    return contact;
  }

  addReminder(reminder) {
    this.state.reminders.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      active: true,
      sentCount: 0,
      ...reminder
    });
    this.save();
  }

  updateReminder(id, patch) {
    const reminder = this.state.reminders.find((item) => item.id === id);
    if (!reminder) return null;
    Object.assign(reminder, patch);
    this.save();
    return reminder;
  }

  dueReminders(now = new Date()) {
    return this.state.reminders.filter((reminder) => {
      if (!reminder.active || !reminder.nextAt) return false;
      return new Date(reminder.nextAt) <= now;
    });
  }
}

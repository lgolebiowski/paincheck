import type { DbStore } from './db';
import type { PendingReminder, StoredSubscription } from './types';

/** Storage for subscriptions and pending reminders. Implemented by a JSON file (local) and DynamoDB (AWS). */
export interface Repo {
  listSubscriptions(): Promise<StoredSubscription[]>;
  putSubscription(sub: StoredSubscription): Promise<void>;
  deleteSubscription(endpoint: string): Promise<void>;
  putReminder(r: PendingReminder): Promise<void>;
  getReminder(id: string): Promise<PendingReminder | null>;
  listReminders(): Promise<PendingReminder[]>;
  /** Atomically removes a reminder. Returns true only for the caller that actually removed it. */
  deleteReminder(id: string): Promise<boolean>;
  /** Removes all pending reminders, returning how many there were. */
  deleteAllReminders(): Promise<number>;
}

/** Repo over the JSON-file DbStore (also used in memory for tests). */
export function createFileRepo(store: DbStore): Repo {
  return {
    async listSubscriptions() {
      return [...store.get().subscriptions];
    },
    async putSubscription(sub) {
      const db = store.get();
      db.subscriptions = [...db.subscriptions.filter((s) => s.endpoint !== sub.endpoint), sub];
      store.save();
    },
    async deleteSubscription(endpoint) {
      const db = store.get();
      db.subscriptions = db.subscriptions.filter((s) => s.endpoint !== endpoint);
      store.save();
    },
    async putReminder(r) {
      const db = store.get();
      db.reminders = [...db.reminders.filter((x) => x.id !== r.id), r];
      store.save();
    },
    async getReminder(id) {
      return store.get().reminders.find((r) => r.id === id) ?? null;
    },
    async listReminders() {
      return [...store.get().reminders];
    },
    async deleteReminder(id) {
      const db = store.get();
      const had = db.reminders.some((r) => r.id === id);
      db.reminders = db.reminders.filter((r) => r.id !== id);
      if (had) store.save();
      return had;
    },
    async deleteAllReminders() {
      const db = store.get();
      const n = db.reminders.length;
      db.reminders = [];
      store.save();
      return n;
    },
  };
}

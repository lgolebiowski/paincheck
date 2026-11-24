import { randomUUID } from 'node:crypto';
import type { DbStore } from './db';
import { reminderPayload } from './messages';
import type { DrugCode, PendingReminder, PushError, PushSender, StoredSubscription } from './types';

export const REMINDER_DELAY_MS = 30 * 60_000;
export const SNOOZE_MS = 10 * 60_000;
/** A reminder for a dose logged this long after it was due is not worth sending. */
const STALE_MS = 10 * 60_000;

export class ReminderService {
  constructor(
    private readonly store: DbStore,
    private readonly send: PushSender,
    private readonly now: () => number = Date.now,
  ) {}

  addSubscription(sub: StoredSubscription): void {
    const db = this.store.get();
    db.subscriptions = [...db.subscriptions.filter((s) => s.endpoint !== sub.endpoint), sub];
    this.store.save();
  }

  removeSubscription(endpoint: string): void {
    const db = this.store.get();
    db.subscriptions = db.subscriptions.filter((s) => s.endpoint !== endpoint);
    this.store.save();
  }

  /** Schedules the "30 min after dose" reminder. Returns it, or null if already stale. */
  scheduleForDose(drug: DrugCode, doseAt: number): PendingReminder | null {
    const dueAt = doseAt + REMINDER_DELAY_MS;
    if (dueAt < this.now() - STALE_MS) return null;
    const r: PendingReminder = { id: randomUUID(), dueAt, kind: 'dose', drug };
    const db = this.store.get();
    db.reminders = [...db.reminders, r];
    this.store.save();
    return r;
  }

  /** The patient has recorded their pain: pending reminders are no longer needed. */
  cancelAll(): number {
    const db = this.store.get();
    const n = db.reminders.length;
    db.reminders = [];
    this.store.save();
    return n;
  }

  /** Replaces pending reminders with a single one SNOOZE_MS from now. */
  snooze(): PendingReminder {
    const r: PendingReminder = { id: randomUUID(), dueAt: this.now() + SNOOZE_MS, kind: 'snooze' };
    const db = this.store.get();
    db.reminders = [r];
    this.store.save();
    return r;
  }

  /** Sends all due reminders to every subscription; drops subscriptions the push service says are gone. */
  async tick(): Promise<void> {
    const db = this.store.get();
    const now = this.now();
    const due = db.reminders.filter((r) => r.dueAt <= now);
    if (due.length === 0) return;
    // Remove first so an overlapping tick or a crash mid-send cannot double-send.
    db.reminders = db.reminders.filter((r) => r.dueAt > now);
    this.store.save();
    for (const r of due) await this.broadcast(r.drug);
  }

  /** Immediate push to everyone, used by the test endpoint. */
  async broadcast(drug?: DrugCode): Promise<number> {
    const subs = [...this.store.get().subscriptions];
    const gone: string[] = [];
    let ok = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await this.send(s, reminderPayload(s.lang, drug));
          ok++;
        } catch (e) {
          const code = (e as PushError).statusCode;
          if (code === 404 || code === 410) gone.push(s.endpoint);
          else console.error('push failed', code ?? '', (e as Error).message);
        }
      }),
    );
    if (gone.length) {
      const db = this.store.get();
      db.subscriptions = db.subscriptions.filter((s) => !gone.includes(s.endpoint));
      this.store.save();
    }
    return ok;
  }
}

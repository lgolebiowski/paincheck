import { randomUUID } from 'node:crypto';
import { reminderPayload } from './messages';
import type { Repo } from './repo';
import type { DrugCode, PendingReminder, PushError, PushSender, StoredSubscription } from './types';

export const DEFAULT_REMINDER_DELAY_MS = 30 * 60_000;
export const SNOOZE_MS = 10 * 60_000;
/** A reminder for a dose logged this long after it was due is not worth sending. */
const STALE_MS = 10 * 60_000;

/** Arranges for `service.fire(reminder.id)` to run (in-process locally, async Lambda self-invoke on AWS). */
export type Dispatch = (reminder: PendingReminder) => Promise<void>;

export interface ReminderDeps {
  repo: Repo;
  send: PushSender;
  dispatch: Dispatch;
  /** Delay between a dose and its reminder. */
  delayMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class ReminderService {
  private readonly repo: Repo;
  private readonly send: PushSender;
  private readonly dispatch: Dispatch;
  readonly delayMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(d: ReminderDeps) {
    this.repo = d.repo;
    this.send = d.send;
    this.dispatch = d.dispatch;
    this.delayMs = d.delayMs ?? DEFAULT_REMINDER_DELAY_MS;
    this.now = d.now ?? Date.now;
    this.sleep = d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  addSubscription(sub: StoredSubscription): Promise<void> {
    return this.repo.putSubscription(sub);
  }

  removeSubscription(endpoint: string): Promise<void> {
    return this.repo.deleteSubscription(endpoint);
  }

  /** Schedules the reminder after a dose. Returns it, or null if already stale. */
  async scheduleForDose(drug: DrugCode, doseAt: number): Promise<PendingReminder | null> {
    const dueAt = doseAt + this.delayMs;
    if (dueAt < this.now() - STALE_MS) return null;
    const r: PendingReminder = { id: randomUUID(), dueAt, kind: 'dose', drug };
    await this.repo.putReminder(r);
    await this.dispatch(r);
    return r;
  }

  /** The patient has recorded their pain: pending reminders are no longer needed. */
  cancelAll(): Promise<number> {
    return this.repo.deleteAllReminders();
  }

  /** Replaces pending reminders with a single one SNOOZE_MS from now. */
  async snooze(): Promise<PendingReminder> {
    await this.repo.deleteAllReminders();
    const r: PendingReminder = { id: randomUUID(), dueAt: this.now() + SNOOZE_MS, kind: 'snooze' };
    await this.repo.putReminder(r);
    await this.dispatch(r);
    return r;
  }

  /**
   * Waits until the reminder is due, then sends it, unless it was cancelled or snoozed meanwhile.
   * Safe to run more than once for the same id: only the caller that removes the reminder sends.
   */
  async fire(id: string): Promise<boolean> {
    const r = await this.repo.getReminder(id);
    if (!r) return false;
    const wait = r.dueAt - this.now();
    if (wait > 0) await this.sleep(wait);
    if (!(await this.repo.deleteReminder(id))) return false;
    await this.broadcast(r.drug);
    return true;
  }

  /** Re-arms reminders that were pending when a long-running local process restarted. */
  async resumePending(): Promise<void> {
    for (const r of await this.repo.listReminders()) await this.dispatch(r);
  }

  /** Immediate push to everyone. Subscriptions the push service reports as gone are removed. */
  async broadcast(drug?: DrugCode): Promise<number> {
    const subs = await this.repo.listSubscriptions();
    const gone: string[] = [];
    let ok = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await this.send(s, reminderPayload(s.lang, drug, this.delayMs));
          ok++;
        } catch (e) {
          const code = (e as PushError).statusCode;
          if (code === 404 || code === 410) gone.push(s.endpoint);
          else console.error('push failed', code ?? '', (e as Error).message);
        }
      }),
    );
    await Promise.all(gone.map((e) => this.repo.deleteSubscription(e)));
    return ok;
  }
}

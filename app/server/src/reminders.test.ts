// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createDbStore } from './db';
import { createFileRepo } from './repo';
import { DEFAULT_REMINDER_DELAY_MS, ReminderService, SNOOZE_MS } from './reminders';
import type { PendingReminder, PushPayload, StoredSubscription } from './types';

const sub = (n: number, lang: 'en' | 'pl' = 'en'): StoredSubscription => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'k', auth: 'a' }, lang });

function setup(delayMs = DEFAULT_REMINDER_DELAY_MS) {
  let now = 1_000_000;
  const sent: { sub: StoredSubscription; payload: PushPayload }[] = [];
  const send = vi.fn(async (s: StoredSubscription, p: PushPayload) => void sent.push({ sub: s, payload: p }));
  const dispatched: PendingReminder[] = [];
  const sleeps: number[] = [];
  const svc = new ReminderService({
    repo: createFileRepo(createDbStore(null)), send, delayMs, now: () => now,
    dispatch: async (r) => void dispatched.push(r),
    sleep: async (ms) => void (sleeps.push(ms), (now += ms)),
  });
  return { svc, sent, send, dispatched, sleeps, now: () => now, advance: (ms: number) => void (now += ms) };
}

describe('ReminderService', () => {
  it('schedules a reminder and fires it after sleeping until due, in the subscriber language', async () => {
    const t = setup();
    await t.svc.addSubscription(sub(1, 'pl'));
    const r = await t.svc.scheduleForDose('M', t.now());
    expect(t.dispatched).toEqual([r]);
    expect(await t.svc.fire(r!.id)).toBe(true);
    expect(t.sleeps).toEqual([DEFAULT_REMINDER_DELAY_MS]);
    expect(t.sent[0]!.payload.body).toContain('30 min od podania morfiny');
  });

  it('does not send twice if fired twice (claim is atomic)', async () => {
    const t = setup();
    await t.svc.addSubscription(sub(1));
    const r = await t.svc.scheduleForDose('P', t.now());
    expect(await t.svc.fire(r!.id)).toBe(true);
    expect(await t.svc.fire(r!.id)).toBe(false);
    expect(t.sent).toHaveLength(1);
  });

  it('does not send a reminder cancelled before it is due', async () => {
    const t = setup();
    await t.svc.addSubscription(sub(1));
    const r = await t.svc.scheduleForDose('P', t.now());
    expect(await t.svc.cancelAll()).toBe(1);
    expect(await t.svc.fire(r!.id)).toBe(false);
    expect(t.sent).toHaveLength(0);
  });

  it('does not schedule for a dose whose reminder is long past', async () => {
    const t = setup();
    expect(await t.svc.scheduleForDose('P', t.now() - 3 * 60 * 60_000)).toBeNull();
    expect(t.dispatched).toHaveLength(0);
  });

  it('snooze supersedes the pending dose reminder and fires after 10 min', async () => {
    const t = setup();
    await t.svc.addSubscription(sub(1));
    const dose = await t.svc.scheduleForDose('P', t.now());
    const snooze = await t.svc.snooze();
    expect(await t.svc.fire(dose!.id)).toBe(false);
    expect(await t.svc.fire(snooze.id)).toBe(true);
    expect(t.sleeps).toEqual([SNOOZE_MS]);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]!.payload.body).toContain('time for your pain check');
  });

  it('wording follows the configured delay (20 s is not "30 minutes")', async () => {
    const t = setup(20_000);
    await t.svc.addSubscription(sub(1));
    const r = await t.svc.scheduleForDose('M', t.now());
    await t.svc.fire(r!.id);
    expect(t.sleeps).toEqual([20_000]);
    expect(t.sent[0]!.payload.body).toBe('It’s time for your pain check after your morphine. Tap to record your pain level from 0 to 10.');
  });

  it('removes subscriptions the push service reports as gone, keeps others on other errors', async () => {
    const t = setup();
    await t.svc.addSubscription(sub(1));
    await t.svc.addSubscription(sub(2));
    t.send.mockImplementation(async (s) => {
      throw Object.assign(new Error('x'), { statusCode: s.endpoint.endsWith('/1') ? 410 : 500 });
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await t.svc.broadcast();
    t.send.mockResolvedValue(undefined);
    expect(await t.svc.broadcast()).toBe(1);
  });

  it('replaces a subscription with the same endpoint', async () => {
    const t = setup();
    await t.svc.addSubscription(sub(1, 'en'));
    await t.svc.addSubscription(sub(1, 'pl'));
    await t.svc.broadcast();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]!.sub.lang).toBe('pl');
  });

  it('resumePending re-dispatches reminders that survived a restart', async () => {
    const t = setup();
    const r = await t.svc.scheduleForDose('P', t.now());
    t.dispatched.length = 0;
    await t.svc.resumePending();
    expect(t.dispatched).toEqual([r]);
  });
});

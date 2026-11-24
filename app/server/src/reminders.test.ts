// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createDbStore } from './db';
import { REMINDER_DELAY_MS, ReminderService, SNOOZE_MS } from './reminders';
import type { PushPayload, StoredSubscription } from './types';

const sub = (n: number, lang: 'en' | 'pl' = 'en'): StoredSubscription => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'k', auth: 'a' }, lang });

function setup() {
  let now = 1_000_000;
  const sent: { sub: StoredSubscription; payload: PushPayload }[] = [];
  const send = vi.fn(async (s: StoredSubscription, p: PushPayload) => void sent.push({ sub: s, payload: p }));
  const svc = new ReminderService(createDbStore(null), send, () => now);
  return { svc, sent, send, advance: (ms: number) => void (now += ms), now: () => now };
}

describe('ReminderService', () => {
  it('sends a localized reminder 30 min after a dose, not before', async () => {
    const t = setup();
    t.svc.addSubscription(sub(1, 'pl'));
    t.svc.scheduleForDose('M', t.now());
    t.advance(REMINDER_DELAY_MS - 1);
    await t.svc.tick();
    expect(t.sent).toHaveLength(0);
    t.advance(1);
    await t.svc.tick();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]!.payload.body).toContain('morfiny');
    await t.svc.tick();
    expect(t.sent).toHaveLength(1); // not re-sent
  });

  it('does not schedule for a dose whose reminder is long past', () => {
    const t = setup();
    expect(t.svc.scheduleForDose('P', t.now() - 3 * 60 * 60_000)).toBeNull();
  });

  it('cancelAll drops pending reminders', async () => {
    const t = setup();
    t.svc.addSubscription(sub(1));
    t.svc.scheduleForDose('P', t.now());
    expect(t.svc.cancelAll()).toBe(1);
    t.advance(REMINDER_DELAY_MS);
    await t.svc.tick();
    expect(t.sent).toHaveLength(0);
  });

  it('snooze replaces pending reminders and fires after 10 min', async () => {
    const t = setup();
    t.svc.addSubscription(sub(1));
    t.svc.scheduleForDose('P', t.now());
    t.svc.snooze();
    t.advance(SNOOZE_MS);
    await t.svc.tick();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]!.payload.body).not.toContain('30 minutes');
  });

  it('removes subscriptions the push service reports as gone, keeps others on other errors', async () => {
    const t = setup();
    t.svc.addSubscription(sub(1));
    t.svc.addSubscription(sub(2));
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
    t.svc.addSubscription(sub(1, 'en'));
    t.svc.addSubscription(sub(1, 'pl'));
    await t.svc.broadcast();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]!.sub.lang).toBe('pl');
  });
});

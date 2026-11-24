// @vitest-environment node
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { createDbStore } from './db';
import { ReminderService } from './reminders';

function setup() {
  const send = vi.fn(async () => {});
  const svc = new ReminderService(createDbStore(null), send, () => 1000);
  return { app: createApp(svc, 'PUBKEY', () => 1000), send };
}
const validSub = { subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'a', auth: 'b' } }, lang: 'pl' };

describe('API', () => {
  it('serves the public key', async () => {
    expect((await request(setup().app).get('/api/push/key')).body).toEqual({ publicKey: 'PUBKEY' });
  });

  it('validates subscriptions', async () => {
    const { app } = setup();
    await request(app).post('/api/push/subscribe').send({}).expect(400);
    await request(app).post('/api/push/subscribe').send({ subscription: { ...validSub.subscription, endpoint: 'http://insecure' } }).expect(400);
    await request(app).post('/api/push/subscribe').send(validSub).expect(204);
  });

  it('schedules a reminder 30 min after a dose and validates input', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/doses').send({ drug: 'M', at: 1000 }).expect(201);
    expect(res.body.reminderDueAt).toBe(1000 + 30 * 60_000);
    await request(app).post('/api/doses').send({ drug: 'X' }).expect(400);
    await request(app).post('/api/doses').send({ drug: 'P', at: 'now' }).expect(400);
  });

  it('cancels pending reminders when a reading is recorded', async () => {
    const { app } = setup();
    await request(app).post('/api/doses').send({ drug: 'P' });
    expect((await request(app).post('/api/readings').send({})).body).toEqual({ cancelled: 1 });
  });

  it('test endpoint pushes to subscribers', async () => {
    const { app, send } = setup();
    await request(app).post('/api/push/subscribe').send(validSub);
    expect((await request(app).post('/api/push/test')).body).toEqual({ sent: 1 });
    expect(send).toHaveBeenCalledOnce();
  });
});

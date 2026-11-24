import express, { type Express } from 'express';
import type { ReminderService } from './reminders';
import type { DrugCode, Lang, StoredSubscription } from './types';

const isLang = (x: unknown): x is Lang => x === 'en' || x === 'pl';
const isDrug = (x: unknown): x is DrugCode => x === 'P' || x === 'M';
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length < 2048;

function parseSubscription(body: unknown): StoredSubscription | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; lang?: unknown };
  const s = b.subscription;
  if (!s || !isStr(s.endpoint) || !s.keys || !isStr(s.keys.p256dh) || !isStr(s.keys.auth)) return null;
  if (!s.endpoint.startsWith('https://')) return null;
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, lang: isLang(b.lang) ? b.lang : 'en' };
}

export function createApp(service: ReminderService, vapidPublicKey: string, now: () => number = Date.now): Express {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/push/key', (_req, res) => {
    res.json({ publicKey: vapidPublicKey });
  });

  app.post('/api/push/subscribe', (req, res) => {
    const sub = parseSubscription(req.body);
    if (!sub) return void res.status(400).json({ error: 'invalid subscription' });
    service.addSubscription(sub);
    res.status(204).end();
  });

  app.post('/api/push/unsubscribe', (req, res) => {
    const endpoint = (req.body as { endpoint?: unknown } | undefined)?.endpoint;
    if (!isStr(endpoint)) return void res.status(400).json({ error: 'invalid endpoint' });
    service.removeSubscription(endpoint);
    res.status(204).end();
  });

  app.post('/api/push/test', async (_req, res) => {
    res.json({ sent: await service.broadcast() });
  });

  app.post('/api/doses', (req, res) => {
    const b = (req.body ?? {}) as { drug?: unknown; at?: unknown };
    if (!isDrug(b.drug)) return void res.status(400).json({ error: 'invalid drug' });
    const at = b.at === undefined ? now() : b.at;
    if (typeof at !== 'number' || !Number.isFinite(at)) return void res.status(400).json({ error: 'invalid at' });
    const r = service.scheduleForDose(b.drug, at);
    res.status(201).json({ reminderDueAt: r?.dueAt ?? null });
  });

  app.post('/api/readings', (_req, res) => {
    res.json({ cancelled: service.cancelAll() });
  });

  app.post('/api/reminders/snooze', (_req, res) => {
    res.json({ dueAt: service.snooze().dueAt });
  });

  return app;
}

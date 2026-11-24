import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import * as webpush from 'web-push';
import { createApp } from './app';
import { createDbStore } from './db';
import { createFileRepo } from './repo';
import { DEFAULT_REMINDER_DELAY_MS, ReminderService } from './reminders';
import { createSender } from './sender';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? resolve(here, '../data');
const PORT = Number(process.env.PORT ?? 8787);

function loadVapid(): { publicKey: string; privateKey: string } {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const file = join(DATA_DIR, 'vapid.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  console.log(`Generated VAPID keys in ${file}`);
  return keys;
}

const vapid = loadVapid();
const send = createSender(webpush, { subject: process.env.VAPID_SUBJECT ?? 'https://localhost', ...vapid });

const service: ReminderService = new ReminderService({
  repo: createFileRepo(createDbStore(join(DATA_DIR, 'db.json'))),
  send,
  delayMs: Number(process.env.REMINDER_DELAY_MS ?? DEFAULT_REMINDER_DELAY_MS),
  // In-process: wait for the due time, then send.
  dispatch: async (r) => void service.fire(r.id).catch((e) => console.error('fire failed', e)),
});
void service.resumePending();

const app = createApp(service, vapid.publicKey);

const dist = resolve(here, '../../dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => void res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`Pain check server on http://localhost:${PORT}`));

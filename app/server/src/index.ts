import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createRequire } from 'node:module';
import { createApp } from './app';
import { createDbStore } from './db';
import { ReminderService } from './reminders';
import type { PushSender } from './types';

// web-push is CommonJS and has no usable ESM default export under Node/tsx.
const webpush = createRequire(import.meta.url)('web-push') as typeof import('web-push');

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
webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'https://localhost', vapid.publicKey, vapid.privateKey);

const send: PushSender = async (sub, payload) => {
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 60 * 60 });
};

const service = new ReminderService(createDbStore(join(DATA_DIR, 'db.json')), send);
const app = createApp(service, vapid.publicKey);

const dist = resolve(here, '../../dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => void res.sendFile(join(dist, 'index.html')));
}

setInterval(() => void service.tick().catch((e) => console.error('tick failed', e)), 15_000);
app.listen(PORT, () => console.log(`Pain check server on http://localhost:${PORT}`));

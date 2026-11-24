import type { ReminderService } from './reminders';
import type { DrugCode, Lang, StoredSubscription } from './types';

export interface ApiRequest { method: string; path: string; body: unknown }
export interface ApiResponse { status: number; body?: unknown }
export type Router = (req: ApiRequest) => Promise<ApiResponse>;

const isLang = (x: unknown): x is Lang => x === 'en' || x === 'pl';
const isDrug = (x: unknown): x is DrugCode => x === 'P' || x === 'M';
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length < 2048;
const bad = (error: string): ApiResponse => ({ status: 400, body: { error } });

function parseSubscription(body: unknown): StoredSubscription | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; lang?: unknown };
  const s = b.subscription;
  if (!s || !isStr(s.endpoint) || !s.keys || !isStr(s.keys.p256dh) || !isStr(s.keys.auth)) return null;
  if (!s.endpoint.startsWith('https://')) return null;
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, lang: isLang(b.lang) ? b.lang : 'en' };
}

/** Framework-free API, shared by the local Express server and the Lambda handler. */
export function createRouter(service: ReminderService, getPublicKey: () => Promise<string>, now: () => number = Date.now): Router {
  return async ({ method, path, body }) => {
    const route = `${method.toUpperCase()} ${path.replace(/\/+$/, '')}`;
    const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    switch (route) {
      case 'GET /api/push/key':
        return { status: 200, body: { publicKey: await getPublicKey() } };
      case 'POST /api/push/subscribe': {
        const sub = parseSubscription(body);
        if (!sub) return bad('invalid subscription');
        await service.addSubscription(sub);
        return { status: 204 };
      }
      case 'POST /api/push/unsubscribe':
        if (!isStr(b.endpoint)) return bad('invalid endpoint');
        await service.removeSubscription(b.endpoint);
        return { status: 204 };
      case 'POST /api/push/test':
        return { status: 200, body: { sent: await service.broadcast() } };
      case 'POST /api/doses': {
        if (!isDrug(b.drug)) return bad('invalid drug');
        const at = b.at === undefined ? now() : b.at;
        if (typeof at !== 'number' || !Number.isFinite(at)) return bad('invalid at');
        const r = await service.scheduleForDose(b.drug, at);
        return { status: 201, body: { reminderDueAt: r?.dueAt ?? null } };
      }
      case 'POST /api/readings':
        return { status: 200, body: { cancelled: await service.cancelAll() } };
      case 'POST /api/reminders/snooze':
        return { status: 200, body: { dueAt: (await service.snooze()).dueAt } };
      default:
        return { status: 404, body: { error: 'not found' } };
    }
  };
}

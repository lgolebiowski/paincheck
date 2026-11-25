import type { PushSender } from './types';

/** The part of the `web-push` library we use (it is CommonJS, so each entry point loads it its own way). */
export interface WebPushLib {
  sendNotification(
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options: { TTL: number; vapidDetails: { subject: string; publicKey: string; privateKey: string } },
  ): Promise<unknown>;
}

export interface VapidConfig { subject: string; publicKey: string; privateKey: string }

export function createSender(lib: WebPushLib, vapid: VapidConfig): PushSender {
  return async (sub, payload) => {
    await lib.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 60 * 60, vapidDetails: vapid });
  };
}

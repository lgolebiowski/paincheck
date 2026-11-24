export type Lang = 'en' | 'pl';
export type DrugCode = 'P' | 'M';

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  lang: Lang;
}

export interface PendingReminder {
  id: string;
  /** Epoch ms when the push should be sent. */
  dueAt: number;
  kind: 'dose' | 'snooze';
  /** Drug of the dose that triggered it (dose reminders only). */
  drug?: DrugCode;
}

export interface Db {
  subscriptions: StoredSubscription[];
  reminders: PendingReminder[];
}

export interface PushPayload {
  title: string;
  body: string;
  /** Path to open when the notification is tapped. */
  url: string;
  /** Label for the notification's snooze action button. */
  snoozeLabel: string;
}

/** Error shape thrown by web-push when the push service rejects a request. */
export interface PushError extends Error {
  statusCode?: number;
}

export type PushSender = (sub: StoredSubscription, payload: PushPayload) => Promise<void>;

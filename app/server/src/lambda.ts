import { timingSafeEqual } from 'node:crypto';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyStructuredResultV2, LambdaFunctionURLEvent } from 'aws-lambda';
import * as webpush from 'web-push';
import { createDynamoRepo, type VapidKeys } from './dynamo';
import { createRouter } from './router';
import { DEFAULT_REMINDER_DELAY_MS, ReminderService } from './reminders';
import { createSender } from './sender';

/** Event the function sends to itself (asynchronously) to deliver a reminder when it is due. */
interface FireEvent { action: 'fire'; reminderId: string }

const TABLE = required('TABLE_NAME');
const FUNCTION_NAME = required('AWS_LAMBDA_FUNCTION_NAME');
const ORIGIN_SECRET = process.env.ORIGIN_SECRET ?? '';
const SUBJECT = process.env.VAPID_SUBJECT ?? 'https://localhost';
const MAX_BODY_BYTES = 10_000;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

const repo = createDynamoRepo(DynamoDBDocumentClient.from(new DynamoDBClient({})), TABLE);
const lambda = new LambdaClient({});

/** Generated once on first use and shared by all instances (conditional put resolves races). */
let vapidPromise: Promise<VapidKeys> | undefined;
function getVapid(): Promise<VapidKeys> {
  vapidPromise ??= (async () => {
    const existing = await repo.getVapid();
    if (existing) return existing;
    const fresh = webpush.generateVAPIDKeys();
    return (await repo.putVapidIfAbsent(fresh)) ? fresh : ((await repo.getVapid()) ?? fresh);
  })().catch((e) => { vapidPromise = undefined; throw e; });
  return vapidPromise;
}

const service: ReminderService = new ReminderService({
  repo,
  delayMs: Number(process.env.REMINDER_DELAY_MS ?? DEFAULT_REMINDER_DELAY_MS),
  send: async (sub, payload) => {
    const vapid = await getVapid();
    await createSender(webpush, { subject: SUBJECT, ...vapid })(sub, payload);
  },
  // Hand off to a fresh invocation that sleeps until due, so this request can return immediately.
  dispatch: async (r) => {
    const event: FireEvent = { action: 'fire', reminderId: r.id };
    await lambda.send(new InvokeCommand({ FunctionName: FUNCTION_NAME, InvocationType: 'Event', Payload: JSON.stringify(event) }));
  },
});

const route = createRouter(service, async () => (await getVapid()).publicKey);

const json = (statusCode: number, body?: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

function originVerified(headers: Record<string, string | undefined>): boolean {
  if (!ORIGIN_SECRET) return true;
  const got = Buffer.from(headers['x-origin-verify'] ?? '');
  const want = Buffer.from(ORIGIN_SECRET);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function handleHttp(event: LambdaFunctionURLEvent): Promise<APIGatewayProxyStructuredResultV2> {
  if (!originVerified(event.headers)) return json(403, { error: 'forbidden' });
  let body: unknown;
  if (event.body) {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'payload too large' });
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'invalid json' }); }
  }
  try {
    const res = await route({ method: event.requestContext.http.method, path: event.rawPath, body });
    return json(res.status, res.body);
  } catch (e) {
    console.error('request failed', e);
    return json(500, { error: 'internal error' });
  }
}

export async function handler(event: LambdaFunctionURLEvent | FireEvent): Promise<APIGatewayProxyStructuredResultV2 | void> {
  if ('action' in event && event.action === 'fire') {
    await service.fire(event.reminderId);
    return;
  }
  return handleHttp(event as LambdaFunctionURLEvent);
}

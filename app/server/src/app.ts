import express, { type Express } from 'express';
import { createRouter } from './router';
import type { ReminderService } from './reminders';

/** Local development server: Express adapter over the shared router. */
export function createApp(service: ReminderService, vapidPublicKey: string, now: () => number = Date.now): Express {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  const route = createRouter(service, async () => vapidPublicKey, now);

  app.all('/api/{*splat}', (req, res, next) => {
    route({ method: req.method, path: req.path, body: req.body as unknown })
      .then(({ status, body }) => (body === undefined ? res.status(status).end() : res.status(status).json(body)))
      .catch(next);
  });
  return app;
}

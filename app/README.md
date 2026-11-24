# Pain check — POC

Vite + React + TypeScript port of the `paincheck_figma` prototype.

    npm install
    npm run dev        # web on :5173 (proxies /api) + reminder server on :8787
    npm start          # production: builds, then serves app + API on :8787
    npm test | npm run typecheck | npm run lint | npm run build

Routes: `/` pick → confirm → saved, and `/history`. (`/check` redirects to `/`.)

## Push reminders (PWA + web push)
Logging a dose (History → "Staff: record a dose") tells the server, which sends a push after `REMINDER_DELAY_MS` (default 30 minutes).
Recording a pain reading cancels pending reminders. The notification's "In 10 min" action (Android/desktop) snoozes via the server.

1. Open the app → **Turn on reminders** (prompt on the main screen; also at the bottom of History) (allow notifications). On History, use **Send test reminder** to check delivery immediately.
2. Log a dose; the push arrives after the delay. For a quick demo run with e.g. `REMINDER_DELAY_MS=20000 npm run dev:api`.

Requirements and caveats:
- Push needs **HTTPS** (localhost is exempt). To try it on a phone, serve over HTTPS (e.g. a tunnel or deployment).
- **iPhone (iOS 16.4+)**: the app must be added to the Home Screen first, then opened from there. Set `VAPID_SUBJECT` to a real `mailto:` or `https:` contact (not localhost) or Apple rejects the push.
- Server state (subscriptions, pending reminders, VAPID keys) lives in `server/data/` (git-ignored). Override with `DATA_DIR`, `PORT`, `REMINDER_DELAY_MS`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- No authentication and a single implicit patient: any client can subscribe and every subscriber gets every reminder. Not safe to expose publicly as-is.
- Readings are still stored only in the browser; the server stores no clinical data, just subscriptions and due times.

## POC decisions
- Readings and doses persist in `localStorage` (`painApp.data.v1`); first run seeds the prototype's sample data (16–19 Nov 2026). History "Reset to sample data" restores it.
- Doses are normally given by staff; the History screen has a prototype-only "Staff: record a dose" panel so the loop is demonstrable.
- History stats, spike, and per-drug effect are computed from stored data (`src/domain/history.ts`), using the prototype's rules (before ≤60 min, after ≤45 min, response window 60 min, acceptable ≤3).
- The in-app lock screen is a demo of the notification; the real one comes from web push. Patient details on History are hard-coded sample text.
- Language (EN/PL) is shared via `painApp.lang`.

## Server layout
`server/src/router.ts` is the framework-free API; `app.ts` (Express, local) and `lambda.ts` (AWS) are thin adapters over it. Storage is the `Repo` interface (`repo.ts` JSON file locally, `dynamo.ts` on AWS). `ReminderService.fire()` waits until a reminder is due, atomically claims it, then sends, so cancel and snooze work and duplicate invocations can't double-send. Deployment: see `../infra/README.md`.

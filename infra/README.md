# Pain check — AWS infrastructure (CDK, TypeScript)

Region `eu-central-1`. One stack, `PaincheckStack`:

- **S3** (private, via CloudFront OAC) + **CloudFront** serving the built frontend; extension-less paths rewrite to `index.html` (SPA routes).
- **CloudFront `/api/*` → Lambda Function URL**, so the app keeps calling same-origin `/api`. CloudFront adds an `x-origin-verify` secret header which the Lambda checks.
- **Lambda** (Node 22, arm64) running `app/server/src/lambda.ts`, and a **DynamoDB** on-demand table (subscriptions, pending reminders, VAPID keys).

## Reminder timing
`reminderDelaySeconds` (default **20**) is the dose → push delay. The Lambda that handles a dose invokes *itself* asynchronously; that invocation sleeps until due, re-checks DynamoDB (so cancel/snooze win), then sends. Because it sleeps inside Lambda, the stack refuses delays over 45 s. For the real 30-minute delay, replace the self-invoke with EventBridge Scheduler.

## Commands
    npm install
    npm test                # CDK assertions
    npm run synth           # builds the frontend, then synthesizes
    npx cdk bootstrap       # once per account/region
    npm run deploy          # -c reminderDelaySeconds=20 -c vapidSubject=mailto:you@example.com
    npm run destroy         # POC: also deletes the table and bucket contents

## Caveats
- **No authentication.** Anyone with the site URL can call the API (subscribe, log doses, trigger test pushes). The origin header only stops people hitting the Function URL directly, and it is visible in the CloudFormation template.
- The Function URL is public (`AuthType NONE`): CloudFront OAC cannot sign browser POSTs without a client-computed body hash.
- The **VAPID private key is stored in the DynamoDB table** (created on first use). Move it to Secrets Manager before real use.
- iOS push needs `vapidSubject` set to a real `mailto:`/`https:` contact (default is `https://localhost`, which Apple rejects), plus the app added to the Home Screen.
- `infra/.origin-secret` is generated on first synth and git-ignored; keep it if you redeploy from another machine (or set `ORIGIN_SECRET`).
- Default behavior caches nothing (so `sw.js`/`index.html` are always fresh); `/assets/*` is cached long. Price class 100 (EU/US/Canada edges).

import { App } from 'aws-cdk-lib';
import { loadOriginSecret } from '../lib/origin-secret';
import { PaincheckStack } from '../lib/paincheck-stack';

const app = new App();
const num = (v: unknown, d: number) => (v === undefined ? d : Number(v));

new PaincheckStack(app, 'PaincheckStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-central-1' },
  // Override with: cdk deploy -c reminderDelaySeconds=30 -c vapidSubject=mailto:you@example.com
  reminderDelaySeconds: num(app.node.tryGetContext('reminderDelaySeconds'), 20),
  vapidSubject: String(app.node.tryGetContext('vapidSubject') ?? 'https://localhost'),
  originSecret: loadOriginSecret(),
});

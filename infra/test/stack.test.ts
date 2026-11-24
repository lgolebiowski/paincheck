import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { PaincheckStack } from '../lib/paincheck-stack';

const frontendDir = mkdtempSync(join(tmpdir(), 'pc-fe-'));
writeFileSync(join(frontendDir, 'index.html'), '<html></html>');

const make = (delay = 20) =>
  new PaincheckStack(new App(), 'T', {
    env: { account: '111111111111', region: 'eu-central-1' },
    reminderDelaySeconds: delay, originSecret: 'secret', vapidSubject: 'mailto:test@example.com', frontendDir,
  });

describe('PaincheckStack', () => {
  const t = Template.fromStack(make());

  it('uses an on-demand DynamoDB table with TTL', () => {
    t.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
    });
  });

  it('configures the Lambda with the reminder delay and may invoke only itself', () => {
    t.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'paincheck-api',
      Environment: { Variables: Match.objectLike({ REMINDER_DELAY_MS: '20000', ORIGIN_SECRET: 'secret' }) },
    });
    const policies = Object.values(t.findResources('AWS::IAM::Policy'));
    const invoke = policies.flatMap((p) => p.Properties.PolicyDocument.Statement as { Action: string | string[]; Resource: unknown }[])
      .filter((st) => [st.Action].flat().includes('lambda:InvokeFunction'));
    expect(invoke).toHaveLength(1);
    const arn = JSON.stringify(invoke[0]!.Resource);
    expect(arn).toContain(':lambda:eu-central-1:111111111111:function:paincheck-api');
  });

  it('exposes a public Function URL (CloudFront authenticates with the origin header)', () => {
    t.hasResourceProperties('AWS::Lambda::Url', { AuthType: 'NONE' });
  });

  it('keeps the bucket private', () => {
    t.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    });
  });

  it('routes /api/* to the Lambda with the secret header and every HTTP method', () => {
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([Match.objectLike({
          PathPattern: '/api/*',
          AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
        })]),
        Origins: Match.arrayWith([Match.objectLike({
          OriginCustomHeaders: [{ HeaderName: 'x-origin-verify', HeaderValue: 'secret' }],
        })]),
      }),
    });
  });

  it('rejects a delay the Lambda cannot sleep through', () => {
    expect(() => make(600)).toThrow(/exceeds 45s/);
  });
});

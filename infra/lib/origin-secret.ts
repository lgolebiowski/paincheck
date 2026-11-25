import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Shared secret CloudFront sends to the Lambda so direct hits on the Function URL are rejected.
 * Taken from ORIGIN_SECRET, else from a git-ignored file generated on first use so it stays stable across deploys.
 * Note: it ends up in the CloudFormation template, so this is a speed bump, not authentication.
 */
export function loadOriginSecret(dir = resolve(import.meta.dirname, '..')): string {
  if (process.env.ORIGIN_SECRET) return process.env.ORIGIN_SECRET;
  const file = resolve(dir, '.origin-secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(24).toString('hex');
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

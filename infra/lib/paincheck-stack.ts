import { resolve } from 'node:path';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

/** The reminder Lambda sleeps until the reminder is due, so the delay must fit inside its timeout. */
export const MAX_REMINDER_DELAY_SECONDS = 45;
const FUNCTION_NAME = 'paincheck-api';
const appDir = resolve(import.meta.dirname, '../../app');

export interface PaincheckStackProps extends StackProps {
  /** Delay between a dose and its reminder push. */
  reminderDelaySeconds: number;
  /** Secret header value CloudFront sends to the Lambda. */
  originSecret: string;
  /** Contact for push services (mailto: or https: URL). Apple rejects localhost. */
  vapidSubject: string;
  /** Built frontend (vite `dist`). */
  frontendDir?: string;
}

export class PaincheckStack extends Stack {
  constructor(scope: Construct, id: string, props: PaincheckStackProps) {
    super(scope, id, props);

    if (props.reminderDelaySeconds > MAX_REMINDER_DELAY_SECONDS) {
      throw new Error(
        `reminderDelaySeconds=${props.reminderDelaySeconds} exceeds ${MAX_REMINDER_DELAY_SECONDS}s: the Lambda sleeps until the reminder is due. ` +
          'Use a scheduler (e.g. EventBridge Scheduler) for longer delays.',
      );
    }

    // --- Data -------------------------------------------------------------------------------
    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY, // POC: `cdk destroy` removes the data too
    });

    // --- API --------------------------------------------------------------------------------
    const api = new NodejsFunction(this, 'Api', {
      functionName: FUNCTION_NAME, // fixed so the function can be granted permission to invoke itself
      entry: resolve(appDir, 'server/src/lambda.ts'),
      projectRoot: appDir,
      depsLockFilePath: resolve(appDir, 'package-lock.json'),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(MAX_REMINDER_DELAY_SECONDS + 15),
      environment: {
        TABLE_NAME: table.tableName,
        REMINDER_DELAY_MS: String(props.reminderDelaySeconds * 1000),
        ORIGIN_SECRET: props.originSecret,
        VAPID_SUBJECT: props.vapidSubject,
      },
      bundling: { minify: true, sourceMap: true, target: 'node22' },
    });
    table.grantReadWriteData(api);
    api.addToRolePolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [`arn:${this.partition}:lambda:${this.region}:${this.account}:function:${FUNCTION_NAME}`],
    }));
    const apiUrl = api.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    // --- Frontend ---------------------------------------------------------------------------
    const bucket = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Client-side routes (/history, ...) have no file in S3: serve index.html for extension-less paths.
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  var last = request.uri.split('/').pop();
  if (last.indexOf('.') === -1) request.uri = '/index.html';
  return request;
}`),
    });

    const siteOrigin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: siteOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // index.html, sw.js and the manifest must always be fresh; hashed assets are cached below.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        '/assets/*': {
          origin: siteOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        },
        '/api/*': {
          origin: new origins.FunctionUrlOrigin(apiUrl, { customHeaders: { 'x-origin-verify': props.originSecret } }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(props.frontendDir ?? resolve(appDir, 'dist'))],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'ApiFunctionUrl', { value: apiUrl.url, description: 'Direct URL (rejected without the origin secret)' });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}

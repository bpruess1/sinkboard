#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack.js';
import { FrontendStack } from '../lib/frontend-stack.js';

const app = new cdk.App();

const ENVIRONMENT = process.env.ENVIRONMENT || 'staging';
const IS_PRODUCTION = ENVIRONMENT === 'production';

const ACCOUNT = process.env.CDK_DEFAULT_ACCOUNT!;
const REGION = process.env.CDK_DEFAULT_REGION || 'us-east-1';

const env = { account: ACCOUNT, region: REGION };

const stackPrefix = IS_PRODUCTION ? 'SinkBoard-Prod' : 'SinkBoard-Staging';
const domainName = IS_PRODUCTION ? 'sinkboard.com' : 'staging.sinkboard.com';

const backendStack = new BackendStack(app, `${stackPrefix}-Backend`, {
  env,
  stackName: `${stackPrefix}-Backend`,
  description: `Sink Board ${ENVIRONMENT} backend infrastructure`,
  tags: {
    Environment: ENVIRONMENT,
    Project: 'SinkBoard',
    ManagedBy: 'CDK',
  },
});

const frontendStack = new FrontendStack(app, `${stackPrefix}-Frontend`, {
  env,
  stackName: `${stackPrefix}-Frontend`,
  description: `Sink Board ${ENVIRONMENT} frontend infrastructure`,
  domainName,
  tags: {
    Environment: ENVIRONMENT,
    Project: 'SinkBoard',
    ManagedBy: 'CDK',
  },
});

frontendStack.addDependency(backendStack);

app.synth();

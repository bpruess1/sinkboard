#!/usr/bin/env node
import 'source-map-support/register.js';
import * as cdk from 'aws-cdk-lib';
import { DnsStack } from '../lib/dns-stack.js';
import { AuthStack } from '../lib/auth-stack.js';
import { ApiStack } from '../lib/api-stack.js';
import { FrontendStack } from '../lib/frontend-stack.js';

const app = new cdk.App();

const env = {
  account: '418295677815',
  region: 'us-west-1',
};

// Certificate for CloudFront must be in us-east-1
const certEnv = {
  account: '418295677815',
  region: 'us-east-1',
};

const dnsStack = new DnsStack(app, 'SinkBoard-Dns', {
  env: certEnv,
  crossRegionReferences: true,
});

const authStack = new AuthStack(app, 'SinkBoard-Auth', {
  env,
});

const apiStack = new ApiStack(app, 'SinkBoard-Api', {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
});

const frontendStack = new FrontendStack(app, 'SinkBoard-Frontend', {
  env,
  crossRegionReferences: true,
  hostedZone: dnsStack.hostedZone,
  certificate: dnsStack.certificate,
});

app.synth();

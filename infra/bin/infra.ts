#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { ComicVibeStack } from '../lib/infra-stack'

const app = new cdk.App()

new ComicVibeStack(app, 'ComicVibeStack-Dev', {
  env: {
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  stage: 'dev',
})

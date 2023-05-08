#!/usr/bin/env node
import cdk  from 'aws-cdk-lib';
import { DeployJsStack } from '../lib/deploy-js-stack.js';
import * as dotenv from 'dotenv' 
dotenv.config()

console.log(process.env.CDK_DEFAULT_ACCOUNT)
const app = new cdk.App();
new DeployJsStack(app, 'DeployJsStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '946277762357', region: 'us-west-2' },
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Stack, Duration,CfnOutput,RemovalPolicy } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import {Topic} from 'aws-cdk-lib/aws-sns';
import subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import {LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import * as dotenv from 'dotenv' 
dotenv.config()


console.log()
// const sqs = require('aws-cdk-lib/aws-sqs');
import { join } from 'path';
export class CdkstackStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    if (!process.env.DB_TABLE) throw Error('empty environment variables');


    const dynamoTable = new Table(this, 'items', {
      partitionKey: {
        name: 'chat_id',
        type: AttributeType.STRING
      },
      tableName: process.env.DB_TABLE,
      /**
       *  The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new table, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will delete the table (even if it has data in it)
       */
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    // Create sns Topic
    const snsTopic = new Topic(this, 'Topic', {
      displayName: 'chat messages topic',
    });

    const NodejsFunctionProps ={
      bundling: {
        externalModules: [
          '@aws-sdk', // Use the 'aws-sdk' available in the Lambda runtime
          // '@aws-sdk/client-sns'
        ],
        nodeModules:['openai','@larksuiteoapi/node-sdk']
      },
      environment: {
        DB_TABLE:process.env.DB_TABLE,
        LARK_APPID:process.env.LARK_APPID,
        LARK_APP_SECRET:process.env.LARK_APP_SECRET,
        LARK_TOKEN:process.env.LARK_TOKEN,
        OPENAI_API_KEY:process.env.OPENAI_API_KEY,
        START_CMD:process.env.START_CMD,
        SNS_TOPIC_ARN:snsTopic.topicArn,
      },
      runtime: Runtime.NODEJS_18_X,
    }
    const lambda_larkcallback = new NodejsFunction(this, 'larkcallback',{
      entry:join('lambda/handler_larkcallback','index.js'),
      depsLockFilePath: join('lambda/handler_larkcallback', 'package-lock.json'),
      ...NodejsFunctionProps,
    })
    const lambda_larkchat = new NodejsFunction(this, 'larkchat',{
      entry:join('lambda/handler_larkchat','index.js'),
      depsLockFilePath: join('lambda/handler_larkchat', 'package-lock.json'),
      timeout:Duration.minutes(5),
      ...NodejsFunctionProps,
    })

    // Grant the Lambda function read access to the DynamoDB table
    dynamoTable.grantReadWriteData(lambda_larkchat);

    //Add the lambda subscription
    snsTopic.addSubscription( new subscriptions.LambdaSubscription(lambda_larkchat));
    // Grant the Lambda function publish data
    snsTopic.grantPublish(lambda_larkcallback);

    // Create an API Gateway resource for each of the CRUD operations
    const api = new RestApi(this, 'LarkchatApi', {
      restApiName: 'LarkChatbot'
    });
    api.root.addMethod('POST', new LambdaIntegration(lambda_larkcallback));

    // new CfnOutput(this, 'LarkCallbackURL', {
    //   value: `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/`,
    // });

    new CfnOutput(this, 'SNS Topic Arn', {
      value: snsTopic.topicArn,
    });
  }
}

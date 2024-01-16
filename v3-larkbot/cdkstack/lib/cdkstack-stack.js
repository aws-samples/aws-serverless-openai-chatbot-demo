// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Stack, Duration,CfnOutput,RemovalPolicy } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import lambda from "aws-cdk-lib/aws-lambda";
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import {Topic} from 'aws-cdk-lib/aws-sns';
import subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import {LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import {addAutoScaling,addAutoScalingDDb} from './autoscalling.js';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from 'aws-cdk-lib/aws-sqs';
import {SqsEventSource} from 'aws-cdk-lib/aws-lambda-event-sources';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

import * as dotenv from 'dotenv' 
dotenv.config()

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

    // if (!process.env.DB_TABLE) throw Error('empty environment variables');


    const dynamoTable = new Table(this, 'items', {
      partitionKey: {
        name: 'message_id',
        type: AttributeType.STRING
      },
      // tableName: process.env.DB_TABLE,
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });
    addAutoScalingDDb(dynamoTable);

    // Create sns Topic
    const snsTopic = new Topic(this, 'Topic', {
      displayName: 'chat messages topic',
    });

    // const queue = new sqs.Queue(this, 'larkchat_sqs',{
    //   visibilityTimeout:Duration.seconds(300),
    // });


    const NodejsFunctionProps ={
      bundling: {
        externalModules: [
          '@aws-sdk', // Use the 'aws-sdk' available in the Lambda runtime
          // '@aws-sdk/client-sns'
        ],
        nodeModules:['@larksuiteoapi/node-sdk','axios']
      },
      environment: {
        DB_TABLE:dynamoTable.tableName,
        LARK_APPID:process.env.LARK_APPID,
        LARK_APP_SECRET:process.env.LARK_APP_SECRET,
        LARK_TOKEN:process.env.LARK_TOKEN,
        OPENAI_API_KEY:process.env.OPENAI_API_KEY,
        START_CMD:process.env.START_CMD,
        SNS_TOPIC_ARN:snsTopic.topicArn,
        MAIN_FUN_ARN:process.env.MAIN_FUN_ARN,
        MODEL_NAME:process.env.MODEL_NAME,
        template_id:process.env.template_id,
        multi_rounds:process.env.multi_rounds,
        use_qa:process.env.use_qa,
        max_tokens:process.env.max_tokens,
        UPLOAD_BUCKET:process.env.UPLOAD_BUCKET,
        temperature:process.env.temperature,
        use_trace:process.env.use_trace,
        hideRef:process.env.hideRef,
        welcome_message:process.env.welcome_message,
        disclaimer:process.env.disclaimer,
        LARK_CONFIG:process.env.LARK_CONFIG
        // queueUrl:queue.queueUrl,
      },
      runtime: Runtime.NODEJS_18_X,
    }
    const lambda_larkcallback = addAutoScaling(new NodejsFunction(this, 'larkcallback',{
      entry:join('lambda/handler_larkcallback','index.js'),
      depsLockFilePath: join('lambda/handler_larkcallback', 'package-lock.json'),
      memorySize: 256,
      ...NodejsFunctionProps,
    }));
    // addAutoScaling(lambda_larkcallback)
    
    const lambda_larkchat = addAutoScaling(new NodejsFunction(this, 'larkchat',{
      entry:join('lambda/handler_larkchat','index.js'),
      depsLockFilePath: join('lambda/handler_larkchat', 'package-lock.json'),
      timeout:Duration.minutes(5),
      memorySize: 256,
      ...NodejsFunctionProps,
    }));
    // addAutoScaling(this,lambda_larkchat)
    const main_fn = lambda.Function.fromFunctionArn(this,'main func',process.env.MAIN_FUN_ARN);
    main_fn.grantInvoke(lambda_larkchat);
    main_fn.grantInvoke(lambda_larkcallback);
    
    const bucket = new s3.Bucket(this, 'larkBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      bucketName:process.env.UPLOAD_BUCKET,
      cors:[{
        allowedMethods: [s3.HttpMethods.GET,s3.HttpMethods.POST,s3.HttpMethods.PUT],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }]
    });
    bucket.grantReadWrite(lambda_larkchat);

    // Grant the Lambda function read access to the DynamoDB table
    dynamoTable.grantReadWriteData(lambda_larkchat);
    dynamoTable.grantReadWriteData(lambda_larkcallback);

    //Add the lambda subscription
    snsTopic.addSubscription( new subscriptions.LambdaSubscription(lambda_larkchat));
    // Grant the Lambda function publish data
    snsTopic.grantPublish(lambda_larkcallback);
    //   // Grant Sqs 
    // queue.grantSendMessages(lambda_larkcallback);

    // // Add an event source to trigger the Lambda function when a message is added to the SQS queue
    // lambda_larkchat.addEventSource(new SqsEventSource(queue,{batchSize: 10}));
    // // Add permissions to the Lambda function to delete SQS messages
    // lambda_larkchat.addToRolePolicy(new PolicyStatement({
    //     actions: ['sqs:DeleteMessage'],
    //     resources: [queue.queueArn]
    //   }));


    // Create an API Gateway resource for each of the CRUD operations
    const api = new RestApi(this, 'LarkchatApi', {
      restApiName: 'LarkChatbot'
    });
    api.root.addMethod('POST', new LambdaIntegration(lambda_larkcallback));

    const feedback = api.root.addResource("feedback");
    feedback.addMethod("POST",  new LambdaIntegration(lambda_larkcallback));

    // new CfnOutput(this, 'LarkCallbackURL', {
    //   value: `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/`,
    // });

    new CfnOutput(this, 'SNS Topic Arn', {
      value: snsTopic.topicArn,
    });
  }
}

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Stack, Duration, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Topic } from "aws-cdk-lib/aws-sns";
import subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import {
  HttpLambdaIntegration,
  WebSocketLambdaIntegration,
} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";

import * as dotenv from "dotenv";
dotenv.config();

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { join } from "path";
export class DeployJsStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    if (!process.env.USER_TABLE) throw Error("empty environment variables");

    const config = {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    };

    const dynamoTable = new Table(this, "chat_user_info", {
      partitionKey: {
        name: "username",
        type: AttributeType.STRING,
      },
      tableName: process.env.USER_TABLE,
      /**
       *  The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new table, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will delete the table (even if it has data in it)
       */
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    // Create sns Topic
    const snsTopic = new Topic(this, "Topic", {
      displayName: "chat messages topic",
    });
    new CfnOutput(this, "SNS Topic Arn", {
      value: snsTopic.topicArn,
    });

    const NodejsFunctionProps = {
      environment: {
        USER_TABLE: process.env.USER_TABLE,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        START_CMD: process.env.START_CMD,
        SNS_TOPIC_ARN: snsTopic.topicArn,
      },
      runtime: Runtime.NODEJS_18_X,
    };

    const lambda_login = new NodejsFunction(this, "lambda_login", {
      entry: join(__dirname, "../../server/lambda_login", "index.mjs"),
      depsLockFilePath: join(
        __dirname,
        "../../server/lambda_login",
        "package-lock.json"
      ),
      ...NodejsFunctionProps,
      bundling: {
        externalModules: ["@aws-sdk"],
        nodeModules: ["jsonwebtoken"],
      },
    });
    const lambda_chat = new NodejsFunction(this, "lambda_chat", {
      entry: join(__dirname, "../../server/lambda_chat", "index.mjs"),
      depsLockFilePath: join(
        __dirname,
        "../../server/lambda_chat",
        "package-lock.json"
      ),
      timeout: Duration.minutes(15),
      ...NodejsFunctionProps,
      bundling: {
        externalModules: ["@aws-sdk"],
        nodeModules: ["openai"],
      },
    });
    const lambda_connect_handle = new NodejsFunction(
      this,
      "lambda_connect_handle",
      {
        entry: join(
          __dirname,
          "../../server/lambda_connect_handle",
          "index.mjs"
        ),
        depsLockFilePath: join(
          __dirname,
          "../../server/lambda_connect_handle",
          "package-lock.json"
        ),
        ...NodejsFunctionProps,
        bundling: {
          externalModules: [
            "@aws-sdk", // Use the 'aws-sdk' available in the Lambda runtime
          ],
          nodeModules: ["jsonwebtoken"],
        },
      }
    );
    const lambda_handle_chat = new NodejsFunction(this, "lambda_handle_chat", {
      entry: join(__dirname, "../../server/lambda_handle_chat", "index.mjs"),
      depsLockFilePath: join(
        __dirname,
        "../../server/lambda_handle_chat",
        "package-lock.json"
      ),
      ...NodejsFunctionProps,
    });

    // Grant the Lambda function read access to the DynamoDB table
    dynamoTable.grantReadWriteData(lambda_login);

    //Add the lambda subscription
    snsTopic.addSubscription(new subscriptions.LambdaSubscription(lambda_chat));
    // Grant the Lambda function publish data
    snsTopic.grantPublish(lambda_handle_chat);

    // Create a HTTP API Gateway resource for each of the CRUD operations
    const cors = {
      corsPreflight: {
        allowHeaders: ["*"],
        allowMethods: ["*"],
        allowOrigins: ["*"],
        maxAge: Duration.days(0),
      },
    };
    const httpapi = new apigwv2.HttpApi(this, "ChatBotHttpApi", cors);

    //add route for login
    httpapi.addRoutes({
      integration: new HttpLambdaIntegration("login", lambda_login),
      path: "/login",
      methods: [apigwv2.HttpMethod.POST],
    });

    const webSocketApi = new apigwv2.WebSocketApi(this, "ChatBotWsApi", {
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "ConnectIntegration",
          lambda_connect_handle
        ),
      },
    });

    const webSocketStage = new apigwv2.WebSocketStage(this, "mystage", {
      webSocketApi,
      stageName: "Prod",
      autoDeploy: true,
    });
    const webSocketURL = webSocketStage.url;
    const callbackURL = webSocketStage.callbackUrl;

    new CfnOutput(this, "ChatBotWsApi_URL", {
      value: webSocketURL,
    });

    webSocketApi.addRoute("sendprompt", {
      integration: new WebSocketLambdaIntegration(
        "SendMessageIntegration",
        lambda_chat
      ),
    });

    // per stage permission
    webSocketStage.grantManagementApiAccess(lambda_chat);
    // for all the stages permission
    webSocketApi.grantManageConnections(lambda_chat);
  }
}

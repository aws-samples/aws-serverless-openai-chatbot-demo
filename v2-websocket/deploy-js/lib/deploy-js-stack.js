// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Stack, Duration, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { DockerImageFunction }  from 'aws-cdk-lib/aws-lambda';
import { DockerImageCode,Architecture } from 'aws-cdk-lib/aws-lambda';
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Topic } from "aws-cdk-lib/aws-sns";
import * as ecr from 'aws-cdk-lib/aws-ecr';

import subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import {
  HttpLambdaIntegration,
  WebSocketLambdaIntegration,
} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import { VpcStack } from './vpc-stack.js';
import {OpenSearchStack} from './opensearch-stack.js';
import {ApiGatewayStack} from './apigw-stack.js';
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

    // const region = process.env.CDK_DEFAULT_REGION;
    // const account = process.env.CDK_DEFAULT_ACCOUNT;
    const region = props.env.region;
    const account = props.env.account;
    

    const vpcStack = new VpcStack(this,'vpc-stack',{env:process.env});
    const vpc = vpcStack.vpc;
    const subnets = vpcStack.subnets;
    const securityGroups = [vpcStack.securityGroups];

      // Open search
    const opensearch = new OpenSearchStack(this,'opensearch-dev',{vpc:vpc,subnets:subnets,securityGroups:securityGroups});
    const opensearch_endpoint = opensearch.domainEndpoint;
    
    const user_ddb_table = new Table(this, "chat_user_info", {
      partitionKey: {
        name: "username",
        type: AttributeType.STRING,
      },
      tableName: process.env.USER_TABLE,
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    const doc_index_ddb_able = new Table(this, "doc_index", {
      partitionKey: {
        name: "filename",
        type: AttributeType.STRING,
      },
      sortKey:{
        name: "embedding_model",
        type: AttributeType.STRING,
      },
      // tableName: process.env.DOC_INDEX_TABLE,
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
        TOKEN_KEY:process.env.TOKEN_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        START_CMD: process.env.START_CMD,
        SNS_TOPIC_ARN: snsTopic.topicArn,
        DOC_INDEX_TABLE:doc_index_ddb_able.tableName,
      },
      runtime: Runtime.NODEJS_18_X,
      vpc:vpc,
      vpcSubnets:subnets,
      securityGroups:securityGroups,
    };

    const lambda_login = new NodejsFunction(this, "lambda_login", {
      entry: join(__dirname, "../../server/lambda_login", "index.mjs"),
      depsLockFilePath: join(
        __dirname,
        "../../server/lambda_login",
        "package-lock.json"
      ),
      ...NodejsFunctionProps,
      functionName:'lambda_login',
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
      functionName:'lambda_chat',
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
        functionName:'lambda_connect_handle',
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
      functionName:'lambda_handle_chat',
    });

    const lambda_auth = new NodejsFunction(this, "lambda_auth", {
      entry: join(__dirname, "../../server/lambda_auth", "index.mjs"),
      depsLockFilePath: join(
        __dirname,
        "../../server/lambda_auth",
        "package-lock.json"
      ),
      ...NodejsFunctionProps,
      functionName:'lambda_auth',
      bundling: {
        externalModules: [
          "@aws-sdk", 
        ],
        nodeModules: ["jsonwebtoken"],
      },
    });

    const lambda_list_idx = new NodejsFunction(this, "lambda_list_idx", {
      entry: join(__dirname, "../../server/lambda_list_idx", "index.mjs"),
      depsLockFilePath: join(
        __dirname,
        "../../server/lambda_list_idx",
        "package-lock.json"
      ),
      ...NodejsFunctionProps,
      functionName:'lambda_list_idx',
    });




    
    // const ecrRepoName = `${account}.dkr.ecr.${region}.amazonaws.com/lambda_fn_call_sagemaker`;
    const ecrRepoName = `lambda_fn_call_sagemaker`;
    const repo = ecr.Repository.fromRepositoryName(this, "Repository", ecrRepoName)

    // const ecrImage = new EcrImageCode(ecrRepo, { tagOrDigest: imageTag });
    const ecrImage = DockerImageCode.fromEcr(repo,{tagOrDigest: 'latest' });
    const dockerImageProps = {
      code: ecrImage,
      timeout: Duration.minutes(15),
      memorySize: 256,
      runtime: 'python3.10',
      functionName: 'lambda_fn_invoke_sagemaker',
      vpc:vpc,
      vpcSubnets:subnets,
      securityGroups:securityGroups,
      architecture: Architecture.X86_64,
      environment: {
        embedding_endpoint: process.env.embedding_endpoint,
        llm_endpoint:process.env.llm_endpoint,
        region: process.env.region,
        opensearch_endpoint:opensearch_endpoint,
        UPLOADS_BUCKET:process.env.UPLOADS_BUCKET,
        DOC_INDEX_TABLE:doc_index_ddb_able.tableName,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,

      },
    };

    // Create the Docker image function
    const lambda_fn_call_sagemaker = new DockerImageFunction(this, 'lambda_fn_call_sagemaker', dockerImageProps);
    
    // Grant the Lambda function can be invoked by lambda_chat
    lambda_fn_call_sagemaker.grantInvoke(lambda_chat);
    
    // Grant the Lambda function can invoke sagemaker
    lambda_fn_call_sagemaker.addToRolePolicy(new iam.PolicyStatement({
      // principals: [new iam.AnyPrincipal()],
        actions: [ 
          "sagemaker:InvokeEndpointAsync",
          "sagemaker:InvokeEndpoint",
          "s3:List*",
          "s3:Put*",
          "s3:Get*",
          "es:*",
          ],
        effect: iam.Effect.ALLOW,
        resources: ['*'],
        }))

    // Grant the Lambda function read access to the DynamoDB table
    user_ddb_table.grantReadWriteData(lambda_login);
    doc_index_ddb_able.grantReadWriteData(lambda_fn_call_sagemaker);
    doc_index_ddb_able.grantReadWriteData(lambda_list_idx);

    //Add the lambda subscription
    snsTopic.addSubscription(new subscriptions.LambdaSubscription(lambda_chat));
    // Grant the Lambda function publish data
    snsTopic.grantPublish(lambda_handle_chat);


    //create REST api
    const restapi = new ApiGatewayStack(this,'ChatBotRestApi',{lambda_login,lambda_auth,lambda_build:lambda_fn_call_sagemaker,lambda_list_idx,region})

    // Create a HTTP API Gateway resource for each of the CRUD operations
    // const cors = {
    //   corsPreflight: {
    //     allowHeaders: ["*"],
    //     allowMethods: ["*"],
    //     allowOrigins: ["*"],
    //     maxAge: Duration.days(0),
    //   },
    // };
    // const httpapi = new apigwv2.HttpApi(this, "ChatBotHttpApi", cors);



    // //add route for login
    // httpapi.addRoutes({
    //   integration: new HttpLambdaIntegration("login", lambda_login),
    //   path: "/login",
    //   methods: [apigwv2.HttpMethod.POST],
    // });

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
        lambda_handle_chat
      ),
    });

    // per stage permission
    webSocketStage.grantManagementApiAccess(lambda_chat);
    // for all the stages permission
    webSocketApi.grantManageConnections(lambda_chat);


  

  }
}

import { NestedStack,Duration, CfnOutput }  from 'aws-cdk-lib';
import { LambdaIntegration, MockIntegration,RestApi,PassthroughBehavior,
   TokenAuthorizer, Cors,ResponseType,AwsIntegration,ContentHandling } from 'aws-cdk-lib/aws-apigateway';
import * as iam from "aws-cdk-lib/aws-iam";

export function addCorsOptions(apiResource) {
  apiResource.addMethod('OPTIONS', new MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    passthroughBehavior: PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  })
}


export class ApiGatewayStack extends NestedStack {

    endpoint = '';
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
      super(scope, id, props);
    
      // console.log('props:',props)

    const login_handler = props.lambda_login;
    const auth_handler = props.lambda_auth;
    const build_handler = props.lambda_build;
    const listidx_handler = props.lambda_list_idx;
    const upload_handler = props.lambda_handle_upload;
    const region = props.region

    // create lambda authorizer
    const authorizer = new TokenAuthorizer(this, 'APIAuthorizer', {
        handler: auth_handler,
        resultsCacheTtl:Duration.minutes(0)
      });

    const api = new RestApi(this, 'ChatbotRestApi', {
      cloudWatchRole:true,
        defaultCorsPreflightOptions: {
          allowOrigins: Cors.ALL_ORIGINS,
          allowHeaders: Cors.DEFAULT_HEADERS,
          allowMethods: Cors.ALL_METHODS
        },
        // policy:
    });
    this.endpoint = api.url;

    api.addGatewayResponse('cors1',{  
      type:ResponseType.ACCESS_DENIED,
      statusCode: '500',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      }
    });
    api.addGatewayResponse('cors2',{  
      type:ResponseType.DEFAULT_4XX,
      statusCode: '400',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      }
    });
    api.addGatewayResponse('cors3',{  
      type:ResponseType.DEFAULT_5XX,
      statusCode: '500',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      }
    });

    new CfnOutput(this, `API gateway endpoint url`,{value:`${api.url}`});

    const loginIntegration = new LambdaIntegration(login_handler);
    const login = api.root.addResource('login');
    login.addMethod('POST', loginIntegration);


    const uploadIntegration = new LambdaIntegration(upload_handler);
    const upload = api.root.addResource('upload');
    upload.addMethod('POST', uploadIntegration,{authorizer});

    const buildIntegration = new LambdaIntegration(build_handler);
    const build = api.root.addResource('build');
    // const buildfile = build.addResource('{filepath}');
    build.addMethod('POST', buildIntegration,{authorizer});

    const docsIntegration = new LambdaIntegration(listidx_handler);
    const docs = api.root.addResource('docs');
    docs.addMethod('GET',docsIntegration,{authorizer});

    //note :refer to https://repost.aws/knowledge-center/api-gateway-upload-image-s3
    // and https://docs.aws.amazon.com/apigateway/latest/developerguide/integrating-api-with-aws-services-s3.html


    // const folder = upload.addResource('{folder}');
    // const item = folder.addResource('{item}');

    // const role = new iam.Role(this, 'api-gateway-upload-to-s3', {
    //   assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    // });

    // role.attachInlinePolicy(
    //   new iam.Policy(this, 's3policy',{
    //     statements:[
    //       new iam.PolicyStatement({
    //         actions: [ 
    //           "s3:List*",
    //           "s3:Put*",
    //           "s3:Get*",
    //           ],
    //         effect: iam.Effect.ALLOW,
    //         resources: ['*'],
    //         })
    //     ]
    //   })  
    // );


    // const s3Integration = new AwsIntegration({
    //   options:{
    //     contentHandling:ContentHandling.CONVERT_TO_TEXT
    //   },
    //   service: 's3',
    //   region: region,
    //   action: 'pathOverride',
    //   integrationHttpMethod:'PUT',
    //   actionParameters:{'pathOverride':'{bucket}/{object}'},
    // });
    // item.addMethod('PUT', s3Integration,{authorizer,
    // });

    }
}


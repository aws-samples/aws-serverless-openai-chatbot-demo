### Welcome to your CDK Go project!

This is a blank project for Go development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

### Useful commands

 * `cdk list`        list stack, u can check build before deployment
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
 * `go test`         run unit tests

### Update aws-cdk
This CDK CLI is not compatible with the CDK library used by your application. Please upgrade the CLI to the latest version.
please do this 
```shell
npm uninstall -g aws-cdk
npm install -g aws-cdk
```

### Configure
please config [cdk.context.json](./cdk.context.json), add your openai_api_key
```json
{
  "stage": "test",
  "login_dynamodb_table": "chat_user_info",
  "sns_chat_openai_topic": "chatmessage",
  "jwt_secret": "test_secret",
  "openai_api_key": "",
  "login_lambda_code_absolute_dir": "../server/lambda_login/",
  "connect_lambda_code_absolute_dir": "../server/lambda_connect_handle/",
  "chat_lambda_code_absolute_dir": "../server/lambda_handle_chat/",
  "push_lambda_code_absolute_dir": "../server/lambda_chat/"
}
```

### Deploy Infrastructure
```shell
cd ../server/lambda_chat && npm install && cd -
cd ../server/lambda_connect_handle && npm install && cd -
cd ../server/lambda_handle_chat && npm install && cd -
cd ../server/lambda_login && npm install && cd -

cdk list
# http-api-gateway-login
# websocket-api-gateway-chat
# websocket-api-gateway-connect
# async-ai-chat-push-ws-gw
# websocket-api-gateway

# choose one to deploy or cdk deploy all
cdk deploy --all
```

### Destroy Deploy
```shell
cdk destroy --all
```

### Deploy Client
[Tutorial: Configuring a static website on Amazon S3]( https://docs.aws.amazon.com/AmazonS3/latest/userguide/HostingWebsiteOnS3Setup.html)

see [../../README.md](../../README.md)


### Test
add test data use by aws cli, change {default} `~/.aws/credentials` , {login_dynamodb_table} config in [cdk.context.json](./cdk.context.json)
```shell
# https://docs.aws.amazon.com/cli/latest/reference/dynamodb/index.html#cli-aws-dynamodb
# https://docs.aws.amazon.com/cli/latest/reference/dynamodb/create-table.html
# aws --profile {default} dynamodb create-table \
#     --table-name {login_dynamodb_table} \
#     --attribute-definitions \
#         AttributeName=username,AttributeType=S \
#     --key-schema \
#         AttributeName=username,KeyType=HASH \
#     --provisioned-throughput \
#         ReadCapacityUnits=5,WriteCapacityUnits=5 \
#     --table-class STANDARD

# https://docs.aws.amazon.com/cli/latest/reference/dynamodb/put-item.html
aws --profile {default} dynamodb put-item \
    --table-name {login_dynamodb_table}_{stage} \
    --item '{"username":{"S":"root"},"password":{"S":"12345678"}}'
# --transact-items

# https://docs.aws.amazon.com/cli/latest/reference/dynamodb/get-item.html
aws --profile {default} dynamodb get-item --table-name {login_dynamodb_table}_{stage}  --key '{"username": {"S": "root"}}'

# change you deploy {region} {stage} and api gw {id}
curl -XPOST -H 'content-type: application/json' "https://{id}.execute-api.{region}.amazonaws.com/{stage}/login" -d '{"username":"root","password":"12345678"}'
```

### Notice
this dynamodb table is just a demo, if want have unique key, u can see this: 
[simulating-amazon-dynamodb-unique-constraints-using-transactions](https://aws.amazon.com/fr/blogs/database/simulating-amazon-dynamodb-unique-constraints-using-transactions/) 
[general-nosql-design-use-dynamodb](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html)

u need change database model for your biz application
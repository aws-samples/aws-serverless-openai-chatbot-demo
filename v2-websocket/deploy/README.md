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


### Deploy Infrastructure
```shell
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
see [../../README.md](../../README.md) 



package infra

import (
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambda"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type WsGwConnectStackProps struct {
	awscdk.StackProps
}

func NewWsGwConnectStack(scope constructs.Construct, id string, props *WsGwConnectStackProps) (constructs.Construct, awslambda.Function) {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)
	jwt_secret := stack.Node().TryGetContext(jsii.String("jwt_secret")).(string)
	stage := stack.Node().TryGetContext(jsii.String("stage")).(string)
	connect_lambda_code_absolute_dir := stack.Node().TryGetContext(jsii.String("connect_lambda_code_absolute_dir")).(string)

	connectHandler := awslambda.NewFunction(stack, jsii.String("connectHandler"), &awslambda.FunctionProps{
		Code:    awslambda.Code_FromAsset(jsii.String(connect_lambda_code_absolute_dir), nil),
		Runtime: awslambda.Runtime_NODEJS_18_X(),
		Handler: jsii.String("index.handler"),
		Environment: &map[string]*string{
			"TOKEN_KEY": jsii.String(jwt_secret),
		},
		FunctionName: jsii.String("chatbot-connect-" + stage),
		Description:  jsii.String("On connect event, check jwt authorization"),
	})

	if _, ok := StageAutoDeploy[stage]; !ok {
		return stack, connectHandler
	}

	fnUrl := connectHandler.AddFunctionUrl(&awslambda.FunctionUrlOptions{
		AuthType: awslambda.FunctionUrlAuthType_NONE,
	})
	awscdk.NewCfnOutput(stack, jsii.String("connectHandlerUrl"), &awscdk.CfnOutputProps{
		Value: fnUrl.Url(),
	})

	return stack, connectHandler
}

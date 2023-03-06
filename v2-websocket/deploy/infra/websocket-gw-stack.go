package infra

import (
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambda"
	"github.com/aws/aws-cdk-go/awscdkapigatewayv2alpha/v2"
	"github.com/aws/aws-cdk-go/awscdkapigatewayv2integrationsalpha/v2"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type WsGwStackProps struct {
	awscdk.StackProps
	ConnectHandler awslambda.Function
	ChatHandler    awslambda.Function
	//pushHandler    awslambda.Function
}

func NewWsGwStack(scope constructs.Construct, id string, props *WsGwStackProps) constructs.Construct {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)
	stage := stack.Node().TryGetContext(jsii.String("stage")).(string)

	wsApi := awscdkapigatewayv2alpha.NewWebSocketApi(stack, jsii.String("ws-gw-chatbot"), &awscdkapigatewayv2alpha.WebSocketApiProps{
		ApiName: jsii.String("websocket-gateway-chatbot-" + stage),
		// /$connect
		ConnectRouteOptions: &awscdkapigatewayv2alpha.WebSocketRouteOptions{
			Integration:    awscdkapigatewayv2integrationsalpha.NewWebSocketLambdaIntegration(jsii.String("ws-gw-chatbot-connect"), props.ConnectHandler),
			Authorizer:     nil,
			ReturnResponse: jsii.Bool(true),
		},
		Description: jsii.String("websocket gateway chatbot"),
	})

	// sendprompt
	wsApi.AddRoute(jsii.String("sendprompt"), &awscdkapigatewayv2alpha.WebSocketRouteOptions{
		Integration:    awscdkapigatewayv2integrationsalpha.NewWebSocketLambdaIntegration(jsii.String("ws-gw-chatbot-sendprompt"), props.ChatHandler),
		ReturnResponse: jsii.Bool(false),
	})

	if _, ok := StageAutoDeploy[stage]; !ok {
		return stack
	}

	wsApiStage := awscdkapigatewayv2alpha.NewWebSocketStage(stack, jsii.String("ws-gw-chatbot-stage"), &awscdkapigatewayv2alpha.WebSocketStageProps{
		AutoDeploy:   jsii.Bool(StageAutoDeploy[stage]),
		StageName:    jsii.String(stage),
		WebSocketApi: wsApi,
	})

	awscdk.NewCfnOutput(stack, jsii.String("wsGwApiUrl"), &awscdk.CfnOutputProps{
		Value: wsApiStage.Url(),
	})

	return stack
}

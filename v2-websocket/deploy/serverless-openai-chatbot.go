package main

import (
	"fmt"
	"serverless-openai-chatbot/infra"
	"time"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/jsii-runtime-go"
)

func main() {
	defer jsii.Close()

	app := awscdk.NewApp(nil)

	stage := app.Node().TryGetContext(jsii.String("stage")).(string)
	if _, ok := infra.StageAutoDeploy[stage]; !ok {
		fmt.Printf("%s un support, need those stage: %+v", stage, infra.StageAutoDeploy)
		return
	}

	infra.NewHttpLoginApiStack(app, "http-api-gateway-login", &infra.HttpLoginApiStackProps{
		StackProps: awscdk.StackProps{
			Env:         env(),
			StackName:   jsii.String("OpenAIChatBotHttpLoginApi-" + stage),
			Description: jsii.String("http api gateway /login,"),
		},
	})

	wsConnectConstruct, connectHandler := infra.NewWsGwConnectStack(app, "websocket-api-gateway-connect", &infra.WsGwConnectStackProps{
		StackProps: awscdk.StackProps{
			Env:         env(),
			StackName:   jsii.String("OpenAIChatBotWsApiGwConnectStack-" + stage),
			Description: jsii.String("websocket api gateway /$connect"),
		},
	})
	_, _ = wsConnectConstruct, connectHandler

	wsChatConstruct, chatMsgTopic, chatHandler := infra.NewWsGwChatStack(app, "websocket-api-gateway-chat", &infra.WsGwChatStackProps{
		StackProps: awscdk.StackProps{
			Env:         env(),
			StackName:   jsii.String("OpenAIChatBotWsApiGwChatStack-" + stage),
			Description: jsii.String("websocket api gateway sendprompt"),
		},
	})
	_, _, _ = wsChatConstruct, chatMsgTopic, chatHandler

	wsPushConstruct, pushHandler := infra.NewWsGwPushStack(app, "async-ai-chat-push-ws-gw", &infra.WsGwPushStackProps{
		StackProps: awscdk.StackProps{
			Env:         env(),
			StackName:   jsii.String("OpenAIChatBotPushAIContent2WsStack-" + stage),
			Description: jsii.String("Push AI content to websocket api gateway"),
		},
		Topic: chatMsgTopic,
	})
	_, _ = wsPushConstruct, pushHandler

	infra.NewWsGwStack(app, "websocket-api-gateway", &infra.WsGwStackProps{
		StackProps: awscdk.StackProps{
			Env:         env(),
			StackName:   jsii.String("OpenAIChatBotWebSocketApiGateway-" + stage),
			Description: jsii.String("websocket api gateway"),
		},
		ConnectHandler: connectHandler,
		ChatHandler:    chatHandler,
	})

	awscdk.Tags_Of(app).Add(jsii.String("version"), jsii.String("1.0.0"), nil)
	awscdk.Tags_Of(app).Add(jsii.String("project"), jsii.String("serverless-openai-chatbot"), nil)
	awscdk.Tags_Of(app).Add(jsii.String("role"), jsii.String("web developer"), nil)
	awscdk.Tags_Of(app).Add(jsii.String("synthTime"), jsii.String(time.Now().Format("2006-01-02 15:04:05.999")), nil)

	app.Synth(nil)
}

// env determines the AWS environment (account+region) in which our stack is to
// be deployed. For more information see: https://docs.aws.amazon.com/cdk/latest/guide/environments.html
func env() *awscdk.Environment {
	// If unspecified, this stack will be "environment-agnostic".
	// Account/Region-dependent features and context lookups will not work, but a
	// single synthesized template can be deployed anywhere.
	//---------------------------------------------------------------------------
	return nil

	// Uncomment if you know exactly what account and region you want to deploy
	// the stack to. This is the recommendation for production stacks.
	//---------------------------------------------------------------------------
	// return &awscdk.Environment{
	//  Account: jsii.String("123456789012"),
	//  Region:  jsii.String("us-east-1"),
	// }

	// Uncomment to specialize this stack for the AWS Account and Region that are
	// implied by the current CLI configuration. This is recommended for dev
	// stacks.
	//---------------------------------------------------------------------------
	// return &awscdk.Environment{
	//  Account: jsii.String(os.Getenv("CDK_DEFAULT_ACCOUNT")),
	//  Region:  jsii.String(os.Getenv("CDK_DEFAULT_REGION")),
	// }
}

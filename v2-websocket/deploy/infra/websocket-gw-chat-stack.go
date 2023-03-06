package infra

import (
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambda"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type WsGwChatStackProps struct {
	awscdk.StackProps
}

func NewWsGwChatStack(scope constructs.Construct, id string, props *WsGwChatStackProps) (constructs.Construct, awssns.Topic, awslambda.Function) {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)
	sns_chat_openai_topic := stack.Node().TryGetContext(jsii.String("sns_chat_openai_topic")).(string)
	stage := stack.Node().TryGetContext(jsii.String("stage")).(string)
	chat_lambda_code_absolute_dir := stack.Node().TryGetContext(jsii.String("chat_lambda_code_absolute_dir")).(string)

	sendPromptNoticationTopic := awssns.NewTopic(stack, jsii.String("sendPromptNotication"), &awssns.TopicProps{
		DisplayName: jsii.String(sns_chat_openai_topic + "-" + stage),
		TopicName:   jsii.String(sns_chat_openai_topic + "-" + stage),
	})

	chatHandler := awslambda.NewFunction(stack, jsii.String("chatHandler"), &awslambda.FunctionProps{
		Code:    awslambda.Code_FromAsset(jsii.String(chat_lambda_code_absolute_dir), nil),
		Runtime: awslambda.Runtime_NODEJS_18_X(),
		Handler: jsii.String("index.handler"),
		Environment: &map[string]*string{
			"SNS_TOPIC_ARN": sendPromptNoticationTopic.TopicArn(),
		},
		FunctionName: jsii.String("chatbot-chat-" + stage),
		Description:  jsii.String("get chat message from websocket connection; and send prompt to SNS"),
	})

	sendPromptNoticationTopic.GrantPublish(chatHandler)

	fnUrl := chatHandler.AddFunctionUrl(&awslambda.FunctionUrlOptions{
		AuthType: awslambda.FunctionUrlAuthType_NONE,
	})

	awscdk.NewCfnOutput(stack, jsii.String("chatHandlerUrl"), &awscdk.CfnOutputProps{
		Value: fnUrl.Url(),
	})

	return stack, sendPromptNoticationTopic, chatHandler
}

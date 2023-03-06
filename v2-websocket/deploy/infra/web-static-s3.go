package infra

import (
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awss3"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type WebStaticS3StackProps struct {
	awscdk.StackProps
}

func NewWebStaticS3Stack(scope constructs.Construct, id string, props *WebStaticS3StackProps) constructs.Construct {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	webStaticBucket := awss3.NewBucket(stack, jsii.String("ChatBotWebStaticBucket"), &awss3.BucketProps{
		RemovalPolicy:     awscdk.RemovalPolicy_DESTROY, // REMOVE FOR PRODUCTION
		AutoDeleteObjects: jsii.Bool(true),              // REMOVE FOR PROUCTION
	})
	_ = webStaticBucket

	return stack
}

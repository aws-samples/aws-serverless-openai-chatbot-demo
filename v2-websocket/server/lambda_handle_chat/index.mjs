// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const client = new SNSClient();
const topicArn = process.env.SNS_TOPIC_ARN;

export const handler = async(event) => {
  
    const body = JSON.parse(event.body);
    console.log(body.payload);
    console.log(event.requestContext)
    
    const command = new PublishCommand({
        TopicArn:topicArn,
        Message:JSON.stringify({
            requestContext:event.requestContext,
            payload: body.payload,
        })
    });
    
    let response;
    try{
         await client.send(command);
         response = {
            statusCode: 200,
        
         };
    }catch(err){
        response = {
            statusCode: 200,
            body:JSON.stringify(err)
         };
    }
    return response;
};

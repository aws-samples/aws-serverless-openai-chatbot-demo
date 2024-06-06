// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import OpenAI from "openai";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handler = async (event) => {
  // console.log(JSON.stringify(event));
  const body = JSON.parse(event.Records[0].Sns.Message);
  console.log(body);
  
  const requestContext = body.requestContext;
  
  const connectionId = requestContext.connectionId;

  
  const prompt = body.payload.prompt;
  const messages = body.payload.messages;
  const params = body.payload.params;
  const msgid = body.payload.msgid;
  console.log(prompt,messages,params,connectionId,msgid);
  
  //send message to websocket
  const client = new ApiGatewayManagementApiClient({
                    endpoint:
                      'https://'+requestContext.domainName + '/' + requestContext.stage,
                  });
                  
                  
                  
  // if (prompt === undefined || prompt === "") {
  //   return {
  //     statusCode: 400,
  //     bot: "invalid prompt",
  //   };
  // }
  let response;
  let text;
  //20230302 adding  ChatGPT API
  if (params.model_name.search(/gpt-4o/)>-1 || 
      params.model_name.search(/gpt-4-turbo/)>-1 ||
      params.model_name.search(/gpt-3.5-turbo/)>-1) {  
    try {
      response = await openai.chat.completions.create({
        messages:messages,
        model: params.model_name,
        max_tokens: params.max_tokens, // The maximum number of tokens to generate in the completion. 
        top_p: params.top_p, // alternative to sampling with temperature, called nucleus sampling
        frequency_penalty: params.frequency_penalty, //decreasing the model's likelihood to repeat the same line verbatim.
        presence_penalty: params.presence_penalty, // increasing the model's likelihood to talk about new topics.
      });
      text= response.choices[0].message;
    } catch (error) {
        console.log(JSON.stringify(error));
        text = {content:error.message+'|'+error.stack};
    }
  }else{
    try {
      response = await openai.createCompletion({
        prompt:prompt,
        model: params.model_name,
        temperature: params.temperature, // Higher values means the model will take more risks.
        max_tokens: params.max_tokens, // The maximum number of tokens to generate in the completion. 
        top_p: params.top_p, // alternative to sampling with temperature, called nucleus sampling
        frequency_penalty: params.frequency_penalty, //decreasing the model's likelihood to repeat the same line verbatim.
        presence_penalty: params.presence_penalty, // increasing the model's likelihood to talk about new topics.
      });
      text= response.data.choices[0].text;
    } catch (error) {
        console.log(JSON.stringify(error));
        text = error.message+'|'+error.stack;
    }
  }

    console.log('response:',text);
  
    const input = {
      ConnectionId:connectionId,
      Data:JSON.stringify({msgid:msgid,text:text})
    }
    const command = new PostToConnectionCommand(input);
    try{
        await client.send(command);
    }catch(err){
        console.log(JSON.stringify(err));
         return {
            statusCode: 500,
            body:JSON.stringify(err)
        };
    }

  
  return {
      statusCode: 200,
  };
};
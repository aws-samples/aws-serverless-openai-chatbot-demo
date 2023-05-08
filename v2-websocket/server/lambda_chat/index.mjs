// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Configuration, OpenAIApi } from "openai";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

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
  
  let text;
  const client = new LambdaClient();
  const task_type = msgid =='build_idx'?'build_idx':'chat';

  try{
    const input = { 
      FunctionName: "lambda_fn_invoke_sagemaker", 
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({...body.payload,task:task_type}),
    };
    const command = new InvokeCommand(input);
    const response = await client.send(command);
    const resp_payload = JSON.parse(Buffer.from(response.Payload).toString())
    console.log(resp_payload)
    text = {content:JSON.parse(resp_payload.body).result}
  }catch(error){
      console.log(JSON.stringify(error));
      text = {content:error.message+'|'+error.stack};
  }


                  



  // if (params.model_name.search(/gpt-3.5-turbo/)>-1){
  //   try {
  //     response = await openai.createChatCompletion({
  //       messages:messages,
  //       model: params.model_name,
  //       temperature:params.temperature
  //     });
  //     text= response.data.choices[0].message;
  //   } catch (error) {
  //       console.log(JSON.stringify(error));
  //       text = {content:error.message+'|'+error.stack};
  //   }
  // }else if ((params.model_name.search(/chatglm-6b/)>-1)){
  //   try{
  //       const client = new LambdaClient();
  //       const input = { 
  //         FunctionName: "lambda_fn_invoke_sagemaker", 
  //         InvocationType: "RequestResponse",
  //         Payload: JSON.stringify({...body.payload,task:'chat'}),
  //       };
  //       const command = new InvokeCommand(input);
  //       const response = await client.send(command);
  //       const resp_payload = JSON.parse(Buffer.from(response.Payload).toString())
  //       console.log(resp_payload)
  //       text = {content:JSON.parse(resp_payload.body).result}
  //   }catch(error){
  //       console.log(JSON.stringify(error));
  //       text = {content:error.message+'|'+error.stack};
  //   }
        
  // }else{
  //   try {
  //     response = await openai.createCompletion({
  //       prompt:prompt,
  //       model: params.model_name,
  //       temperature: params.temperature, // Higher values means the model will take more risks.
  //       max_tokens: params.max_tokens, // The maximum number of tokens to generate in the completion. 
  //       top_p: params.top_p, // alternative to sampling with temperature, called nucleus sampling
  //       frequency_penalty: params.frequency_penalty, //decreasing the model's likelihood to repeat the same line verbatim.
  //       presence_penalty: params.presence_penalty, // increasing the model's likelihood to talk about new topics.
  //     });
  //     text= response.data.choices[0].text;
  //   } catch (error) {
  //       console.log(JSON.stringify(error));
  //       text = error.message+'|'+error.stack;
  //   }
  // }
    console.log('response:',text);
    
    const input = {
      ConnectionId:connectionId,
      Data:JSON.stringify({msgid:msgid,role:'AI',text:text})
    }
      
    //send message to websocket
    const ws_client = new ApiGatewayManagementApiClient({
      endpoint:
        'https://'+requestContext.domainName + '/' + requestContext.stage,
    });
    const command = new PostToConnectionCommand(input);
    try{
        await ws_client.send(command);
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
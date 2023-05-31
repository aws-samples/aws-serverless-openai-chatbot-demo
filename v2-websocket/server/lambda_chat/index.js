// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const { Configuration, OpenAIApi } = require("openai");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { createParser } = require("eventsource-parser");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const sendMessage = async (ws_client,msgid,connectionId,text) => {
  const input = {
    ConnectionId: connectionId,
    Data: JSON.stringify({ msgid: msgid, role: "AI", text: text }),
  };
  const command = new PostToConnectionCommand(input);
  try {
    await ws_client.send(command);
    console.log("send message success,", text);
    return true;
  } catch (err) {
    console.log("send message error", JSON.stringify(err));
    return false;
  }
};

const invokeChatCompletion = async (
  params,
  messages,
  ws_client,
  msgid,
  connectionId
) => {
  let dataChunk;
  const onParse = (event) => {
    if (event.type === "event") {
      if (event.data !== "[DONE]") {
        const text = JSON.parse(event.data).choices[0].delta?.content;
        // console.log("reponse:", text);
        dataChunk = text;
      } else {
        console.log("reponse:", event.data);
        dataChunk = "[DONE]";
      }
    } else if (event.type === "reconnect-interval") {
      console.log(
        "We should set reconnect interval to %d milliseconds",
        event.value
      );
    }
  };

  try {
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      method: "POST",
      body: JSON.stringify({
        model: params.model_name,
        messages: messages,
        temperature: params.temperature,
        stream: true,
      }),
    });

    const parser = createParser(onParse);

    for await (const value of response.body?.pipeThrough(
      new TextDecoderStream()
    )) {
      // console.log("Received", value);
      parser.feed(value);
      dataChunk&&await sendMessage(ws_client, msgid,connectionId,{ content: dataChunk });
    }
    parser.reset();
  } catch (err) {
    console.log("call openai error:", JSON.stringify(err));
  }
};



exports.handler = async (event) => {
  // console.log(JSON.stringify(event));
  const body = JSON.parse(event.Records[0].Sns.Message);
  console.log(body);

  const requestContext = body.requestContext;

  const connectionId = requestContext.connectionId;
  const ws_endpoint =  "https://" + requestContext.domainName + "/" + requestContext.stage;
  //send message to websocket
  const ws_client = new ApiGatewayManagementApiClient({
    endpoint:ws_endpoint
  });

  const prompt = body.payload.prompt;
  const messages = body.payload.messages;
  const params = body.payload.params;
  const msgid = body.payload.msgid;
  console.log(prompt, messages, params, connectionId, msgid);

  let text;
  const client = new LambdaClient();
  const task_type = msgid == "build_idx" ? "build_idx" : "chat";
  try {
    const input = {
      FunctionName: "lambda_fn_invoke_sagemaker",
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({ ...body.payload, task: task_type, msgid:msgid+'res',ws_endpoint:ws_endpoint,connectionId:connectionId }),
    };
    const command = new InvokeCommand(input);
    const response = await client.send(command);
    const resp_payload = JSON.parse(Buffer.from(response.Payload).toString());
    // console.log(resp_payload);
    text = JSON.parse(resp_payload.body).result;
    console.log("response:", text);
  } catch (error) {
    console.log(JSON.stringify(error));
    text =  error.message + "|" + error.stack;
  }
  // if (params.model_name.search(/gpt-3.5-turbo/) > -1) {
  //   await invokeChatCompletion(
  //     params,
  //     messages,
  //     ws_client,
  //     msgid + 'res',
  //     connectionId
  //   ); //msg+1 区别request
  // } else {
  //   try {
  //     const input = {
  //       FunctionName: "lambda_fn_invoke_sagemaker",
  //       InvocationType: "RequestResponse",
  //       Payload: JSON.stringify({ ...body.payload, task: task_type, msgid:msgid+'res',ws_endpoint:ws_endpoint,connectionId:connectionId }),
  //     };
  //     const command = new InvokeCommand(input);
  //     const response = await client.send(command);
  //     const resp_payload = JSON.parse(Buffer.from(response.Payload).toString());
  //     // console.log(resp_payload);
  //     text = JSON.parse(resp_payload.body).result;
      
  //   } catch (error) {
  //     console.log(JSON.stringify(error));
  //     text =  error.message + "|" + error.stack;
  //   }
  //   // await sendMessage(ws_client, msgid+'res',connectionId,{ content: text });
  //   console.log("response:", text);
  // }

  return {
    statusCode: 200,
  };
};

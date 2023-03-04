import { Configuration, OpenAIApi } from "openai";
import * as lark from '@larksuiteoapi/node-sdk';
import { DynamoDBClient, GetItemCommand,PutItemCommand } from "@aws-sdk/client-dynamodb";

const MAX_SEQ=6;
const dbclient = new DynamoDBClient();
const start_command = process.env.START_CMD;

const larkclient = new lark.Client({
    appId: process.env.LARK_APPID,
    appSecret: process.env.LARK_APP_SECRET,
    appType: lark.AppType.SelfBuild,
});


const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);
const dynamodb_tb = process.env.DB_TABLE;

const queryDynamoDb = async (key) => {
  const params = {
    Key: { chat_id: { S: key } },
    TableName: dynamodb_tb,
  };
  const command = new GetItemCommand(params);
  try {
    const results = await dbclient.send(command);
    if (!results.Item) {
      return null;
    } else {
      // console.log(results.Item);
      return JSON.parse(results.Item.messages.S);
    }
  } catch (err) {
    console.error(err);
    return null;
  }
};

const saveDynamoDb = async (chat_id,messages) =>{
    const params = {
        TableName:dynamodb_tb,
        Item:{chat_id:{S:chat_id}, messages:{S:JSON.stringify(messages)}}
    }
    const command = new PutItemCommand(params);
    try {
        const results = await dbclient.send(command);
        // console.log("Items saved success",results);
    } catch (err) {
        console.error(err);
  }
}

const sendLarkMessage = async (open_chat_id,content) =>{
  await larkclient.im.message.create({
                    params: {
                        receive_id_type: 'chat_id',
                    },
                    data: {
                        receive_id: open_chat_id,
                        content: JSON.stringify({text:content}),
                        msg_type: 'text',
                    },
                });
}

export const handler = async (event) => {
  const body = JSON.parse(event.Records[0].Sns.Message);
  console.log(body);
  const open_chat_id = body.open_chat_id;
  const msg_type = body.msg_type;
  let msg;
  let current_msg;
  if (msg_type == 'text'){
      msg = body.msg;
      current_msg = {role:'user',content:msg}
  } else{
      await sendLarkMessage(open_chat_id,`暂不支持'${msg_type}'格式的输入`);
      return { statusCode: 200,}
  }
 
  let messages;
  let prev_msgs;
  //send command to clear the messages
  if (msg === start_command){
      await saveDynamoDb(open_chat_id,null);
      await sendLarkMessage(open_chat_id,'我已清空，请重新开始问我吧');
      return  { statusCode: 200}
  }else{
    await queryDynamoDb(open_chat_id);
  }
  //append the previous msgs
  if (prev_msgs) { 
      messages = [...prev_msgs,current_msg];
      if (messages.length > MAX_SEQ){
          messages = messages.slice(messages.length-MAX_SEQ,)
      }
  }else{
      messages = [current_msg];
  }
  console.log(messages);
  
  let text;          
  try {
       const response = await openai.createChatCompletion({
        messages:messages,
        model:'gpt-3.5-turbo' ,
      });
      text= response.data.choices[0].message;
      messages = [...messages,text];
      await saveDynamoDb(open_chat_id,messages)
      
    } catch (error) {
        console.log(JSON.stringify(error));
        text = {content:error.message+'|'+error.stack};
    }
    
    await sendLarkMessage(open_chat_id,text.content.trimStart());
  return {
      statusCode: 200,
  };
};
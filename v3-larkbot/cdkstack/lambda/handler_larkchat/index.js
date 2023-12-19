// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// import { Configuration, OpenAIApi } from "openai";
import * as lark from "@larksuiteoapi/node-sdk";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const MAX_SEQ = 10;
const dbclient = new DynamoDBClient();


const larkclient = new lark.Client({
  appId: process.env.LARK_APPID,
  appSecret: process.env.LARK_APP_SECRET,
  appType: lark.AppType.SelfBuild,
  disableTokenCache: false,
});
const s3Client = new S3Client();
const dynamodb_tb = process.env.DB_TABLE;


async function uploadS3(bucket, key, blob) {
  const input = {
    Body: blob,
    Bucket: bucket,
    Key: "image/" + key,
  };
  const command = new PutObjectCommand(input);
  try {
    await s3Client.send(command);
    const url = await s3Client.getSignedUrl(
      new GetObjectCommand({ Bucket: bucket, Key: "image/" + key }),
      { expiresIn: 3600 }
    );
    return url;
  } catch (error) {
    console.log("uploadS3:", JSON.stringify(error));
  }
  return "";
}

async function getLarkfile(message_id, filekey,type) {
  let resp;
  try {
    resp = await larkclient.im.messageResource.get({
      path: {
        message_id: message_id,
        file_key: filekey,
      },
      params: {
        type: type,
      },
    });
  } catch (err) {
    console.error(err);
  }
  return resp;
}

const queryDynamoDb = async (key) => {
  const params = {
    Key: { message_id: { S: key } },
    TableName: dynamodb_tb,
  };
  const command = new GetItemCommand(params);
  try {
    const results = await dbclient.send(command);
    if (!results.Item) {
      return null;
    } else {
      // console.log(results.Item);
      return JSON.parse(results.Item.payload.S);
    }
  } catch (err) {
    console.error(err);
    return null;
  }
};

const saveDynamoDb = async (key, payload) => {
  const params = {
    TableName: dynamodb_tb,
    Item: {
      message_id: { S: key },
      payload: { S: JSON.stringify(payload) },
    },
  };
  const command = new PutItemCommand(params);
  try {
    const results = await dbclient.send(command);
    console.log("Items saved success",results);
  } catch (err) {
    console.error(err);
  }
}

// 发送lark 卡片消息
const sendLarkCard = async (open_chat_id, content,user_id,ref_text) =>{
  const card_template = {
    "config": {
      "wide_screen_mode": true,
      "enable_forward": true,
      "update_multi": true
    },
    "elements": [
      {
        "tag": "markdown",
        "content": `<at user_id="${user_id}"></at> ${content}`
      },
      {
        "tag": "action",
        "actions": [
          {
            "tag": "button",
            "text": {
              "tag": "plain_text",
              "content": "👍"
            },
            "type": "default",
            "value": {
              "thumbup": 'click'
            }
          },
          {
            "tag": "button",
            "text": {
              "tag": "plain_text",
              "content": "👎"
            },
            "type": "default",
            "value": {
              "thumbdown": 'click'
            }
          },
          {
            "tag": "button",
            "text": {
              "tag": "plain_text",
              "content": "查看引用"
            },
            "type": "primary",
            "value": {
              "checkref": 'click'
            }
          }
        ]
      }
    ],
    "header": {
      "template": "blue",
      "title": {
        "content": "SSO小助手回复",
        "tag": "plain_text"
      }
    }
  };
  let card_json = {...card_template};

  //如果是对话已清空
  if (content === '历史对话已清空'){
    card_json = {...card_template,elements:[card_template.elements[0]]};
  }
  try{
    const resp = await larkclient.im.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: open_chat_id,
        content: JSON.stringify(card_json),
        msg_type: "interactive",
      },
    });
    if (resp.code === 0){
        return {"card_message_id":resp.data.message_id,"card_template":card_json};
    }else{
      console.error(resp.msg);
      return null;
    }
  }catch (err){
    console.error(JSON.stringify(err));
    return null;
  }

}


// 发送lark 文本消息
const sendLarkText = async (open_chat_id, content,user_id) => {
  try{
    await larkclient.im.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: open_chat_id,
        content: JSON.stringify({ text: `<at user_id="${user_id}"></at> ${content}` }),
        msg_type: "text",
      },
    });
  }catch (err){
    console.error(JSON.stringify(err))
  }
}



const sendLarkMessage = async (open_chat_id, content,user_id,chat_type,message_id,session_id) => {

  const ref_doc = extractRefDoc(content)
  const response = hideRefDoc(content);

  //如果是群聊，则回复text，@用户
  // if (chat_type === 'group'){
  //     await sendLarkText(open_chat_id, response,user_id);
  //     await saveDynamoDb(message_id,{"session_id":session_id,});

  // }else{ 

     const resp = await sendLarkCard(open_chat_id, response,user_id,'');
     if (resp){
       //session id 是自定义的，message id是 lark生成的，所以需要保存message到ddb，用于关联messageid和session id
       await saveDynamoDb(resp.card_message_id,{"session_id":session_id,"up_message_id":message_id,"ref_doc":ref_doc,"card_template":resp.card_template});
     }

  // }
};

function extractRefDoc(chunck) {
  const fullRefRegex = /\W{2}Refer to \d+ knowledge:\W{2}\n\n/gm;
  const pos = chunck.search(fullRefRegex);
  if (pos > -1){
      return chunck.slice(pos).trim()
  }else{
      return ''
  }
}

function hideRefDoc(chunck) {
  const fullRefRegex = /\W{2}Refer to \d+ knowledge:\W{2}\n\n/gm;
  const pos = chunck.search(fullRefRegex);
  if (pos > -1){
      return chunck.slice(0,pos).trim()
  }else{
      return chunck
  }
}

export const handler = async (event) => {
  const body = JSON.parse(event.Records[0].Sns.Message);
  console.log(body);
  const open_chat_id = body.open_chat_id;
  const message_id = body.message_id;
  const session_id = body.session_id;
  const msg_type = body.msg_type;
  const open_id = body.open_id;
  const chat_type = body.chat_type;
  const hide_ref = false; //process.env.hide_ref === "false" ? false : true;
  

  let msg = JSON.parse(body.msg);
  let textmsg;
  let imagekey;
  if (msg_type == "text") {
    textmsg = msg.text.replace(/^@_user\w+\s/gm, ""); //去除群里的@消息的前缀
  } else if (msg_type === "image") {
    imagekey = msg.image_key;
    const file = await getLarkfile(body.message_id, imagekey,msg_type);
    console.log("resp:", file);
    const url = await uploadS3(process.env.UPLOAD_BUCKET, imagekey, file);
    await sendLarkMessage(open_chat_id, `upload ${url}`,open_id,chat_type,message_id,session_id);

    return { statusCode: 200 };
  } else if (msg_type === "audio"){
    const file_key = msg.file_key;
    const duration = msg.duration;
    const file = await getLarkfile(body.message_id, file_key,msg_type);
    await sendLarkMessage(open_chat_id, `duration ${duration}`,open_id,chat_type,message_id,session_id);
  }
  
  else {
    await sendLarkMessage(open_chat_id, `暂不支持'${msg_type}'格式的输入`,open_id,chat_type,message_id,session_id);
    return { statusCode: 200 };
  }

  const client = new LambdaClient();
  const payload = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ws_endpoint: "",
    msgid: message_id,
    chat_name: session_id,
    prompt: textmsg,
    max_tokens: Number(process.env.max_tokens),
    model: process.env.MODEL_NAME,
    use_qa: process.env.use_qa === "true" ? true : false,
    multi_rounds: process.env.multi_rounds === "true" ? true : false,
    template_id: process.env.template_id??'default',
    temperature:Number(process.env.temperature),
    use_trace:process.env.use_trace === "true" ? true : false,
    hide_ref:hide_ref,
    system_role: "",
    system_role_prompt: "",
  };
  console.log(JSON.stringify(payload));

  try {
    const input = {
      FunctionName: process.env.MAIN_FUN_ARN,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({ ...payload }),
    };
    const command = new InvokeCommand(input);
    const response = await client.send(command);
    const payload_json = JSON.parse(Buffer.from(response.Payload).toString());
    console.log(JSON.stringify(payload_json));
    const error = payload_json.errorMessage;
    if (error) {
      await sendLarkMessage(open_chat_id, error,open_id,chat_type,message_id,session_id);
      return {
        statusCode: 200,
      };
    }
    const body = payload_json.body;
    if (payload_json.statusCode == 200) {
      let txtresp = body[0].choices[0].text.trimStart();
      
      await sendLarkMessage(open_chat_id, txtresp,open_id,chat_type,message_id,session_id);
    } else {
      await sendLarkMessage(
        open_chat_id,
        `internal error ${payload_json.statusCode}`,
        open_id,
        chat_type,
        message_id,
        session_id
      );
    }
    return {
      statusCode: 200,
    };
  } catch (error) {
    console.log(JSON.stringify(error));
    const text = error.message + "|" + error.stack;
    await sendLarkMessage(open_chat_id, text,open_id,chat_type,message_id,session_id);
    return {
      statusCode: 200,
    };
  }
};

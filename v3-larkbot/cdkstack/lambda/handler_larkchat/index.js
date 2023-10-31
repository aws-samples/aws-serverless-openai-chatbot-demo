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
const start_command = process.env.START_CMD;

const larkclient = new lark.Client({
  appId: process.env.LARK_APPID,
  appSecret: process.env.LARK_APP_SECRET,
  appType: lark.AppType.SelfBuild,
  disableTokenCache: false,
});
const s3Client = new S3Client();

// const configuration = new Configuration({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// const openai = new OpenAIApi(configuration);
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

async function getLarkfile(message_id, filekey) {
  let resp;
  try {
    resp = await larkclient.im.messageResource.get({
      path: {
        message_id: message_id,
        file_key: filekey,
      },
      params: {
        type: "image",
      },
    });
  } catch (err) {
    console.error(err);
  }
  return resp;
}
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

const saveDynamoDb = async (chat_id, messages) => {
  const params = {
    TableName: dynamodb_tb,
    Item: {
      chat_id: { S: chat_id },
      messages: { S: JSON.stringify(messages) },
    },
  };
  const command = new PutItemCommand(params);
  try {
    const results = await dbclient.send(command);
    // console.log("Items saved success",results);
  } catch (err) {
    console.error(err);
  }
};

const sendLarkMessage = async (open_chat_id, content) => {
  await larkclient.im.message.create({
    params: {
      receive_id_type: "chat_id",
    },
    data: {
      receive_id: open_chat_id,
      content: JSON.stringify({ text: content }),
      msg_type: "text",
    },
  });
};

function hideRefDoc(chunck) {
  const fullRefRegex = /```json\n#Reference([\w+#-]+)?\n([\s\S]*?)\n```/gm;
  return chunck.replace(fullRefRegex, "");
}

export const handler = async (event) => {
  const body = JSON.parse(event.Records[0].Sns.Message);
  console.log(body);
  const open_chat_id = body.open_chat_id;
  const msg_type = body.msg_type;
  const hide_ref = process.env.hide_ref === "false" ? false : true;
  let msg = JSON.parse(body.msg);
  let textmsg;
  let imagekey;
  if (msg_type == "text") {
    textmsg = msg.text.replace(/^@_user\w+\s/gm, ""); //去除群里的@消息的前缀
  } else if (msg_type === "image") {
    imagekey = msg.image_key;
    const file = await getLarkfile(body.message_id, imagekey);
    console.log("resp:", file);
    const url = await uploadS3(process.env.UPLOAD_BUCKET, imagekey, file);
    await sendLarkMessage(open_chat_id, `upload ${url}`);

    return { statusCode: 200 };
  } else {
    await sendLarkMessage(open_chat_id, `暂不支持'${msg_type}'格式的输入`);
    return { statusCode: 200 };
  }

  const client = new LambdaClient();
  const payload = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ws_endpoint: "",
    msgid: open_chat_id,
    chat_name: open_chat_id,
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
      await sendLarkMessage(open_chat_id, error);
      return {
        statusCode: 200,
      };
    }
    const body = payload_json.body;
    if (payload_json.statusCode == 200) {
      let txtresp = body[0].choices[0].text.trimStart();
      if (hide_ref) {
        txtresp = hideRefDoc(txtresp);
      }
      txtresp = txtresp.replace(/\[[^\]]*\]$/gm, ""); //去除model name 后缀
      await sendLarkMessage(open_chat_id, txtresp);
    } else {
      await sendLarkMessage(
        open_chat_id,
        `internal error ${payload_json.statusCode}`
      );
    }
    return {
      statusCode: 200,
    };
  } catch (error) {
    console.log(JSON.stringify(error));
    text = error.message + "|" + error.stack;
    await sendLarkMessage(open_chat_id, text);
    return {
      statusCode: 200,
    };
  }
};

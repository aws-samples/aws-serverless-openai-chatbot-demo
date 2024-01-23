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
import * as axios from "axios";
import { SQSClient, DeleteMessageCommand } from "@aws-sdk/client-sqs";

const FormData = require('form-data');
const crypto = require('crypto');
const cheerio = require('cheerio');


const MAX_SEQ = 10;
const dbclient = new DynamoDBClient();
// const sqsClient = new SQSClient();
// const queueUrl = process.env.queueUrl;
const appIds = process.env.LARK_APPID.split(',');
const appSecrets = process.env.LARK_APP_SECRET.split(',');
const config = process.env.LARK_CONFIG.split(',');
const lark_tenant = process.env.LARK_TENANT_NAMES.split(',');
const systemRoles = process.env.SYSTEM_ROLES.split('|');
const systemPrompts = process.env.SYSTEM_PRMOPTS.split('|');

const initLarkClients = () => {
  // const lark_tokens = process.env.LARK_TOKEN.split(',');
  let lark_clients_map = {};
  let lark_config_map = {};
  let lark_id2sec_map = {};
  let lark_tenants_map = {};
  let system_roles_map = {};
  let system_prompts_map = {};
  for (let i = 0; i < appIds.length; i++) {
    const client = new lark.Client({
      appId: appIds[i],
      appSecret: appSecrets[i],
      appType: lark.AppType.SelfBuild,
      disableTokenCache: false,
    });
    lark_clients_map = { ...lark_clients_map, [appIds[i]]: client };
    lark_config_map = { ...lark_config_map, [appIds[i]]: config[i] };
    lark_id2sec_map = { ...lark_id2sec_map, [appIds[i]]: appSecrets[i] };
    lark_tenants_map = { ...lark_tenants_map, [appIds[i]]: lark_tenant[i] };
    system_roles_map = {...system_roles_map,[appIds[i]]: systemRoles[i] };
    system_prompts_map = {...system_prompts_map,[appIds[i]]: systemPrompts[i] };

  }
  return { lark_clients_map, lark_config_map, lark_id2sec_map, lark_tenants_map,system_roles_map,system_prompts_map};
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex);
}

async function fetchWithTimeout(url, timeout = 5000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('request timeout')), timeout)
    )
  ]);
}


async function extractURLContent(url) {
  function removeJavaScript(html) {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  try {
    const resp = await fetchWithTimeout(url);
    const data = await resp.text();
    const $ = cheerio.load(data);
    return removeJavaScript($.text()).replace(/\s{3,}/g, '\n');
  } catch (error) {
    console.error("extract url:", error);
    return '';
  }
}

// const larkclient = new lark.Client({
//   appId: process.env.LARK_APPID,
//   appSecret: process.env.LARK_APP_SECRET,
//   appType: lark.AppType.SelfBuild,
//   disableTokenCache: false,
// });
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

async function getLarkfile(message_id, filekey, type) {
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
    console.log("Items saved success", results);
  } catch (err) {
    console.error(err);
  }
}

function generateMD5(text) {
  const hash = crypto.createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

//get tenant acecss token
async function getTenantAccessToken({ app_id, app_secret }) {
  const cred_data = JSON.stringify({
    "app_id": app_id,
    "app_secret": app_secret
  });
  try {
    const tokenRes = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      cred_data,
      { headers: { 'Content-Type': 'application/json' } });
    // console.log(tokenRes.data);
    if (tokenRes?.data.code === 0) {
      return tokenRes.data.tenant_access_token;
    }
    else {
      return null;
    }
  } catch (err) {
    console.error(err);
    return null;
  }
}
//Download a image from Url and upload to feishu, return the image_key
async function generateImageKey(url, token) {
  console.log(`call generateImageKey:${url},${token}`)
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const imageData = response.data;
    console.log(`imageData:${imageData.length}`)
    try {
      let data = new FormData();
      data.append('image_type', 'message');
      data.append('image', imageData);
      const headers = {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`,
      };
      const uploadRes = await axios.post('https://open.feishu.cn/open-apis/im/v1/images',
        data,
        { headers });
      console.log(uploadRes.data);
      return uploadRes.data.data.image_key;
    } catch (error) {
      console.error(`${url} image upload:`, error);
      return null;
    }

  } catch (error) {
    console.error(`${url} image download:`, error);
    return null
  }
}

// 发送lark 卡片消息
const sendLarkCard = async (larkclient, open_chat_id, content, user_id, useTime) => {
  const disclaimer = process.env.disclaimer;
  const card_template = {
    "config": {
      "enable_forward": true,
      "update_multi": true
    },
    "elements": [
      {
        "tag": "markdown",
        "content": `<at id="${user_id}"></at> ${content}`
      },
      {
        "tag": "note",
        "elements": [
          {
            "tag": "plain_text",
            "content": `⏱️${useTime}s. ${disclaimer}`
          }
        ]
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
          },
          // {
          //   "tag": "button",
          //   "text": {
          //     "tag": "plain_text",
          //     "content": "新对话"
          //   },
          //   "type": "primary",
          //   "value": {
          //     "clear": 'click'
          //   }
          // }
        ]
      }
    ],
    "header": {
      "template": "blue",
      "title": {
        "content": "小助手",
        "tag": "plain_text"
      }
    }
  };
  let card_json = { ...card_template };

  //如果是对话已清空
  if (content === '历史对话已清空') {
    card_json = { ...card_template, elements: [card_template.elements[0]] };
  }
  // console.log(card_json);
  try {
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
    if (resp.code === 0) {
      return { "card_message_id": resp.data.message_id, "card_template": card_json };
    } else {
      console.error(resp.msg);
      return null;
    }
  } catch (err) {
    console.error(JSON.stringify(err));
    return null;
  }

}


// 发送lark 文本消息
const sendLarkText = async (larkclient, open_chat_id, content, user_id) => {
  try {
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
  } catch (err) {
    console.error(JSON.stringify(err))
  }
}



const sendLarkMessage = async (app_id, app_secret, lark_client, open_chat_id, content, user_id, chat_type, message_id, session_id,web_content='', use_qa=true, useTime=0.0) => {
  let ref_doc = extractRefDoc(content)
  let response = hideRefDoc(content);
  const { imageLinks, cleanedText } = processImagesInMd(response);
  let imageKeys = [];
  //如果存在图片链接，则获取accesstoken，并上传图片到飞书，获取key
  let accessToken;
  for (let i = 0; i < imageLinks.length; i++) {
    const url = imageLinks[i];
    const url_key = `url_${generateMD5(url)}`;
    // console.log(`url:${url}\nurl_key:${url_key}`);

    const cached = await queryDynamoDb(url_key);
    // console.log(`cached:${cached}`);

    if (cached) {
      const image_key = cached.image_key;
      imageKeys.push(image_key);

      //lark md图片支持格式为![hover_text](image_key)
      response = response.replace(url, image_key);
      ref_doc = ref_doc.replace(url, image_key);
    } else {
      accessToken = accessToken ?? await getTenantAccessToken({ app_id, app_secret });
      const image_key = await generateImageKey(url, accessToken);
      console.log(`url:${url}\nimage_key:${image_key}`);
      if (image_key) {
        imageKeys.push(image_key);
        //lark md图片支持格式为![hover_text](image_key)
        response = response.replace(url, image_key);
        ref_doc = ref_doc.replace(url, image_key);
        await saveDynamoDb(url_key, { image_key: image_key });
      } else {
        //如果上传失败，需要把![]()替换成链接格式![]()，否则lark会报错
        response = replaceImagesLinksInMd(response);
        ref_doc = replaceImagesLinksInMd(ref_doc);
      }
    }
  }

  const resp = await sendLarkCard(lark_client, open_chat_id, response, user_id, useTime);
  if (resp) {
    const timestamp = new Date()
    //session id 是自定义的，message id是 lark生成的，所以需要保存message到ddb，用于关联messageid和session id
    await saveDynamoDb(resp.card_message_id, 
      { "session_id": session_id,
       "timestamp": timestamp.toString(), 
       "up_message_id": message_id, 
       "chat_type": chat_type, 
       "ref_doc": ref_doc,
        "card_template": resp.card_template,
        "web_content":web_content,
      "use_qa":use_qa });
  }
};

function extractRefDoc(chunck) {
  const fullRefRegex = /\W{2}Refer to \d+ knowledge:\W{2}/gm;
  const pos = chunck.search(fullRefRegex);
  if (pos > -1) {
    return chunck.slice(pos).trim()
  } else {
    return ''
  }
}

function hideRefDoc(chunck) {
  const fullRefRegex = /\W{2}Refer to \d+ knowledge:\W{2}/gm;
  const pos = chunck.search(fullRefRegex);
  if (pos > -1) {
    return chunck.slice(0, pos).trim()
  } else {
    return chunck
  }
}

//从md中解析出url
function processImagesInMd(markdownText) {
  const regex = /!\[.*?\]\((.*?)\)/g;
  const imageLinks = [];
  let match;

  while ((match = regex.exec(markdownText)) !== null) {
    const imageUrl = match[1];
    imageLinks.push(imageUrl);
  }
  const cleanedText = markdownText.replace(regex, '');
  return { 'imageLinks': imageLinks, 'cleanedText': cleanedText }
}

function replaceImagesLinksInMd(markdownText) {
  const regex = /!\[.*?\]\((.*?)\)/g;
  const imageLinks = [];
  let match;

  while ((match = regex.exec(markdownText)) !== null) {
    const imageUrl = match[0];
    imageLinks.push(imageUrl);
  }
  let replacedText = markdownText;

  //去掉第一个！即可
  imageLinks.map(link => (replacedText = replacedText.replace(link, link.slice(1))))
  return replacedText;
}


//下载图片文件并上传， lark image.create接口有问题，换成axios
// async function downloadImage(url){
//   try {
//     const response = await axios.get(url, { responseType: 'arraybuffer' });
//     const imageData = response.data;

//     try {
//       const uploadRes = await larkclient.im.image.create({
//               data: {
//                   image_type: 'message',
//                   image: imageData,
//               },
//           });
//       if (uploadRes?.code === 0){
//           return uploadRes.image_key;
//       }else{
//         return null;
//       }
//     }catch(error){
//       console.error(`${url} image upload:`, error);
//       return null;
//     }
//   } catch (error) {
//     console.error(`${url} image download:`, error);
//     return null
//   }
// };

// const deleteSqsMessage = async (event) =>{
//       //delete messasge from queue
//       const deleteParams = {
//         QueueUrl: queueUrl,
//         ReceiptHandle: event.Records[0].receiptHandle
//       };
//       const command = new DeleteMessageCommand(deleteParams);
//       const response = await sqsClient.send(command);
//       console.log('Message deleted from the queue,',response);
// }


export const handler = async (event) => {
  const body = JSON.parse(event.Records[0].Sns.Message);
  // const body = JSON.parse(event.Records[0].body);
  console.log(body);
  const open_chat_id = body.open_chat_id;
  const message_id = body.message_id;
  const session_id = body.session_id;
  const user_id = body.user_id;
  const msg_type = body.msg_type;
  const open_id = body.open_id;
  const chat_type = body.chat_type;
  const parent_id = body.parent_id;
  const hide_ref = false; //process.env.hide_ref === "false" ? false : true;
  const app_id = body.app_id;
  const { lark_clients_map, lark_config_map, lark_id2sec_map, lark_tenants_map,system_roles_map,system_prompts_map } = initLarkClients();
  const lark_client = lark_clients_map[app_id];
  const app_secret = lark_id2sec_map[app_id];
  const lark_tenant_name = lark_tenants_map[app_id];
  const system_role = system_roles_map[app_id] === undefined?'':system_roles_map[app_id];
  const system_prompt = system_prompts_map[app_id] === undefined?'':system_prompts_map[app_id];
  console.log(`app id:${app_id} system_role:${system_role}, system_prompt:${system_prompt}`);

  //the multi rounds is disable by default until 
  //the parent_id is not null 
  const multi_rounds = parent_id ? true : false;
  let msg = JSON.parse(body.msg);
  let textmsg;
  let imagekey;
  if (msg_type == "text") {
    textmsg = msg.text.replace(/@_user\w+\s?/gm, ""); //去除群里的@消息的前缀
  } else if (msg_type === "image") {
    imagekey = msg.image_key;
    const file = await getLarkfile(body.message_id, imagekey, msg_type);
    console.log("resp:", file);
    const url = await uploadS3(process.env.UPLOAD_BUCKET, imagekey, file);
    await sendLarkMessage(app_id, app_secret, lark_client, open_chat_id, `upload ${url}`, open_id, chat_type, message_id, session_id);
    // await deleteSqsMessage(event);
    return { statusCode: 200 };
  } else if (msg_type === "audio") {
    const file_key = msg.file_key;
    const duration = msg.duration;
    const file = await getLarkfile(body.message_id, file_key, msg_type);
    await sendLarkMessage(app_id, app_secret, lark_client, open_chat_id, `duration ${duration}`, open_id, chat_type, message_id, session_id);
    // await deleteSqsMessage(event);
    return { statusCode: 200 };
  }

  else {
    await sendLarkMessage(app_id, app_secret, lark_client, open_chat_id, `暂不支持'${msg_type}'格式的输入`, open_id, chat_type, message_id, session_id);
    // await deleteSqsMessage(event);
    return { statusCode: 200 };
  }

  let web_content = ''
  let use_qa = true;

  const text_urls = extractUrls(textmsg);
  //把解析出的内容，直接通过system prompt拼接进去，并且关闭QA，直接走LLM回答
  if (text_urls) {
    const content = await extractURLContent(text_urls[0]);
    if (content.length > 0) {
      web_content = `Here is the extracted content from url:${text_urls[0]} for your reference:\n${content}\n\n`
      use_qa = false
    }
  }else if (parent_id){
    //如果是针对url 的内容进行多轮对话，需要use_qa=false, 通过parent id找到消息卡片id，取出之前消息的usq_qa 状态。
    const cached = await queryDynamoDb(parent_id);
    use_qa = cached?cached.use_qa:true;
    web_content = cached?cached.web_content:'';
  }

  const client = new LambdaClient();
  const payload = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ws_endpoint: "",
    msgid: message_id,
    user_id: user_id,
    company: lark_tenant_name,
    chat_name: session_id,
    prompt: textmsg,
    max_tokens: Number(process.env.max_tokens),
    model: process.env.MODEL_NAME,
    use_qa: use_qa,
    multi_rounds: multi_rounds,
    template_id: process.env.template_id ?? 'default',
    temperature: Number(process.env.temperature),
    use_trace: false,
    hide_ref: false,
    feature_config: lark_config_map[app_id] ?? 'default',
    system_role: system_role,
    system_role_prompt: web_content?web_content:system_prompt,
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
      await sendLarkMessage(app_id, app_secret, lark_client, open_chat_id, error, open_id, chat_type, message_id, session_id);
      // await deleteSqsMessage(event);
      return {
        statusCode: 200,
      };
    }
    const body = payload_json.body;
    if (payload_json.statusCode == 200) {
      let txtresp = body[0].choices[0].text.trimStart();
      const useTime = body[0].useTime.toFixed(1);
      if (txtresp !== '历史对话已清空') {
        await sendLarkMessage(app_id, app_secret, lark_client, open_chat_id, txtresp, open_id, chat_type, message_id, session_id, web_content,use_qa, useTime);
        // await deleteSqsMessage(event);
      }

    } else {
      await sendLarkMessage(
        app_id,
        app_secret,
        lark_client,
        open_chat_id,
        `internal error ${payload_json.statusCode}`,
        open_id,
        chat_type,
        message_id,
        session_id
      );
      // await deleteSqsMessage(event);
    }
    return {
      statusCode: 200,
    };
  } catch (error) {
    console.log(JSON.stringify(error));
    const text = error.message + "|" + error.stack;
    await sendLarkMessage(app_id, app_secret, lark_client, open_chat_id, text, open_id, chat_type, message_id, session_id);
    // await deleteSqsMessage(event);
    return {
      statusCode: 200,
    };
  }
};

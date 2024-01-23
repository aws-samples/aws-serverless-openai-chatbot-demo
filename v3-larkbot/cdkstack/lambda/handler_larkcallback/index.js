// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as lark from '@larksuiteoapi/node-sdk';
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"; // ES Modules import
const dbclient = new DynamoDBClient();
const snsclient = new SNSClient();
// const sqsClient = new SQSClient();
const topicArn = process.env.SNS_TOPIC_ARN;
// const lark_token = process.env.LARK_TOKEN;
const dynamodb_tb = process.env.DB_TABLE;
// const queueUrl = process.env.queueUrl;



const initLarkClients = () => {
  // const lark_tokens = process.env.LARK_TOKEN.split(',');
  const appIds = process.env.LARK_APPID.split(',');
  const appSecrets = process.env.LARK_APP_SECRET.split(',');
  let clients_map = {};
  for (let i = 0; i < appIds.length; i++) {
    const client = new lark.Client({
      appId: appIds[i],
      appSecret: appSecrets[i],
      appType: lark.AppType.SelfBuild,
    });
    clients_map = { ...clients_map, [appIds[i]]: client };
  }
  return clients_map
}



// const larkclient = new lark.Client({
//     appId: process.env.LARK_APPID,
//     appSecret: process.env.LARK_APP_SECRET,
//     appType: lark.AppType.SelfBuild,
// });

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

// update lark 卡片消息
const updateLarkCard = ({ card_template, actions, ref_doc,thumbs_up_cnt,thumbs_down_cnt }) => {
  let card_json = { ...card_template };
  const actionElement = card_json.elements.filter((ele) => {
    return ele.tag === "action"
  })
  if (actionElement[0] && actions.thumbup === 'click') {
    actionElement[0].actions[0].text.content = `已赞(+${thumbs_up_cnt})😊`;  //改变状态是已赞
    actionElement[0].actions[1].text.content = thumbs_down_cnt?`已踩(+${thumbs_down_cnt})😭`:'👎'; //更新点踩数
    // actionElement[0].actions[0].value.thumbup = "cancel"; //再点击就是cancel操作
    // actionElement[0].actions[1].text.content = "👎";  //恢复点踩状态
    // actionElement[0].actions[1].value.thumbdown = "click"; //恢复点踩状态
  } else if (actionElement[0] && actions.thumbdown === 'click') {
    actionElement[0].actions[1].text.content = `已踩(+${thumbs_down_cnt})😭`;  //改变状态是已赞
    actionElement[0].actions[0].text.content = thumbs_up_cnt?`已赞(+${thumbs_up_cnt})😊`:'👍';  //更新点赞数
    // actionElement[0].actions[1].value.thumbdown = "cancel"; //再点击就是cancel操作
    // actionElement[0].actions[0].text.content = "👍";  //恢复初始状态
    // actionElement[0].actions[0].value.thumbup = "click"; //恢复初始状态
  } else if (actionElement[0] && actions.thumbup === 'cancel') {
    actionElement[0].actions[0].text.content = "👍";  //恢复初始状态
    actionElement[0].actions[0].value.thumbup = "click"; //恢复初始状态
  } else if (actionElement[0] && actions.thumbdown === 'cancel') {
    actionElement[0].actions[1].text.content = "👎";  //改变状态是已赞
    actionElement[0].actions[1].value.thumbdown = "click"; //再点击就是cancel操作
  } else if (actionElement[0] && actions.checkref === 'click') {
    actionElement[0].actions[2].text.content = "隐藏引用";  //改变状态
    actionElement[0].actions[2].value.checkref = "cancel";  //改变状态
    if (card_json.elements.length <= 3){
      card_json.elements.splice(3, 0, { "tag": "hr" }); //从索引3处，删除0个元素，插入 分割线
      card_json.elements.splice(4, 0, { "tag": "markdown", "content": ref_doc }); //从4处，删除0个元素，插入 ref doc
    }
  } else if (actionElement[0] && actions.checkref === 'cancel') {
    actionElement[0].actions[2].text.content = "查看引用";  //改变状态
    actionElement[0].actions[2].value.checkref = "click";  //改变状态
    if (card_json.elements.length > 3){
      card_json.elements.splice(-1, 1); //从最后一个索引处，删除ref doc
      card_json.elements.splice(-1, 1); //从最后一个索引处，删除分割线
    }
  } else if (actionElement[0] && actions.clear === 'click') {
    // actionElement[0].actions[3].text.content = "对话历史已清空";  //改变状态是已赞
    // actionElement[0].actions[3].value.clear = "cancel";
  }
  return card_json;
}

const sendFeedback = async ({ method, session_id, msgid, action, user }) => {
  const client = new LambdaClient();
  let payload;
  if (method === 'post') {
    payload = {
      "method": method,
      "resource": 'feedback',
      "body": {
        "msgid": msgid,
        "username": user,
        "session_id": session_id,
        "action": action,
        "feedback": ""
      },
    };
  } else if (method === 'delete') {
    payload = {
      "method": method,
      "resource": 'feedback',
      "body": {
        "msgid": msgid,
        "session_id": session_id,
      },
    };
  } else {
    console.log('invalid method')
    return;
  }


  try {
    const input = {
      FunctionName: process.env.MAIN_FUN_ARN,
      InvocationType: "Event",
      Payload: JSON.stringify({ ...payload }),
    };
    const command = new InvokeCommand(input);
    await client.send(command);
    console.log('update feedback:', payload)
  } catch (error) {
    console.error('update feedback error', JSON.stringify(error));
  }
}

const sendSnSMesage = async ({ larkclient, ...props }) => {
  const command = new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify({
      ...props
    })
  });
  //     const message = JSON.stringify({
  //         msg_type:msg_type,
  //         msg:msg,
  //         session_id:`lark_chat_${chat_type}_${open_chat_id}_${user_id}`,
  //         open_chat_id: open_chat_id,
  //         message_id:msgid,
  //         user_id:user_id,
  //         open_id:open_id,
  //         chat_type:chat_type
  //     })
  // const params = {
  //   MessageBody: message,
  //   QueueUrl: queueUrl,
  // };
  // const command = new SendMessageCommand(params);
  try {
    await snsclient.send(command);
    // await sqsClient.send(command);
  } catch (err) {
    console.log(JSON.stringify(err));
    await larkclient.im.message.create({
      params: {
        receive_id_type: 'chat_id',
      },
      data: {
        receive_id: open_chat_id,
        content: JSON.stringify({ text: `<at user_id="${user_id}"></at> Internal error` }),
        msg_type: 'text',
      },
    });
  }
}

export const handler = async (event) => {
  const data = JSON.parse(event.body);
  // console.log(event);
  console.log(event.body);
  const lark_clients_map = initLarkClients();
  //配置消息卡片的回调url为api_endponint/feedback
  if (event.httpMethod === 'POST' && event.resource === '/feedback') {
    if (data.type === 'url_verification') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          challenge: data.challenge,
        })
      }
    } else if (data.app_id in lark_clients_map) {
      const larkclient = lark_clients_map[data.app_id];
      const user_id = data.user_id;
      const open_message_id = data.open_message_id;
      const open_chat_id = data.open_chat_id;
      const open_id = data.open_id;
      const dbret = await queryDynamoDb(open_message_id);
      const session_id = dbret.session_id;
      let user_actions  = dbret.user_actions??{};
      console.log('dbret:', dbret);
      const actions = {
        thumbup: data.action.value?.thumbup,
        thumbdown: data.action.value?.thumbdown,
        checkref: data.action.value?.checkref,
        clear: data.action.value?.clear,
      }
      let total_thumbs_up_cnt = 0;
      let total_thumbs_down_cnt = 0;
      //统计所有用户的点赞和点踩
      for (key in user_actions){
        total_thumbs_up_cnt += user_actions[key].thumbs_up_cnt??0;
        total_thumbs_down_cnt += user_actions[key].thumbs_down_cnt??0;
      }
      console.log(`actions:${JSON.stringify(actions)}\ntotal thumbs_up_cnt:${total_thumbs_up_cnt}\ntotal thumbs_down_cnt:${total_thumbs_down_cnt}`);
      if (actions.thumbup === 'click' || actions.thumbdown === 'click') {//点赞或者点踩
        const action = actions.thumbup === 'click' ? 'thumbs-up' : 'thumbs-down';
        if (action === 'thumbs-up' ){
          //如果还没有点过赞,则总数+1
          if (!user_actions[user_id]?.thumbs_up_cnt){
            total_thumbs_up_cnt += 1;
          }
          //如果之前点了踩，则点踩总数-1
          if (user_actions[user_id]?.thumbs_down_cnt){
            total_thumbs_down_cnt -= 1;
          }
          user_actions = {...user_actions,[user_id]:{ thumbs_up_cnt:1,thumbs_down_cnt:0}};
        }else{
           //如果还没有点过踩,则总数+1
          if (!user_actions[user_id]?.thumbs_down_cnt){
            total_thumbs_down_cnt+=1;
          }
          //如果之前点了赞，则点赞总数-1
          if (user_actions[user_id]?.thumbs_up_cnt){
            total_thumbs_up_cnt -= 1;
          }
          user_actions = {...user_actions,[user_id]:{ thumbs_up_cnt:0,thumbs_down_cnt:1}};
        }
        await sendFeedback({ method: 'post', session_id: session_id, msgid: dbret.up_message_id, action: action, user: user_id });

      } else if (actions.thumbup === 'cancel' || actions.thumbdown === 'cancel') {//取消点赞或者点踩
        const action = actions.thumbup === 'cancel' ? 'thumbs-up' : 'thumbs-down';
        await sendFeedback({ method: 'delete', session_id: session_id, msgid: dbret.up_message_id, action: action, user: user_id });
      } else if (actions.clear === 'click') {
        await sendSnSMesage(
          {
            msg_type: 'text',
            msg: JSON.stringify({ "text": "/rs" }),
            session_id: `lark_chat_${dbret.chat_type}_${open_chat_id}_${user_id}`,
            chat_type: dbret.chat_type,
            open_id,
            open_chat_id,
            user_id,
            message_id: dbret.up_message_id,
            app_id: data.app_id,
            larkclient
          });
      }

      const updated_card = updateLarkCard({
        card_template: dbret.card_template,
        actions: actions,
        ref_doc: dbret.ref_doc,
        thumbs_up_cnt:total_thumbs_up_cnt,
        thumbs_down_cnt:total_thumbs_down_cnt
      });
      console.log(updated_card);

      //更新ddb里的卡片信息
      await saveDynamoDb(open_message_id, { ...dbret, card_template: updated_card,user_actions });

      return {
        statusCode: 200,
        body: JSON.stringify(updated_card)
      }
    } else {
      return { statusCode: 200 }
    }
  }

  if (data.type === 'url_verification') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        challenge: data.challenge,
      })
    }
  } else if (data.header.app_id in lark_clients_map) {
    const larkclient = lark_clients_map[data.header.app_id];
    if (data.header.event_type === 'im.message.receive_v1') {
      // console.log(data);
      const open_chat_id = data.event.message.chat_id;
      const chat_type = data.event.message.chat_type;
      const parent_id = data.event.message.parent_id;
      const open_id = data.event.sender.sender_id.open_id;
      const user_id = data.event.sender.sender_id.user_id;
      const props = {
        msg_type: data.event.message.message_type,
        msg: data.event.message.content,
        session_id: `lark_chat_${chat_type}_${open_chat_id}_${user_id}`,
        chat_type: chat_type,
        open_id: open_id,
        open_chat_id: open_chat_id,
        user_id: user_id,
        message_id: data.event.message.message_id,
        app_id: data.header.app_id,
        parent_id:parent_id
      }
      // const msg = JSON.parse(message.content).text;
      await sendSnSMesage({
        ...props,
        larkclient: larkclient,
      });
      return { statusCode: 200, }
    } else if (data.header.event_type === 'im.message.reaction.created_v1') {
      const user_id = data.event.user_id.user_id;
      const ddbret = await queryDynamoDb(data.event.message_id);
      const session_id = ddbret.session_id
      await sendFeedback({
        method: 'post',
        session_id: session_id,
        msgid: data.event.message_id,
        action: data.event.reaction_type.emoji_type,
        user: user_id
      });

    } else if (data.header.event_type === 'im.message.reaction.deleted_v1') {
      const user_id = data.event.user_id.user_id;
      const ddbret = await queryDynamoDb(data.event.message_id);
      const session_id = ddbret.session_id
      await sendFeedback({
        method: 'delete',
        session_id: session_id,
        msgid: data.event.message_id,
        action: data.event.reaction_type.emoji_type,
        user: user_id
      });
    } else if (data.header.event_type === 'im.chat.member.user.added_v1') {
      const open_chat_id = data.event.chat_id;
      const welcome_message = process.env.welcome_message ?? '👏👏👏🎉🎉🎉,欢迎入群，我是SSO小助手，我是基于AWS Bedrock开发的人工智能助手，我可以帮您提供日常工作中的常见内部流程咨询，CI知识查询，EC2价格查询，网络搜索等。例如，您可以问我，提FOOB ticket的链接是什么？😊'
      data.event.users.map(async (user) => {
        const user_id = user.user_id.user_id;
        const card_json = {
          "config": {
            "enable_forward": true,
            "update_multi": true
          },
          "elements": [
            {
              "tag": "markdown",
              "content": `<at id="${user_id}"></at> ${welcome_message}`
            },
          ],
          "header": {
            "template": "blue",
            "title": {
              "content": "SSO小助手",
              "tag": "plain_text"
            }
          }
        };
        await larkclient.im.message.create({
          params: {
            receive_id_type: "chat_id",
          },
          data: {
            receive_id: open_chat_id,
            content: JSON.stringify(card_json),
            msg_type: "interactive",
          },
        });
      });
    }
  } else {
    return { statusCode: 200 }
  }
};
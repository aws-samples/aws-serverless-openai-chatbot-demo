// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as lark from '@larksuiteoapi/node-sdk';
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
const snsclient = new SNSClient();
const topicArn = process.env.SNS_TOPIC_ARN;
const lark_token = process.env.LARK_TOKEN;

const larkclient = new lark.Client({
    appId: process.env.LARK_APPID,
    appSecret: process.env.LARK_APP_SECRET,
    appType: lark.AppType.SelfBuild,
});


const sendFeedback = async (method,session_id,msgid,action,user) =>{
    const client = new LambdaClient();
    let payload;
    if (method === 'post'){
        payload = {
           "method": method,
           "resource":'feedback',
           "body":{
                "msgid": msgid,
                "username":user,
                "session_id":session_id,
                "action":action,
                "feedback":""
           },
        };
    }else if (method === 'delete'){
        payload = {
            "method": method,
            "resource":'feedback',
            "body":{
                "msgid": msgid,
                "session_id":session_id,
           },
         };
    }else{
        return;
    }
  
    try{
        const input = {
            FunctionName: process.env.MAIN_FUN_ARN,
            InvocationType: "Event",
            Payload: JSON.stringify({ ...payload }),
          };
          const command = new InvokeCommand(input);
          await client.send(command);
          console.log('update feedback:',payload)
    }catch(error){
        console.error(JSON.stringify(error));
    }
}

export const handler = async(event) => {
    const data = JSON.parse(event.body);
    console.log(data);
    if (data.type === 'url_verification') {
        return {
                statusCode: 200,
                body:JSON.stringify({
                challenge: data.challenge,
            })
            }
    }else if (data.header.token === lark_token){
        if (data.header.event_type === 'im.message.receive_v1') {
            // console.log(data);
            const message = data.event.message;
            const msg_type = message.message_type;
            const open_chat_id = message.chat_id;
            const open_id =data.event.sender.sender_id.open_id;
            const user_id = data.event.sender.sender_id.user_id;
            // const msg = JSON.parse(message.content).text;
            
            const command = new PublishCommand({
                TopicArn:topicArn,
                Message:JSON.stringify({
                    msg_type:msg_type,
                    msg:message.content,
                    session_id:'lark_chat_'+user_id,
                    open_chat_id: open_chat_id,
                    message_id:message.message_id,
                    open_id:open_id
                })
            });
            try{
                 await snsclient.send(command);
            }catch(err){
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
            return { statusCode: 200, }
        }else if (data.header.event_type === 'im.message.reaction.created_v1') {
            const user_id = data.event.user_id.user_id;
            await sendFeedback(method='post',
                session_id='lark_chat_'+user_id,
                msgid=data.event.message_id,
                action=data.event.reaction_type.emoji_type,
                user=user_id);

        }else if (data.header.event_type === 'im.message.reaction.deleted_v1') {
            const user_id = data.event.user_id.user_id;
            await sendFeedback(method='delete',
                session_id='lark_chat_'+user_id,
                msgid=data.event.message_id,
                action=data.event.reaction_type.emoji_type,
                user=user_id);
        }else if (data.header.event_type === 'im.chat.member.user.added_v1'){
            const open_chat_id = data.event.chat_id;
            const welcome_message = process.env.welcome_message??'👏👏👏,欢迎入群，我是小助手，可以帮您找人，问事，查价格等，有什么可以帮您'
            data.event.users.map(async (item) =>{
                const user_id = item.user_id.user_id;
                await larkclient.im.message.create({
                    params: {
                        receive_id_type: 'chat_id',
                    },
                    data: {
                        receive_id: open_chat_id,
                        content: JSON.stringify({ text: `<at user_id="${user_id}"></at> ${welcome_message}` }),
                        msg_type: 'text',
                    },
                });
            });
        }
    }else{
        return {
                 statusCode: 400,
            }
    }
};
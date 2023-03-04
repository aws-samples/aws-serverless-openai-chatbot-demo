import * as lark from '@larksuiteoapi/node-sdk';
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const snsclient = new SNSClient();
const topicArn = process.env.SNS_TOPIC_ARN;
const lark_token = process.env.LARK_TOKEN;

const larkclient = new lark.Client({
    appId: process.env.LARK_APPID,
    appSecret: process.env.LARK_APP_SECRET,
    appType: lark.AppType.SelfBuild,
});


export const handler = async(event) => {
    const data = JSON.parse(event.body);
    if (data.type === 'url_verification') {
        return {
                statusCode: 200,
                body:JSON.stringify({
                challenge: data.challenge,
            })
            }
    }else if (data.header.token === lark_token){
        if (data.header.event_type === 'im.message.receive_v1') {
            console.log(data);
            const message = data.event.message;
            const msg_type = message.message_type;
            const open_chat_id = message.chat_id;
            const msg = JSON.parse(message.content).text;
            const command = new PublishCommand({
                TopicArn:topicArn,
                Message:JSON.stringify({
                    msg_type:msg_type,
                    msg:msg,
                    open_chat_id: open_chat_id,
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
                        content: JSON.stringify({text:"!!something error"}),
                        msg_type: 'text',
                    },
                });
            }
            return { statusCode: 200, }
        }
    }else{
        return {
                 statusCode: 400,
            }
    }
};
## Note  
**This V2 package is to resolve the 503 error issue, which is usually caused by the 30s timeout limitation of HTTP API gateway**  
## Changes  
- **Architecture change**  
1. Add a WebSocket API Gateway, which is used to setup a long connection between client and backend.
2. Decouple the chat function by using AWS SNS. Now OpenAI's API usually takes more than 30s to generate the response text, so that we cannot using HTTP API Gateway to trigger that function, because the HTTP API gateway has timeout limition of 30s.  
![architecture-v2](assets/architecture-v2.png)



## Setup  
### Create Lambda functions
We will create 4 lambda functions: (Code files are in four sub folers under v2/server/)
The detail steps are the same as previous v1. please refer to v1 [README.md](README.md) . 
1. **lambda_login**
***Tips:***  
- This lambda is integrated with the ***/login*** route of HTTP API, and perform the user validation. 
- The execution role of this lambda requires read permission of DynamoDB tables. You need to attach the **DynamodDB access policy** accordingly
- Need to configure an environment variable named **TOKEN_KEY**.

2. **lambda_connect_handle**
***Tips:***  
- This lambda is integrated with the ***$connect*** route of WebSocket API, and perform the token authorization. 
- Need to configure the same **TOKEN_KEY** environment variable as lambda_login.

3. **lambda_handle_chat**
***Tips:***  
- This lambda is integrated with the ***sendprompt*** route of WebSocket API, and send the connectionId and the prompt from user input to a SNS.
- The execution role of this lambda requires SNS publish permission. You need to attach the SNS policy accordingly.
- Need to configure an environment variable named **SNS_TOPIC_ARN**, and fill the arn of your SNS topic ( Creation steps will be guided in later)

4. **lambda_chat** 
***Tips:***  
- This lambda is triggered by SNS, so it will subscribe SNS topic later.
- It calls OpenAI API to get the response text, and send back the text via the WebSocket API Gateway, so it needs to be attached with the permission policy of **AmazonAPIGatewayInvokeFullAccess**. 
- Change the lambda **timeout value**  to a bigger one, for example 5 mins.


### Create a HTTP API gateway
The detail steps are the same as previous v1. **The only difference** is that it has /login route. please refer to v1 [README.md](README.md) configure the route for /login part. 

### Create a WebSocket API gateway  
1. Create a WebSocket API gateway from console  
[wsapigw-1](assets/wsapigw-1.png)
2. Add route key ***$connect*** and ***sendprompt***  
[wsapigw-2](assets/wsapigw-2.png)
3. Add integration to the lambdas accordingly
[wsapigw-3](assets/wsapigw-3.png)
4. Get your WSS endpoint
[wsapigw-4](assets/wsapigw-4.png)


### Create SNS topic  
1. Create a ***Standard*** SNS topic  
[sns-1](assets/sns-1.png)
2. Create a subscription, choose lambda in policy field, and past your arn link of lambda_chat to the endpoint field.  
[sns-2](assets/sns-2.png)
3. Copy the sns topic arn and paste to the environment variable's value of SNS_TOPIC_ARN of **lambda_handle_chat**

### Build the client
1. Change the API_http and API_socket in code [apigw.js](client/src/commons/apigw.js),  to your actual endpoints of HTTP API GW and WebSocket GW accordingly.
`export const API_socket = 'wss://{apiid}.execute-api.{region}.amazonaws.com/dev';`
`export const API_http = 'https://{apiid}.execute-api.{region}.amazonaws.com';` 

2. Run npm install and npm run build.
The detail steps are the same as previous v1. please refer to v1 [README.md](README.md) . 

### Upload the static files to S3 bucket.
1. Setup the s3 bucket with static website hosting enable 
2. Upload the files in build folder to the bucket. 
The detail steps are the same as previous v1. please refer to v1 [README.md](README.md) . 

## After all these done, Congrats!



# Lark-ChatGptBot
Build a ChatGpt bot in Lark (飞书) using OpenAI's gpt-3.5-turbo model. The backend is hosted on AWS's serveless, and it is free.
For steps in Lark side, please refer to [develop-a-bot-in-5-minute](https://open.feishu.cn/document/home/develop-a-bot-in-5-minutes/create-an-app)

## Steps   
1. create a `.env` file in folder `cdkstack/`,  add the your actual variables. 
```  
DB_TABLE=lark_messages
LARK_APPID=cli_xxxx
LARK_APP_SECRET=xxxx
LARK_TOKEN=xxxx
OPENAI_API_KEY=sk-MjDVnhmnxxxx
START_CMD=/rs
```   
2. Install the AWS CDK  
`npm install -g aws-cdk`  

3. In folder `cdkstack/`  
run `cdk bootstrap`  
run `cdk synth`   
run `cdk deploy`  

4. Once deply success, you can get the api endpoint from the output.  
For example,
![image](https://user-images.githubusercontent.com/19160090/222913280-22e826f4-7f07-48ca-ba1d-2deed83d53c6.png)
Use this URL as the callback url for lark message event.  

1. After all dones. congrats  
![img_v2_a6531f9a-0070-41e7-930b-ef97c539ff3g](https://user-images.githubusercontent.com/19160090/222913097-da679fcc-c1a6-4483-9c4d-83560d818e9b.jpg)

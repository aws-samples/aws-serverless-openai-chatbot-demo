## Note ##
**This V2 package is to resolve the 503 error issue, which is usually caused by the 30s timeout limitation of HTTP API gateway**. 
## Changes ##
- **Architecture changed**. 
1. Add a WebSocket API Gateway, which is used to setup a long connection between client and backend.
2. Decouple the chat function by using AWS SNS. Now OpenAI's API usually takes more than 30s to generate the response text, so that we cannot using HTTP API Gateway to trigger that function, because the HTTP API gateway has timeout limition of 30s.  
![architecture-v2](assets/architecture-v2.png)




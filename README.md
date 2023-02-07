## Introduction
ChatGPT is a very popular artificial intelligence (AI) technology that enables natural language conversations between humans and machines. It is based on the open-source GPT-3 language model developed by OpenAI,  the model has been used in a variety of applications, from customer service chatbots to virtual assistants. It has also been used to generate human-like text in a wide range of formats, including conversation, story-telling, news articles, and more. ChatGPT has received positive feedback from the public and the research community for its ability to understand natural language, generate high-quality, coherent text, and meaningful responses. As the technology continues to evolve, it is expected that ChatGPT will become an increasingly important tool for businesses and individuals alike.  
In this sample , we will demonstrate using the API from OpenAI, to build a web application as your personal AI assistant on AWS using serveless architecture. And the services used in this project are all eligible for free tier.  The services to be used are :
- Amazon API Gateway
- Amazon Lambda
- Amazon S3
- Amazon DynamoDB
This application is totally serverless architecture:
- An Amazon S3 bucket is hosting the Html, JS, CSS files of the frontend client.
- An Amazon API Gateway is deployed to route the requests from client devices to backend services.
- The backend services are built on top Amazon Lambda, which includes a function to authorize the request, a function to process user sign in, a function to handle chat requests from the client and revoke OpenAI SDK function to get the response text from OpenAI server.
- An Amazon DynamoDB table also needs to be created to store the user name and credential to give some basic authorization of this application.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

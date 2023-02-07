// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export const handler = async (event) => {
  const body = JSON.parse(event.body);
  const prompt = body.prompt;
  if (prompt === undefined || prompt === "") {
    return {
      statusCode: 400,
      bot: "invalid prompt",
    };
  }
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      temperature: 0, // Higher values means the model will take more risks.
      max_tokens: 3000, // The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 4096).
      top_p: 1, // alternative to sampling with temperature, called nucleus sampling
      frequency_penalty: 0.5, // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
      presence_penalty: 0, // Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
    });
    return {
      statusCode: 200,
      body: JSON.stringify({id:body.id,
        bot:response.data.choices[0].text}),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error || "Something wrong"),
    };
  }
};
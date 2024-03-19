import {
  AccessDeniedException,
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

export const invokeClaude3 = async (messages) => {
  const client = new BedrockRuntimeClient({ 
      region: "us-east-1"
  });

  const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";

  console.log(messages);

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    messages: messages,
    temperature: 0.5,
    top_p: 0.9,
    max_tokens: 1024,
  };

  const command = new InvokeModelCommand({
    body: JSON.stringify(payload),
    contentType: "application/json",
    accept: "application/json",
    modelId: modelId,
  });

  try {

    const response = await client.send(command);
    const decodedResponseBody = new TextDecoder().decode(response.body);

    /** @type {ResponseBody} */
    const responseBody = JSON.parse(decodedResponseBody);

    return responseBody;
  } catch (err) {
    if (err instanceof AccessDeniedException) {
      console.error(
        `Access denied. Ensure you have the correct permissions to invoke ${modelId}.`,
      );
    } else {
      throw err;
    }
  }
};

var messages = [
  { role: 'user', content: 'hello' },
  { role: 'assistant', content: 'Hello! How can I assist you today?' },
  { role: 'user', content: '美国现在总统是谁' }
];
var response = await invokeClaude3(messages);

console.log(response.usage)
console.log(response.content)



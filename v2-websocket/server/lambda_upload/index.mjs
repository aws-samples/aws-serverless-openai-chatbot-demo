// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import jwt from "jsonwebtoken";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.USER_TABLE;

const createToken = (username) => {
  return jwt.sign({ username: username }, process.env.TOKEN_KEY, {
    expiresIn: "24h",
  });
};


const queryDynamoDb = async (key) => {
  const client = new DynamoDBClient();
  const params = {
    Key: { username: { S: key } },
    TableName: TABLE_NAME,
  };
  const command = new GetItemCommand(params);
  try {
    const results = await client.send(command);
    console.log(results);
    if (!results.Item) {
      return null;
    } else {
      console.log(results.Item);
      return results.Item.password.S;
    }
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const handler2 = async (event) => {
  //query user in DB
  const body = JSON.parse(event.body);
  console.log(body);
  const password = await queryDynamoDb(body.username);

  //if user is not found, return 403
  if (!password) {
    return formatResponse(403, "User not found", "");
  }

  //if the password is not match, return 403
  if (password !== body.password) {
    return formatResponse(403, "Invalid credential", "");
  }

  //create jwt token
  const token = createToken(body.username);
  return formatResponse(200, "success", token);
};


const formatResponse = (code, errormsg, token) => {
  const response = {
    statusCode:code,
    headers: {
      "Access-Control-Allow-Headers" : "Content-Type",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET,PUT,POST,DELETE"
  },
    body: JSON.stringify({
      isAuthorized:false,
      message: errormsg,
      token: token,
    }),
  };
  return response;
};

export const handler = async (event) => {
  console.log(event)
  const authorization = event.headers?event.headers.Authorization.split(':'):undefined;
  if (!authorization) 
    return  formatResponse(400, "Missing auth headers", "");
  const user_name = authorization[0];
  const plain_user_pwd = authorization[1];
  //query user in DB
  const password = await queryDynamoDb(user_name);
    
   //if user is not found, return 403
   if (!password) {
    return formatResponse(403, "User not found", "");
  }
  //if the password is not match, return 403
  if (password !== plain_user_pwd) {
    return formatResponse(403, "Invalid credential", "");
  }

  //create jwt token
  const token = createToken(user_name);
  
  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers" :  "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET,PUT,POST,DELETE"
  },
    body: JSON.stringify({
      isAuthorized:true,
      token: token,
      username:user_name,
    }),
  };
  return response;
};

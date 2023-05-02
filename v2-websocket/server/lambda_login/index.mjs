// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import jwt from "jsonwebtoken";
// import bcryptjs from "bcryptjs";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

// const DEFAULT_REGION = "ap-northeast-1";
const TABLE_NAME = process.env.USER_TABLE;

const createToken = (username) => {
  return jwt.sign({ username: username }, process.env.TOKEN_KEY, {
    expiresIn: "24h",
  });
};

// const hashPassword = async (plaintextPassword) => {
//   const hash = await bcrypt.hash(plaintextPassword, 5); //It commonly ranges between 5 and 15. In this demo, we will use 5.
//   console.log(hash);
// };

// const comparePassword = async (plaintextPassword, hash) => {
//   const result = await bcrypt.compare(plaintextPassword, hash);
//   return result;
// };

const formatResponse = (code, errormsg, token) => {
  const response = {
    isAuthorized:(code === 200),
    body: {
      message: errormsg,
      token: token,
    },
  };
  return response;
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

export const handler = async (event) => {
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

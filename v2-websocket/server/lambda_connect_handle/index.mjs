// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import jwt from 'jsonwebtoken';

export const handler = async (event) => {
    const token = event.queryStringParameters.token
    console.log(token)
    // let username ;
    if (!token) {
      return  {
            statusCode: 400,
            body: JSON.stringify('Invalid Token'),
        }
    }
    try {
      const decoded = jwt.verify(token.split(' ')[1], process.env.TOKEN_KEY);
    //   username = decoded;
      console.log('success')
    } catch (err) {
        console.error(err)
        return  {
        statusCode: 400,
        body: JSON.stringify(err),
    }
    }
    return {
        statusCode:200
    }
}
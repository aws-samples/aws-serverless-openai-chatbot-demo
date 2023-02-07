// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import jwt from 'jsonwebtoken';

const formatResponse =(isAuthorized,errormsg) =>{
    const response = {
        "isAuthorized": isAuthorized,
        "context": {
            "message": errormsg,
        }
    }
    return response;
}

export const handler = async (event) => {
    const token = event.headers["authorization"];
    // let username ;
    if (!token) {
      return formatResponse(false,"A token is required for authentication");
    }
    try {
      const decoded = jwt.verify(token.split(' ')[1], process.env.TOKEN_KEY);
    //   username = decoded;
    } catch (err) {
      return formatResponse(false,"Login Expired,please sign in");
    }
    return formatResponse(true,"success");
}
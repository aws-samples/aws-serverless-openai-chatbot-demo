// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
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

function generatePolicy(principalId, effect, resource) {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource
      }]
    }
  };
}


export const handler = async (event) => {
  const token = event.authorizationToken;
  let username
  if (!token) {
      return generatePolicy('user', 'Deny', event.methodArn); 
   }
  try {
    username = jwt.verify(token.split(' ')[1], process.env.TOKEN_KEY);
  } catch (err) {
    console.error(err)
    return generatePolicy('user', 'Deny', event.methodArn);
  }
  console.log(`${username}:auth pass`)
  return generatePolicy(username.username, 'Allow', event.methodArn);
}

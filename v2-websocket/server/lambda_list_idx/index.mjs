// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.DOC_INDEX_TABLE;
const cors_headers = {
    "Access-Control-Allow-Headers" : "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*"
  }

const scanTableData = async () => {
    const client = new DynamoDBClient();
    const params = {
      TableName: TABLE_NAME,
    };
    let retItems = [];
    const command = new ScanCommand(params);
    try {
      const results = await client.send(command);
      if (!results.Items) {
        return retItems;
      } else {
        
        results.Items.forEach((item) => {
          let attributes = {};
          Object.keys(item).forEach((key) => {
            attributes[key] = item[key].S || item[key].N || item[key].BOOL;
          });
          retItems.push(attributes)
        });
        return retItems
      }
    } catch (err) {
      console.error(err);
      return retItems;
    }
  };
  
  


export const handler = async(event) => {
    console.log(event)
    if (event.httpMethod === 'GET' && event.resource === '/docs'){
        const records = await scanTableData()
        return {
          statusCode: 200,
          headers:cors_headers,
          body:JSON.stringify(records)
        }
    }
};

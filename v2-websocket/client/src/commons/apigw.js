// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import axios from 'axios';
//Change to your own WebSocket API Gateway endpoint
//Change to your own HTTP API Gateway endpoint
const http_apiid = 'la0b3bk8c3'
const ws_apiid = '7qbw7k5iw0'
const region = 'ap-northeast-1'
export const Upload_S3 = 'chat-qa-files-test-ap-northeast-1'
export const API_socket = `wss://${ws_apiid}.execute-api.${region}.amazonaws.com/Prod`;
export const API_http = `https://${http_apiid}.execute-api.${region}.amazonaws.com/prod`;
// export const API_http = `https://m0l2c6opd0.execute-api.us-west-2.amazonaws.com/prod`;



export const buildIndex = async(filename,username,model_params,headers) =>{
    const body = JSON.stringify({bucket:Upload_S3,
                                    object:filename,
                                    username:username,
                                    params:model_params
                                })
    try {
        const resp = await axios.post(`${API_http}/build`,body, {headers});
        // console.log(resp.data);
        return resp.data;
    } catch (err) {
        throw err;
    }
}

export const listDocIdx = async(headers) =>{
    try {
        const resp = await axios.get(`${API_http}/docs`, {headers});
        // console.log(resp.data);
        return resp.data;
    } catch (err) {
        throw err;
    }

}

export const putFile = async(filename,formdata,headers) =>{
    try {
        const resp = await axios.put(`${API_http}/upload/${Upload_S3}/${filename}`,formdata, {headers});
        // console.log(resp.data);
        return resp.data;
    } catch (err) {
        throw err;
    }
}
export const getAnswer = async(respid,text,model_params,headers) =>{
    const options ={
        method:'POST',
        // mode: 'no-cors',
        headers:headers,
        body:JSON.stringify({id:respid,prompt:text,params:model_params})
    }
    try {
        const resp = await fetch(API_http+'/chat', options);
       
        if (!resp.ok){
            const data = await resp.text();
            throw (Error(`Error: ${resp.status},${data}`));
        } 
        const data = await resp.json() ;
        return data;
    } catch (err) {
        throw err;
    }
}

export const loginAuth = async(username,password) =>{
    const options ={
        method:'POST',
        headers:{
        //     'Content-Type': 'application/json',
        //   'Access-Control-Allow-Origin':'*',
          "Access-Control-Request-Headers": 'Content-Type,Authorization',
          "Authorization":`${username}:${password}`
        },
        // body:JSON.stringify({username:username,password:password})
    }
    try {
        const resp = await fetch(API_http+'/login', options);
        if (!resp.ok) {
            console.log('resp.ok');
            const data = await resp.json();
   
            throw (Error(`Error: ${resp.status},${data.msg}`));
        }
        const data = await resp.json() ;
 
        return data;
    } catch (err) {
        throw err;
    }
}
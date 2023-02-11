// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0


//Change to your own API Gateway endpoint
//Tips: don't miss the slash when you replace the endpoint url, or it will cause the bad request
const API_endpoint = 'https://xxxx.amazonaws.com'+'/';
export const getAnswer = async(respid,text,headers) =>{
    const options ={
        method:'POST',
        // mode: 'no-cors',
        headers:headers,
        body:JSON.stringify({id:respid,prompt:text})
    }
    try {
        var resp = await fetch(API_endpoint+'chat', options);
       
        if (!resp.ok){
            const data = await resp.text();
            throw (Error(`Error: ${resp.status},${data}`));
        } 
        var data = await resp.json() ;
        return data;
    } catch (err) {
        throw err;
    }
}

export const loginAuth = async(username,password) =>{
    const options ={
        method:'POST',
        headers:{'Content-Type': 'application/json',
          'Access-Control-Allow-Origin':'*'},
        body:JSON.stringify({username:username,password:password})
    }
    try {
        var resp = await fetch(API_endpoint+'login', options);
        if (!resp.ok) {
            console.log('resp.ok');
            const data = await resp.json();
   
            throw (Error(`Error: ${resp.status},${data.msg}`));
        }
        var data = await resp.json() ;
 
        return data;
    } catch (err) {
        throw err;
    }
}

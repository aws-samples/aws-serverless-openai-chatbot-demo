// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from "react";
import { useAuth } from "../commons/use-auth";
import {
    Navigate,
    useLocation
  } from "react-router-dom";


export default function RequireAuth({ children,redirectPath }) {
    //use context
  const auth = useAuth();
  // console.log(auth);
 
  let isAuthenticated = false;
  let istokenExpired = false;
  if(!auth.user){
    isAuthenticated = false;
  }
  else{
    // console.log('auth:',JSON.stringify(auth.user));
    isAuthenticated = auth.user.isAuthorized;

  }
  const location = useLocation();
  if (isAuthenticated && (!istokenExpired)) {
    return children;
  }else
    return <Navigate to={redirectPath} state={{ from: location }} />;
  };
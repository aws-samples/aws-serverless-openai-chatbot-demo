// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from "react";
import { useAuth } from "../commons/use-auth";
import {
    Navigate,
    useLocation
  } from "react-router-dom";
import {useLocalStorage} from '../commons/localStorage';

const LOCAL_TOKEN = 'chatbot-auth-info';

export default function RequireAuth({ children,redirectPath }) {
    //use context
  const auth = useAuth();
  const [local_stored_tokendata] = useLocalStorage(LOCAL_TOKEN, null);
  const user = auth.user? auth.user:local_stored_tokendata;

  let isAuthenticated = false;
  let istokenExpired = false;
  if(!user){
    isAuthenticated = false;
  }
  else{
    isAuthenticated = user.isAuthorized;
  }
  const location = useLocation();
  if (isAuthenticated && (!istokenExpired)) {
    return children;
  }else
    return <Navigate to={redirectPath} state={{ from: location }} />;
  };
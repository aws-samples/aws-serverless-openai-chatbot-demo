// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState, useRef, useEffect } from "react";
import {
  TopNavHeader,
  modelParamsCtx,
  useModelParams,
  defaultModelParams,
} from "./components";
import { lightGreen, grey, blue, green } from "@mui/material/colors";
import IconButton from "@mui/material/IconButton";
import SendIcon from "@mui/icons-material/Send";
import {
  Box,
  Stack,
  Avatar,
  OutlinedInput,
  List,
  ListItem,
  Alert,
  Collapse,
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import useWebSocket from "react-use-websocket";
import { Formik, Form, useFormik } from "formik";
import { useAuthToken } from "../commons/use-auth";
import { useLocalStorage } from "../commons/localStorage";
// import botlogo from "../ai-logo.svg";
import botlogo from "../chatbot-logo.svg";

import { API_socket } from "../commons/apigw";


const params_local_storage_key = "chatbot_params_local_storage_key";

const MAX_CONVERSATIONS = 4;

function generateUniqueId() {
  const timestamp = Date.now();
  const randomNumber = Math.random();
  const hexadecimalString = randomNumber.toString(16).slice(3);

  return `id-${timestamp}-${hexadecimalString}`;
}

const BOTNAME = "AI";

function stringToColor(string) {
  let hash = 0;
  let i;
  /* eslint-disable no-bitwise */
  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  /* eslint-enable no-bitwise */
  return color;
}

function stringAvatar(name) {
  return {
    sx: {
      bgcolor: stringToColor(name),
    },
    //   children: `${name.split(' ')[0][0]}${name.split(' ')[1][0]}`,
    children: name[0].toUpperCase() + name[name.length - 1].toUpperCase(),
  };
}

const MsgItem = ({ who, text }) => {
  let id = 0;
  const newlines = text.split("\n").map((it) => (
    <span key={id++}>
      {it}
      <br />
    </span>
  ));
  return who !== BOTNAME ? (
    <ListItem sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <TextItem sx={{ bgcolor: lightGreen[400] }}> {newlines}</TextItem>
        <Avatar {...stringAvatar(who)} />
      </Stack>
    </ListItem>
  ) : (
    <ListItem>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Avatar src={botlogo} alt={"AIBot"} />
        <TextItem> {newlines}</TextItem>
      </Stack>
    </ListItem>
  );
};

const TextItem = (props) => {
  const { sx, ...other } = props;
  return (
    <Box
      sx={{
        p: 1.2,
        // m: 1.2,
        whiteSpace: "normal",
        bgcolor: grey[100],
        color: grey[800],
        border: "1px solid",
        borderColor: grey[300],
        borderRadius: 2,
        fontSize: "0.875rem",
        fontWeight: "700",
        ...sx,
      }}
      {...other}
    />
  );
};

const ChatBox = ({ msgItems, loading }) => {
  const [loadingtext, setLoaderTxt] = useState(".");
  const intervalRef = useRef(0);

  function handleStartTick() {
    let textContent = "";
    const intervalId = setInterval(() => {
      setLoaderTxt((v) => v + ".");
      textContent += ".";
      if (textContent.length > 5) {
        setLoaderTxt(".");
        textContent = "";
      }
    }, 500);
    intervalRef.current = intervalId;
  }

  function handleStopClick() {
    const intervalId = intervalRef.current;
    if (intervalId) clearInterval(intervalId);
  }
  useEffect(() => {
    if (loading) {
      handleStartTick();
    } else {
      handleStopClick();
    }
  }, [loading]);

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behaviour: "smooth" });
    }
  }, [msgItems.length]);
  const items = msgItems.map((msg) => (
    <MsgItem key={generateUniqueId()} who={msg.who} text={msg.text} />
  ));

  return (
    <List
      sx={{
        position: "relative",
        overflow: "auto",
      }}
    >
      {/* <MsgItem id={generateUniqueId()} who="AI" text ={"Welcome! Can I help you? 我还会中文以及其他999种语言"}/> */}
      {items}
      {loading ? <MsgItem who={BOTNAME} text={loadingtext} /> : <div />}
      <ListItem ref={scrollRef} />
    </List>
  );
};

const InputSection = ({
  setmsgItems,
  conversations,
  setConversations,
  setLoading,
  sendMessage,
}) => {
  const [local_stored_crediential] = useLocalStorage("chat-login-token", null);
  const username = local_stored_crediential.username;
  // const [conversations,setConversations] = useState([]);
  const modelParams = useModelParams();
  // console.log(modelParams);
  // const authheader = useAuthorizedHeader();
  const formik = useFormik({
    initialValues: {
      prompt: "",
    },
    onSubmit: (values) => {
      if (values.length === 0) {
        return;
      }
      const respid = generateUniqueId();
      setmsgItems((prev) => [
        ...prev,
        { id: respid, who: username, text: values.prompt },
      ]);

      //save conversations
      // setConversations((prev)=>[...prev,values.prompt]);
      // const prompt = conversations.join(" ")+"\n"+values.prompt;
      setConversations((prev) => [
        ...prev,
        { role: "user", content: values.prompt },
      ]);
      const messages = [
        ...conversations,
        { role: "user", content: values.prompt },
      ];
      formik.resetForm();
      setLoading(true);
      sendMessage({
        action: "sendprompt",
        payload: { msgid: respid, messages: messages, params: modelParams },
      });
    },
  });

  return (
    <Formik>
      <Form onSubmit={formik.handleSubmit}>
        <Box
          sx={{
            display: "flex",
            direction: "row",
            justifyContent: "space-between",
            alignItems: "center",

            borderTop: 1,
            p: 1,
            bgcolor: grey[50],
            borderColor: grey[400],

            // gridTemplateColumns: "24px auto auto",
            position: "fixed",
            width: "100%",
            // height:32,
            bottom: 0,
          }}
        >
          <IconButton
            aria-label="refresh"
            edge="start"
            color="info"
            sx={{ ml: 0.25 }}
            onClick={() => {
              setConversations([]);
              setmsgItems([]);
              setLoading(false);
            }}
          >
            <RestartAltIcon size="medium" />
          </IconButton>
          <OutlinedInput
            sx={{ bgcolor: "white", flexGrow: 1, ml: 0.5, mr: 0.5 }}
            value={formik.values.prompt}
            onChange={(event) => {
              formik.setValues({ prompt: event.target.value });
            }}
            multiline
            placeholder="Please enter text"
          />
          <IconButton
            aria-label="send"
            edge="end"
            color="primary"
            type="submit"
            sx={{ mr: 2 }}
          >
            <SendIcon size="large" />
          </IconButton>
        </Box>
      </Form>
    </Formik>
  );
};

const ChatPage = () => {
  const [alertopen, setAlertOpen] = useState(false);
  const [onMessageBuildFlag, setOnMessageBuildFlag] = useState(false);
  const [localStoredParams, setLocalStoredParams] = useLocalStorage(
    params_local_storage_key,
    null
  );
  const [msgItems, setmsgItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modelParams, setModelParams] = useState(
    !localStoredParams ? defaultModelParams : localStoredParams.modelParams
  );
  const [conversations, setConversations] = useState([]);

  const didUnmount = useRef(false);
  const authtoken = useAuthToken();

  useEffect(() => {
    setLocalStoredParams({ ...localStoredParams, modelParams: modelParams });
  }, [modelParams]);
  const onMessageCallback = ({ data }) => {
    //save conversations
    const resp = JSON.parse(data);
    console.log(resp);
    //如果是build idx回复的msg
    if (resp.msgid === 'build_idx'){
      setOnMessageBuildFlag(true);
    }
    if (resp.role && resp.msgid !== 'build_idx')
      setConversations((prev) => [
        ...prev,
        { role: resp.role, content: resp.text.content },
      ]);

    if (conversations.length > MAX_CONVERSATIONS) {
      setConversations((prev) =>
        prev.slice(conversations.length - MAX_CONVERSATIONS)
      );
    }
    setLoading(false);
    setmsgItems((prev) => [
      ...prev,
      { id: resp.msgid, who: BOTNAME, text: resp.text.content.trimStart() },
    ]);
    // console.log(conversations);
  };

  // setup websocket
  const { sendMessage, sendJsonMessage, getWebSocket, readyState } =
    useWebSocket(API_socket, {
      queryParams: authtoken,
      onOpen: () =>
        setmsgItems((prev) => [
          ...prev,
          {
            id: generateUniqueId(),
            who: BOTNAME,
            text: "Welcome! Can I help you?",
          },
        ]),
      onMessage: onMessageCallback,
      retryOnError: true,
      onClose: () => {
        setLoading(false);
        setAlertOpen(true);
        // setmsgItems((prev) => [...prev,{ id: generateUniqueId(),
        //   who:BOTNAME,
        //   text: 'Sorry something wrong, remote socket connection closed'}])
      },
      onError: () => {
        setLoading(false);
        console.log('connection error');
        // setAlertOpen(true);
      },
      shouldReconnect: (closeEvent) => {
        return true;
      },
      reconnectAttempts: 100,
      reconnectInterval: (attemptNumber) =>
        Math.min(Math.pow(2, attemptNumber) * 1000, 10000),
    });

  useEffect(() => {
    return () => {
      didUnmount.current = true;
    };
  }, []);
  return (
    <modelParamsCtx.Provider value={[modelParams,onMessageBuildFlag,setOnMessageBuildFlag]}>
      <Stack direction="column" spacing={2} sx={{ pb: 5 }}>
        <TopNavHeader
          setModelParams={setModelParams}
          sendMessage={sendJsonMessage}
        />
         <Collapse in={alertopen}>
        <Alert severity="error"
        action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => {
                setAlertOpen(false);
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
          sx={{ mb: 2 }}
        
        >{'!!There is web connection error, please refresh'}
        </Alert>
        </Collapse>
        <ChatBox msgItems={msgItems} loading={loading} />
        <InputSection
          setmsgItems={setmsgItems}
          conversations={conversations}
          setConversations={setConversations}
          setLoading={setLoading}
          sendMessage={sendJsonMessage}
        />
      </Stack>
    </modelParamsCtx.Provider>
  );
};

export default ChatPage;

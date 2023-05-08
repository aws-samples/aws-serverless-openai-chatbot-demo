// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as React from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import { grey } from "@mui/material/colors";
import Typography from "@mui/material/Typography";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Drawer from "@mui/material/Drawer";
import Divider from "@mui/material/Divider";
import {
  Stack,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormHelperText,
  Switch,
  OutlinedInput,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { MuiFileInput } from "mui-file-input";
import { putFile, Upload_S3, listDocIdx } from "../commons/apigw";
import { useAuthToken, useAuthUserInfo } from "../commons/use-auth";
import { useState, useEffect, useContext } from "react";
import { useLocalStorage } from "../commons/localStorage";

const params_local_storage_key = "chatbot_params_local_storage_key";
const drawerWidth = 360;
const models = ["chatglm-6b", "gpt-3.5-turbo"]; //['text-davinci-003','code-davinci-002'];
const embeddings = ["all-minilm-l6-v2", "openai"];
export const modelParamsCtx = React.createContext();
export const useModelParams = () => {
  return useContext(modelParamsCtx)[0];
};

export const useOnMessageCtx = () => {
  return [useContext(modelParamsCtx)[1], useContext(modelParamsCtx)[2]];
};

export const defaultModelParams = {
  frequency_penalty: 0,
  temperature: 0.1,
  max_tokens: 2000,
  presence_penalty: 0,
  top_p: 1,
  model_name: models[0],
  embedding_model_name:embeddings[0],
};

const CustSlider = ({
  name,
  label,
  desc,
  min,
  max,
  defaultValue,
  step,
  setModelParams,
}) => {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          pl: 1,
          pr: 1,
        }}
      >
        <div>{label}</div>
        <div>{value}</div>
      </Box>
      <Box
        sx={{ pl: 1, pr: 1, color: grey[600], fontSize: 10 }}
      >{`(${desc})`}</Box>
      <Slider
        size="medium"
        defaultValue={defaultValue}
        step={step}
        min={min}
        max={max}
        aria-label={label}
        valueLabelDisplay="auto"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setModelParams((prev) => ({ ...prev, [name]: event.target.value }));
        }}
      />
    </Box>
  );
};
function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

const UploadComp = ({ setModelParams, sendMessage }) => {
  const modelParams = useModelParams();
  const [localStoredParams, setLocalStoredParams] = useLocalStorage(
    params_local_storage_key,
    null
  );
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingBuild, setLoadingBuild] = useState(false);
  const [errorstate, setErrorState] = useState(false);
  const [uploadsuccess, setUploadSuccess] = useState(false);
  const [buildsuccess, setBuildsuccess] = useOnMessageCtx();
  const [enableQA, setEnableQA] = useState(
    localStoredParams.modelParams
      ? localStoredParams.modelParams.use_qa ?? false
      : false
  );
  const [helperMsg, setHelperMsg] = useState("Upload and click save");
  const [alldocs, setAlldocs] = useState([]);
  const token = useAuthToken();
  const authuser = useAuthUserInfo();
  const [selectDoc, setSelectDoc] = useState("");

  const handleSelectChange = (event) => {
    setSelectDoc(event.target.value);
    setModelParams((prev) => ({
      ...prev,
      file_idx: event.target.value,
      use_qa: true,
      username: authuser.username,
    }));
    setLocalStoredParams({
      ...localStoredParams,
      file_idx: event.target.value,
      username: authuser.username,
    });

    setEnableQA(true);
  };

  useEffect(() => {}, []);

  const headers = {
    Authorization: token.token,
    // "Content-Type": "text/plain",
    // "Content-Type": "application/pdf",
  };
  const handleChange = (newFile) => {
    setFile(newFile);
    console.log(newFile);
  };

  useEffect(() => {
    if (buildsuccess) {
      setLoadingBuild(false);
      setHelperMsg("Build completed");
    }
    listDocIdx(headers)
      .then((response) => {
        // console.log(response);
        setAlldocs(response);
      })
      .catch((error) => {
        console.log(error);
      });
  }, [buildsuccess]);

  useEffect(() => {
    setUploadSuccess(false);
    setErrorState(false);
    setBuildsuccess(false);
    setHelperMsg("Browse select and Click Upload");
  }, [file]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (file) {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      // console.log(formData);
      putFile(file.name, formData, headers)
        .then((response) => {
          console.log(response);
          setLoading(false);
          setUploadSuccess(true);
          setLocalStoredParams({
            ...localStoredParams,
            lastuploadedfilename: file.name,
            username: authuser.username,
          });
          setHelperMsg("Upload file success, click build button");
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
          setErrorState(true);
          setHelperMsg("Upload file error");
        });
    }
  };

  const handleBuild = async (event) => {
    event.preventDefault();
    if (file) {
      setLoadingBuild(true);
      sendMessage({
        action: "sendprompt",
        payload: {
          msgid: "build_idx",
          messages: "",
          bucket: Upload_S3,
          object: file.name,
          username: authuser.username,
          params: modelParams,
        },
      });
      setHelperMsg("Build index start, please wait a few mins");
      // setLoadingBuild(false);
      // setBuildsuccess(true);
      setLocalStoredParams({
        ...localStoredParams,
        lastbuiltfilename: file.name,
        username: authuser.username,
      });
    }
  };

  return (
    // <Box component="form" onSubmit={handleUpload} noValidate sx={{ mt: 1 }}>
    <Stack spacing={2}>
      <MuiFileInput
        type="file"
        color={errorstate ? "error" : "primary"}
        error={errorstate}
        FormHelperTextProps={{ error: errorstate }}
        inputProps={{ accept: ".txt" }}
        variant="outlined"
        helperText={helperMsg}
        label="Ask questions towards your own document"
        value={file}
        onChange={handleChange}
      />
      <LoadingButton
        onClick={handleUpload}
        type="submit"
        fullWidth
        variant="contained"
        loading={loading}
        disabled={uploadsuccess || !file}
      >
        1. Upload
      </LoadingButton>
      <LoadingButton
        onClick={handleBuild}
        type="submit"
        fullWidth
        variant="contained"
        loading={loadingBuild}
        disabled={!uploadsuccess || buildsuccess}
      >
        2. Build Index
      </LoadingButton>
      <FormControl sx={{ m: 1, minWidth: 180, maxWidth:drawerWidth }}>
        <InputLabel id="select-docs-label">Select the doc to use</InputLabel>
        <Select
          value={selectDoc}
          onChange={handleSelectChange}
          label="Select the doc to use"
        >
          {/* {embeddings.map((model, key) => (
            <MenuItem key={key} value={`all_docs_idx_${model.toLowerCase()}`}>
              {`All /${model.toLowerCase()}`}
            </MenuItem>
          ))} */}
          {alldocs.map(
            ({ filename, username, index_name, embedding_model }) => (
              <MenuItem key={index_name} value={index_name}>
                {`${filename} /${embedding_model.toLowerCase()} /created by:${username}`}
              </MenuItem>
            )
          )}
        </Select>
        <FormHelperText></FormHelperText>
      </FormControl>
      <FormGroup>
        <FormControlLabel
          // disabled={!localStoredParams.lastbuiltfilename}
          checked={enableQA}
          onChange={(event) => {
            if (!event.target.checked) {
              setSelectDoc("");
            }
            setEnableQA(event.target.checked);
            setModelParams((prev) => ({
              ...prev,
              use_qa: event.target.checked,
              file_name: localStoredParams.lastbuiltfilename,
              username: authuser.username,
            }));
          }}
          // control={<Switch />} label={`Use ${buildsuccess?'lastest':'last'} built:\n${localStoredParams.lastbuiltfilename??''}`} />
          control={<Switch />}
          label={`Use the doc for query`}
        />
      </FormGroup>
    </Stack>
    // </Box>
  );
};

const ToolBox = ({ toggleDrawer, setModelParams, sendMessage }) => {
  // const [modelName, setModelName] = useState(models[0]);
  const modelParams = useModelParams();
  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth } }}
      aria-label="setting panel"
    >
      <Toolbar sx={{ justifyContent: "flex-end" }}>
      {/* <Box sx={{ textAlign: "center", fontSize: "h6.fontSize" }}>
          {"Change model settings"}
        </Box> */}
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
        {"Change model settings"}
          </Typography>
        <IconButton
          aria-label="back"
          edge="start"
          color="inherit"
          onClick={toggleDrawer(false)}
          size="medium"
        >
          <CloseIcon sx={{ color: grey[900] }} />
        </IconButton>
      </Toolbar>
      <Divider />
      <Stack
        direction="column"
        spacing={3}
        sx={{ alignItems: "stretch", m: 2 }}
      >
        <FormControl variant="filled" sx={{ m: 1, minWidth: 180 }}>
          <InputLabel id="model-select-label">{"LLM Model"}</InputLabel>
          <Select
            labelId="select-standard-label-1"
            id="simple-select-1"
            value={modelParams.model_name ?? models[0]}
            onChange={(event) => {
              // setModelName(event.target.value);
              setModelParams((prev) => ({
                ...prev,
                model_name: event.target.value,
              }));
            }}
            label="model"
          >
            {models.map((v) => (
              <MenuItem value={v} key={v}>
                {v}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="filled" sx={{ m: 1, minWidth: 180 }}>
          <InputLabel id="embedding-select-label">
            {"Embedding Model"}
          </InputLabel>
          <Select
            labelId="select-standard-label-2"
            id="simple-select-2"
            value={modelParams.embedding_model_name ?? embeddings[0]}
            onChange={(event) => {
              setModelParams((prev) => ({
                ...prev,
                embedding_model_name: event.target.value,
              }));
            }}
            label="model"
          >
            {embeddings.map((v) => (
              <MenuItem value={v} key={v}>
                {v}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <CustSlider
          defaultValue={modelParams.temperature ?? 0.1}
          step={0.01}
          min={0}
          max={1}
          label="Temperature"
          name="temperature"
          desc="increasing the model's likelihood to talk about new topics"
          setModelParams={setModelParams}
        />
        <CustSlider
          defaultValue={modelParams.max_tokens ?? 2000}
          step={1}
          min={1}
          max={4000}
          label="Maximum Tokens"
          name="max_tokens"
          desc="Maximum number of tokens to generate, 1 token is roughly 4 characters for normal English"
          setModelParams={setModelParams}
        />
        <UploadComp setModelParams={setModelParams} sendMessage={sendMessage} />
      </Stack>
    </Box>
  );
};

export const TopNavHeader = ({ setModelParams, sendMessage }) => {
  const [toggleState, setToggleState] = React.useState(false);
  const toggleDrawer = (open) => (event) => {
    if (
      event.type === "keydown" &&
      (event.key === "Tab" || event.key === "Shift")
    ) {
      return;
    }
    setToggleState(open);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="sticky">
        <Toolbar>
          <IconButton
            aria-label="back"
            edge="start"
            color="inherit"
            size="small"
            href="/"
          >
            <ArrowBackIosIcon sx={{ color: grey[100] }} />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AI Assistant
          </Typography>
          <IconButton
            size="small"
            edge="end"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={toggleDrawer(true)}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>

        <Drawer
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          // variant="temporary"
          open={toggleState}
          onClose={toggleDrawer(false)}
          anchor="right"
        >
          <ToolBox
            toggleDrawer={toggleDrawer}
            setModelParams={setModelParams}
            sendMessage={sendMessage}
          />
        </Drawer>
      </AppBar>
    </Box>
  );
};

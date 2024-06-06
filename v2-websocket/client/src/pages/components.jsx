// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import { grey } from '@mui/material/colors';
import Typography from '@mui/material/Typography';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import {Stack,FormControl,InputLabel,Select,MenuItem,Slider} from '@mui/material';

const drawerWidth = 300;
const models = ['gpt-4o','gpt-4-turbo','gpt-3.5-turbo','gpt-3.5-turbo-0301'];//['text-davinci-003','code-davinci-002'];

export const modelParamsCtx = React.createContext();
export const useModelParams =()=>{
    return React.useContext(modelParamsCtx)
}

export const defaultModelParams = {
  frequency_penalty: 0,
  max_tokens:4096,
  presence_penalty: 0,
  top_p:1,
  model_name:models[0],
}

const CustSlider = ({name,label,desc,min,max,defaultValue,step,setModelParams})=>{
  const [value,setValue] = React.useState(defaultValue);
  return (
    <Box>
        <Box 
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          pl: 1,
          pr: 1,
        }}>
          <div>{label}</div>
          <div>{value}</div>
        </Box>
        <Box  sx={{ pl: 1,pr:1, color: grey[600],fontSize:10 }}>{`(${desc})`}</Box>
    <Slider
        size="medium"
        defaultValue={defaultValue}
        step={step}
        min={min}
        max={max}
        aria-label={label}
        valueLabelDisplay="auto"
        value={value}
        onChange={event => {
          setValue(event.target.value);
          setModelParams(prev=>({...prev,[name]:event.target.value}));
        }
        }
      />
    </Box>
  )
}

const ToolBox =({toggleDrawer,setModelParams})=>{
  const [modelName, setModelName] = React.useState(models[0]);
  return (
    <Box
    component="nav"
    sx={{ width: {sm:drawerWidth} }}
    aria-label="setting panel"
  >
      <Toolbar sx={{ justifyContent: "flex-end" }}>
      <IconButton aria-label="back" edge="start" color="inherit" 
          onClick={toggleDrawer(false)}
          size="small">
          <CloseIcon sx={{ color: grey[900] }}/>
      </IconButton>
      </Toolbar>
      <Divider />
      <Stack direction="column" spacing={3} sx={{ alignItems: "stretch",m:2}}>
      <Box sx={{ textAlign: 'center',fontSize: 'h6.fontSize' }}>
         {"Change model settings"} 
      </Box>
      <FormControl variant="filled" sx={{ m: 1, minWidth: 120 }}>
        <InputLabel id="model-select-label">{"Model"}</InputLabel>
        <Select
          labelId="select-standard-label"
          id="simple-select"
          value={modelName??models[0]}
          onChange={event=>{
            setModelName(event.target.value);
            setModelParams(prev => ({...prev,model_name:event.target.value}));
          }}
          label="model"
        >
          {models.map(v => (<MenuItem value={v} key={v}>{v}</MenuItem>))}
        </Select>
      </FormControl>
      <CustSlider
        defaultValue={defaultModelParams.max_tokens??2000}
        step={1}
        min={1}
        max={4000}
        label="Maximum Tokens"
        name="max_tokens"
        desc="Maximum number of tokens to generate, 1 token is roughly 4 characters for normal English"
        setModelParams={setModelParams}
      />
      <CustSlider
        defaultValue={defaultModelParams.top_p??1}
        step={0.01}
        min={0}
        max={1}
        label="Top-P"
        name="top_p"
        desc="Controls diveristy"
        setModelParams={setModelParams}
      />
      <CustSlider
        defaultValue={defaultModelParams.frequency_penalty??0}
        step={0.01}
        min={-2}
        max={2}
        name="frequency_penalty"
        label="Frequency Penalty"
        desc="Positive values penalize new tokens based on their existing frequency in the text. decreasing the model's likelihood to repeat the same line verbatim."
        setModelParams={setModelParams}
      />
      <CustSlider
        defaultValue={defaultModelParams.presence_penalty??0}
        step={0.01}
        min={-2}
        max={2}
        name="presence_penalty"
        label="Presence Penalty"
        desc="increasing the model's likelihood to talk about new topics."
        setModelParams={setModelParams}
      />
      </Stack>
    </Box>
  )
}


export const TopNavHeader =({setModelParams})=>{

const [toggleState, setToggleState] = React.useState(false);
const toggleDrawer = (open) =>
    (event) => {
      if (
        event.type === 'keydown' &&
        (event.key === 'Tab' ||
          event.key === 'Shift')
      ) {
        return;
      }
      setToggleState(open);
    };


return (
<Box sx={{ flexGrow: 1 }}>
<AppBar position="sticky" >
<Toolbar>
<IconButton aria-label="back" edge="start" color="inherit" size="small" href='/'>
        <ArrowBackIosIcon sx={{ color: grey[100] }}/>
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
            onClick = {toggleDrawer(true)}
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
  anchor = 'right'
>
<ToolBox toggleDrawer={toggleDrawer} setModelParams={setModelParams}/>
</Drawer>

</AppBar>

</Box>

)}


// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import MenuIcon from '@mui/icons-material/Menu';
import { grey } from '@mui/material/colors';
import Typography from '@mui/material/Typography';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';

export const TopNavHeader =()=>{
return (
<Box sx={{ flexGrow: 1 }}>
<AppBar position="sticky" >
<Toolbar>
<IconButton aria-label="back" edge="start" color="inherit" size="small" href='/'>
        <ArrowBackIosIcon sx={{ color: grey[100] }}/>
      </IconButton>
      <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          AI Assit
      </Typography>
      <IconButton
            size="small"
            edge="end"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
</Toolbar>
</AppBar>

</Box>

)}


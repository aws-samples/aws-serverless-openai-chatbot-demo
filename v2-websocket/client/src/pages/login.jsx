// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, {useEffect, useState} from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useAuth } from '../commons/use-auth';
import {useNavigate} from 'react-router-dom';
import { useLocalStorage } from '../commons/localStorage';

function Copyright(props) {
  return (
    <Typography variant="body2" color="text.secondary" align="center" {...props}>
      {'Copyright © '}
      <Link color="inherit" href="">
        My Website
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

const theme = createTheme();

const SignIn = () => {
  const auth = useAuth();
  const [checked, setChecked] = useState(false);
  const [local_stored_crediential,setLocalStoredCred] = useLocalStorage('chat-login-token',null)
  const [errorstate, setErrorState] = useState(false);
  const [errormsg, setErrMsg] = useState('');
  const [username, setUsername] = useState();
  const [password, setPassword] = useState();
  const navigate = useNavigate();
  const isAuthenticated = auth.user && auth.user.isAuthorized;
  useEffect(()=>{
        if(isAuthenticated){
            navigate('/chat');
        }
    },[navigate,isAuthenticated]);

  useEffect(()=>{
    if (local_stored_crediential) {
        setChecked(local_stored_crediential.checked);
        if (local_stored_crediential.checked) {
          setUsername(local_stored_crediential.username);
          setPassword(local_stored_crediential.password);
        }
    }
  },[checked,local_stored_crediential]);
  const handleSubmit = (event) => {
    event.preventDefault();
    const formdata = new FormData(event.currentTarget);
    auth.signin(formdata.get('username'),formdata.get('password'))
    .then((data)=>{
      console.log(data);
      setLocalStoredCred({username:formdata.get('username'),
                    password:formdata.get('password'),
                   checked:checked});
      if (!(data?data.isAuthorized:false)){
        setErrorState(true);
        setErrMsg(data.body.message);
      }

    })
    .catch(error =>{ 
      setErrorState(true);
      setErrMsg(error.message);
    })

  };

  return (
    <ThemeProvider theme={theme}>
      <Container component="main" maxWidth="xs">
        <CssBaseline />
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
            <LockOutlinedIcon />
          </Avatar>
          <Typography component="h1" variant="h5">
            Sign in
          </Typography>
         
          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          {/* <FormControl> */}
            <TextField
              error = {errorstate}
              // helperText ={errormsg}
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              value ={username??''}
              onChange = {(event) => { setUsername(event.target.value);}}
              autoFocus
            />
            <TextField
              error = {errorstate}
              helperText ={errormsg}
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              value ={password??''}
              onChange = {(event) => { setPassword(event.target.value);}}
              autoComplete="current-password"
            />
            <FormControlLabel
              control={<Checkbox 
                checked={checked}
                onChange={(event) =>{
                  setChecked(event.target.checked);
                  setLocalStoredCred({checked:event.target.checked});
                }}
               color="primary" />}
              label="Remember me"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Sign In
            </Button>
            <Grid container>
              {/* <Grid item xs>
                <Link href="#" variant="body2">
                  Forgot password?
                </Link>
              </Grid>
              <Grid item>
                <Link href="#" variant="body2">
                  {"Don't have an account? Sign Up"}
                </Link>
              </Grid> */}
            </Grid>
            {/* </FormControl> */}
          </Box>

        </Box>
        <Copyright sx={{ mt: 8, mb: 4 }} />
      </Container>
    </ThemeProvider>
  );
}

export default SignIn;
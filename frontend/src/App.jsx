import React from 'react'
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
 import { ToastContainer, toast } from 'react-toastify';

const App = () => {
  return <>
  <BrowserRouter>
  <Routes>
    <Route path='/' element={<Home/>}/>
    <Route path='/login' element={<Login/>}/>


  </Routes>
  <ToastContainer/>
  </BrowserRouter>
  
  
  </>
    
  
}

export default App
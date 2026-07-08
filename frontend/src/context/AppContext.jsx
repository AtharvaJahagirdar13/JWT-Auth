import { server } from '../main';
import {createContext, useContext, useEffect} from 'react'
import axios from 'axios';
import { useState } from 'react';
import api from '../apiIntercepter';

const AppContext = createContext(null)

export const AppProvider = ({children}) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuth, setIsAuth] = useState(false);

    async function fetchUser() {
        try {
           const { data } = await api.get(`/api/v1/login`);
            setUser(data)
            setIsAuth(true)
        } catch (error) {
            console.log(error)
            
        }finally{
            setLoading(false);
        }
    }
    useEffect( () => {
        fetchUser(); 
    }, []);

    return (
    <AppContext.Provider value={{setIsAuth,isAuth,user,setUser,loading}}>
        {children}
        </AppContext.Provider>
    );
};

export const AppData = () => {
    const context = useContext(AppContext)

    if(!context) throw new Error("AppData must be used within an AppProvider");
    return context;
}
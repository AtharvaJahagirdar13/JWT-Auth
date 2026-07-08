import axios from 'axios';


const server = "http://localhost:5000"

const api = axios.create({
    baseURL:server,
    withCredentials:true,

});

let isRefreshing = false; //flag to manage if its refreshing 
let failedQueue = []; //array to keep requests which failed 

// either resolve or reject request 
const processQueue = (error,token=null) =>{
    failedQueue.forEach((prom)=>{
        if(error) {
            prom.reject(error);
        }else {
            prom.resolve(token);
        }

    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response)=> response,
    async(error)=> {
        const originalRequest = error.config;

        if(error.response?.status===403 && !originalRequest._retry){
            if(isRefreshing){
                return new Promise((resolve,reject)=>{
                    failedQueue.push({resolve,reject});
                }).then(()=>{
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await api.post("/api/v1/refresh");
                processQueue(null)
                return api(originalRequest);

            } catch (error) {
                processQueue(error,null)
                return Promise.reject(error);

                
            }finally{
                isRefreshing=false;
            }
        }

        return Promise.reject(error);

});

export default api;


//flow of code
// Request fails with 403.
// Check if this request has already been retried.
// If another refresh is already happening
// Put the request into failedQueue.
// Wait.
// First request starts refresh.
// /refresh endpoint sends a new access token (cookie).
// Wake up all waiting requests.
// Retry all of them.
// If refresh fails
// Reject everyone.
// User eventually gets logged out
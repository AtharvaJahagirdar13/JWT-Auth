

import { loginSchema, registerSchema } from "../config/zod.js";
import { redisClient } from "../index.js";
import TryCatch from "../middlewares/TryCatch.js";
import sanitize from "mongo-sanitize";
import { User } from "../models/User.js";
import bcrypt from "bcrypt"
import crypto  from "crypto"
import sendMail from "../config/sendmail.js";
import { getOtpHtml, getVerifyEmailHtml } from "../config/html.js";
import { generateAccessToken, generateToken, verifyRefreshToken } from "../config/generateToken.js";

export const registerUser = TryCatch(async(req,res) => {
    const sanitizedBody = sanitize(req.body)

    const validation = registerSchema.safeParse(sanitizedBody);
    
    if(!validation.success){
        const zodError= validation.error;
        let firstErrorMessage = "Validation failed";
        let allErrors = [];
        
        if(zodError ?.issues && Array.isArray(zodError.issues)){
            allErrors=zodError.issues.map((issue)=>({
                field:issue.path ? issue.path.join(".") : "unknown",
                message: issue.message || "Validation error",
                code:issue.code,

         }));
         firstErrorMessage = allErrors[0]?.message || "Validation error"
        }
        return res.status(400).json({
            message:zodError,
            error:allErrors,
        });
    }

    const {name,email,password} =validation.data;

    const rateLimitKey = `register-rate-limit:${req.ip}:${email}`;

    if(await redisClient.get(rateLimitKey)){
        return res.status(429).json({
            message:"Too many request, try again later",   //429 is for too many requests
        })
    }

    const existingUser = await User.findOne({email})

    if(existingUser){
        return res.status(400).json({
            message:"User already exists",
        });

    
    }

    const hashPassword = await bcrypt.hash(password, 10);

    //http:localhost:5173/asjkkajsck

    const verifyToken = crypto.randomBytes(32).toString("hex");

    const verifyKey = `verify:${verifyToken}`

    const datatoStore = JSON.stringify({
        name,
        email,
        password:hashPassword,
    });

    await redisClient.set(verifyKey,datatoStore,{EX:300});

    const subject = "Verify Your email for Account Creation ";
    const html = getVerifyEmailHtml({email,token:verifyToken});

    await sendMail({email,subject,html})

    await redisClient.set(rateLimitKey, "true", {EX:60});


    res.json({
        message:"If your email is valid , a verification email has been sent!, It will expire in 5 mins"
    });
});

export const verifyUser = TryCatch(async(req,res)=> {

    const {token} = req.params;
    
    if(!token){
        return res.status(400).json({
            message:"verification token is required!"
            
        });

    }

    const verifyKey = `verify:${token}`;

    const userDataJson = await redisClient.get(verifyKey)

    if(!userDataJson){
         return res.status(400).json({
            message:"verification Link is expired!"
            
        });
    }

    await redisClient.del(verifyKey)

    const userData = JSON.parse(userDataJson);

    const newUser = await User.create({
        name: userData.name,
        email:userData.email,
        password:userData.password,
    });

    res.status(201).json({
        message:"email verified successfully!  Your Account has been created successfully!",
        user:{_id:newUser._id,name:newUser.name,email:newUser.email},
    });

});

export const loginUser = TryCatch(async(req,res)=> {
    const sanitizedBody = sanitize(req.body)

    const validation = loginSchema.safeParse(sanitizedBody);
    
    if(!validation.success){
        const zodError= validation.error;
        let firstErrorMessage = "Validation failed";
        let allErrors = [];
        
        if(zodError ?.issues && Array.isArray(zodError.issues)){
            allErrors=zodError.issues.map((issue)=>({
                field:issue.path ? issue.path.join(".") : "unknown",
                message: issue.message || "Validation error",
                code:issue.code,

         }));
         firstErrorMessage = allErrors[0]?.message || "Validation error"
        }
        return res.status(400).json({
            message:zodError,
            error:allErrors,
        });
    }

    const {email,password} =validation.data;

    const rateLimitKey = `login-rate-limit:${req.ip}:${email}`;

    if(await redisClient.get(rateLimitKey)){
        return res.status(429).json({
            message:"Too many request, try again later",   //429 is for too many requests
        });
    }


    const user = await User.findOne({email})

    if(!user){
        return res.status(400).json({
            message:"Invalid Credentials",
        });
    }

    const comparePassword = await bcrypt.compare(password,user.password);
    if(!comparePassword){
        return res.status(400).json({
            message:"Invalid Credentials",
        });
    }

    const otp = Math.floor(100000 + Math.random() * 90000).toString();

    const otpKey = `otp:${email}`;
    await redisClient.set(otpKey,JSON.stringify(otp), {
        EX: 300,
    });

    const subject = "OTP for verification";

    const html = getOtpHtml({email, otp});

    await sendMail({email, subject, html});

    await redisClient.set(rateLimitKey, "true", {
        EX:60,
    });

    res.json({
        message: "if Your email is valid , an OTP has been sent!  it will be valid for 5 mins"
    });






});

export const verifyOtp = TryCatch(async(req,res)=> {
    const {email,otp} = req.body

    if(!email || !otp){
        return res.status(400).json({
            message:"please provide all details",
        });
    }

    const otpKey = `otp:${email}`;

    const storedOTPString = await redisClient.get(otpKey);

    if(!storedOTPString){
        return res.status(400).json({
            message:"OTP is expired",
        });
    }

    const storedOTP = JSON.parse(storedOTPString)

    if(storedOTP !== otp){
        return res.status(400).json({
            message:"Invalid OTP!"
        })
    }

    await redisClient.del(otpKey);

    let user = await User.findOne({email});

    const tokenData = await generateToken(user._id,res);

    res.status(200).json({
        message:`Welcome!${user.name}`,
        user,
    });


});

export const myProfile = TryCatch(async(req,res)=> {
    const user = req.user;

    res.json(user);
})

export const refreshToken = TryCatch(async(req,res)=>{
    const refreshToken = req.cookies.refreshToken;

    if(!refreshToken){
        return res.status(401).json({
            message:"Invalid refresh Token",
        });
    }

    const decode = await verifyRefreshToken(refreshToken)

    if(!decode){
        return res.status(401).json({
            message:"invalid refresh Token",
        });
    }

    generateAccessToken(decode.id,res);

    res.status(200).json({
        message:"token refreshed",
    });

});
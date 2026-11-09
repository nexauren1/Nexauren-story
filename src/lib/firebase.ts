import {getApp,getApps,initializeApp} from "firebase/app";
import {getAuth,GoogleAuthProvider} from "firebase/auth";
import {getFirestore} from "firebase/firestore";

// Firebase Web configuration is public client metadata.
// Access control must be enforced by Firebase Authentication and Firestore Rules.
const config={
 apiKey:import.meta.env.PUBLIC_FIREBASE_API_KEY || "AIzaSyAU6DuEDfUhXXIZCtpGXdlO1k_SGi1KkJw",
 authDomain:import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "nexauren-story-e8327.firebaseapp.com",
 projectId:import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || "nexauren-story-e8327",
 storageBucket:import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "nexauren-story-e8327.firebasestorage.app",
 messagingSenderId:import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "311732324848",
 appId:import.meta.env.PUBLIC_FIREBASE_APP_ID || "1:311732324848:web:3f8e90385d7381f8df3535",
 measurementId:import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID || "G-9026ZTZKZ7"
};
export function getFirebaseClient(){
 const app=getApps().length?getApp():initializeApp(config);
 return {app,auth:getAuth(app),db:getFirestore(app),googleProvider:new GoogleAuthProvider()};
}
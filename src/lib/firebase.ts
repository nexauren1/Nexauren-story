import {getApp,getApps,initializeApp} from "firebase/app";
import {getAuth,GoogleAuthProvider} from "firebase/auth";
import {getFirestore} from "firebase/firestore";
const config={
 apiKey:import.meta.env.PUBLIC_FIREBASE_API_KEY,
 authDomain:import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
 projectId:import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
 storageBucket:import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
 messagingSenderId:import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
 appId:import.meta.env.PUBLIC_FIREBASE_APP_ID
};
export function getFirebaseClient(){
 if([config.apiKey,config.authDomain,config.projectId,config.appId].some(v=>!v))
  throw new Error("Firebase ainda não está configurado. Adiciona as variáveis PUBLIC_FIREBASE_*.");
 const app=getApps().length?getApp():initializeApp(config);
 return {app,auth:getAuth(app),db:getFirestore(app),googleProvider:new GoogleAuthProvider()};
}
import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
if(process.env.NEXT_PUBLIC_CLOSER_LOCAL_DEMO_ENABLED==="true"&&typeof window!=="undefined"){
  const project=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID??"",authHost=process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST??"",firestoreHost=process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST??"";
  const localPage=/^(?:127\.0\.0\.1|localhost)$/.test(window.location.hostname);
  if(!localPage||!project.startsWith("demo-")||!/^(?:127\.0\.0\.1|localhost):\d+$/.test(authHost)||!/^(?:127\.0\.0\.1|localhost):\d+$/.test(firestoreHost))throw new Error("Unsafe local-demo Firebase configuration.");
  connectAuthEmulator(auth,`http://${authHost}`,{disableWarnings:true});const[host,port]=firestoreHost.split(":");connectFirestoreEmulator(db,host,Number(port));
}
export const storage = getStorage(app);

export default app;

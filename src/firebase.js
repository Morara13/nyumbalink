import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDCpFIDAPoSGm_esy8TmgkocAlfmPhLcdM",
  authDomain: "nyumbalink-aa9e5.firebaseapp.com",
  projectId: "nyumbalink-aa9e5",
  storageBucket: "nyumbalink-aa9e5.firebasestorage.app",
  messagingSenderId: "471702228280",
  appId: "1:471702228280:web:7770f661d02a887e8485cd"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBxBEDfl2cddauoimBSg5I-F7iuDWu8ODo",
  authDomain: "maisuite-flow.firebaseapp.com",
  projectId: "maisuite-flow",
  storageBucket: "maisuite-flow.firebasestorage.app",
  messagingSenderId: "320266198559",
  appId: "1:320266198559:web:ada1e9945a5c6c10b57f2a",
  measurementId: "G-BYSYR9QN3J"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

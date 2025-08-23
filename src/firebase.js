// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// WARNING: For security, it is strongly recommended to use environment variables
// instead of hardcoding these keys in your code.
const firebaseConfig = {
  apiKey: "AIzaSyD7h7fGXyPyLoOmBFsDF_BPNpylB916pMs",
  authDomain: "laughing-octo-winner.firebaseapp.com",
  projectId: "laughing-octo-winner",
  storageBucket: "laughing-octo-winner.firebasestorage.app",
  messagingSenderId: "929553672352",
  appId: "1:929553672352:web:46d4632a49fe56593bc1c5",
  measurementId: "G-ZDXCRP06WB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // <-- ADD THIS IMPORT

// Your web app's Firebase configuration
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

// --- THIS IS THE FIX ---
// Initialize Cloud Firestore and export it for other files to use
export const db = getFirestore(app);

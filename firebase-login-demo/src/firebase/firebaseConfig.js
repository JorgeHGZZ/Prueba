// filepath: firebase-login-demo/src/firebase/index.js
const firebaseConfig = {
    apiKey: "AIzaSyCmKS915zbGQSuWcB0Ww_AfJarsEitCWGs",
    authDomain: "classhub-7fcb1.firebaseapp.com",
    databaseURL: "https://classhub-7fcb1-default-rtdb.firebaseio.com",
    projectId: "classhub-7fcb1",
    storageBucket: "classhub-7fcb1.firebasestorage.app",
    messagingSenderId: "900567668775",
    appId: "1:900567668775:web:40b5af38f8a85113d75602",
    measurementId: "G-VG4Y7LDZF6"
};

// Import Firebase modules
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Export the auth object for use in other modules
export { auth };
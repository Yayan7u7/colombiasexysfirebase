// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBhE1RdlF_h3crbzGgqyaBnY5DjvuRxmyE",
    authDomain: "rvcs-db0a2.firebaseapp.com",
    projectId: "rvcs-db0a2",
    storageBucket: "rvcs-db0a2.firebasestorage.app",
    messagingSenderId: "109890350204",
    appId: "1:109890350204:web:0f73f67e642e28f58d6df9",
    measurementId: "G-RRQHPNG7C2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

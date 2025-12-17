// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyABs90lOGiMuEWUj62i65g-dY3rCaTnR6k",
    authDomain: "rocm-blogs-test.firebaseapp.com",
    projectId: "rocm-blogs-test",
    storageBucket: "rocm-blogs-test.firebasestorage.app",
    messagingSenderId: "248925756272",
    appId: "1:248925756272:web:2102dde3ba6b0349d4cdb5",
    measurementId: "G-738WZ8Z8GL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };

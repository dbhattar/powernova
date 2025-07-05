// Firebase config template. Replace with your own Firebase project config.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDQiD7r9N1AT4l5aoI0Y3yj6YY2DKt7czM",
  authDomain: "powernova-6753c.firebaseapp.com",
  projectId: "powernova-6753c",
  storageBucket: "powernova-6753c.firebasestorage.app",
  messagingSenderId: "724076757764",
  appId: "1:724076757764:web:cd328f37ba41d2deaac651",
  measurementId: "G-XL0MQCC6TN"
};

let app;
let auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  console.log('Firebase Auth initialized successfully');
  console.log('Auth domain:', firebaseConfig.authDomain);
  console.log('Project ID:', firebaseConfig.projectId);
  
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

export { auth };

// Firebase config template. Replace with your own Firebase project config.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
let db;
let storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  console.log('Firebase initialized successfully');
  console.log('Auth domain:', firebaseConfig.authDomain);
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Storage bucket:', firebaseConfig.storageBucket);
  
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

export { auth, db, storage };

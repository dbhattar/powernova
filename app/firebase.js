// Firebase config template. Replace with your own Firebase project config.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';

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
let analytics = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  console.log('Firebase Auth initialized successfully');
  console.log('Auth domain:', firebaseConfig.authDomain);
  console.log('Project ID:', firebaseConfig.projectId);
  
  // Initialize Analytics only if supported and consent is given
  if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
        console.log('Firebase Analytics initialized');
      }
    });
  }
  
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

// Helper function to initialize analytics after consent
function initializeAnalytics() {
  if (typeof window !== 'undefined' && !analytics) {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
        logEvent(analytics, 'page_view');
        console.log('Firebase Analytics initialized after consent');
      }
    });
  }
}

// Helper function to track events (only if analytics is initialized)
function trackEvent(eventName, parameters = {}) {
  if (analytics) {
    logEvent(analytics, eventName, parameters);
  }
}

export { auth, analytics, initializeAnalytics, trackEvent, getCookieConsent };

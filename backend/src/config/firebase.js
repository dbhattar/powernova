const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * Initialize Firebase Admin SDK
 * Uses firebase-service-account.json file if available, otherwise falls back to environment variables
 */
function initializeFirebase() {
  if (admin.apps.length > 0) {
    console.log('✅ Firebase Admin already initialized');
    return admin;
  }

  try {
    // Try to use service account JSON file first
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      console.log('🔧 Initializing Firebase Admin with service account file...');
      
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
        storageBucket: 'powernova-6753c.firebasestorage.app'
      });
      
      console.log('✅ Firebase Admin initialized successfully with service account file');
      console.log(`📋 Project ID: ${serviceAccount.project_id}`);
      console.log(`📧 Service Account: ${serviceAccount.client_email}`);
      
    } else {
      // Fallback to environment variables
      console.log('⚠️  Service account file not found, using environment variables...');
      
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('Missing required Firebase environment variables. Please provide firebase-service-account.json or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
      }
      
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: 'powernova-6753c.firebasestorage.app'
      });
      
      console.log('✅ Firebase Admin initialized with environment variables');
      console.log(`📋 Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
    }

  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    console.error('📋 Setup instructions:');
    console.error('   1. Download service account key from Firebase Console');
    console.error('   2. Save it as backend/firebase-service-account.json');
    console.error('   3. Or set environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    throw error;
  }

  return admin;
}

// Initialize Firebase
const firebaseAdmin = initializeFirebase();

module.exports = firebaseAdmin;

const firebaseService = require('./src/services/firebaseService');

// Test the Firebase token verification function
const token = process.argv[2];

if (!token) {
  console.log('Usage: node test_firebase_token.js <firebase_token>');
  process.exit(1);
}

console.log('🔧 Testing Firebase token verification...');

firebaseService.verifyIdToken(token)
  .then(decodedToken => {
    console.log('✅ Token verification successful!');
    console.log('User ID:', decodedToken.uid);
    console.log('Email:', decodedToken.email);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Token verification failed:', error.message);
    process.exit(1);
  });

#!/usr/bin/env node

/**
 * Test script to simulate a frontend API call to list documents
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'powernova-6753c'
});

async function testApiCall() {
  console.log('🔍 Testing API call...');
  
  try {
    // Create a test token for the user
    const testUserId = '6mB5hZWnmKQzVkiPaptb2mqTQMs1';
    const customToken = await admin.auth().createCustomToken(testUserId);
    
    console.log('✅ Created custom token');
    
    // Make API call with the token
    const response = await fetch('http://localhost:3001/api/documents', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${customToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ API Response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testApiCall().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

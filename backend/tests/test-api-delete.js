#!/usr/bin/env node

// Load environment variables first
require('dotenv').config({ path: '../.env' });

const admin = require('../src/config/firebase');
const firebaseService = require('../src/services/firebaseService');

async function testApiEndpoint() {
  try {
    const userId = '6mB5hZWnmKQzVkiPaptb2mqTQMs1';

    console.log('🌐 Testing API endpoint deletion...');
    
    // Step 1: Create a test document
    console.log('\n1️⃣ Creating test document...');
    const documentData = {
      fileName: 'api-test-document.txt',
      fileSize: 150,
      fileType: 'text/plain',
      userId: userId,
      uploadedAt: new Date(),
      processingStatus: 'completed',
      isProcessed: true,
      chunkCount: 1
    };
    
    const docId = await firebaseService.saveDocumentMetadata(documentData);
    console.log('✅ Test document created:', docId);

    // Step 2: Create a custom token for testing
    console.log('\n2️⃣ Creating test token...');
    const customToken = await admin.auth().createCustomToken(userId);
    console.log('✅ Custom token created (length:', customToken.length, ')');

    // Step 3: Test the DELETE endpoint
    console.log('\n3️⃣ Testing DELETE endpoint...');
    
    const fetch = require('node-fetch');
    
    const response = await fetch(`http://localhost:3001/api/documents/${docId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${customToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers));

    if (response.ok) {
      const result = await response.json();
      console.log('✅ DELETE response:', result);
    } else {
      const error = await response.text();
      console.log('❌ DELETE error:', error);
    }

    // Step 4: Verify deletion
    console.log('\n4️⃣ Verifying deletion...');
    try {
      await firebaseService.getDocument(docId);
      console.log('❌ ERROR: Document still exists!');
    } catch (error) {
      console.log('✅ Document successfully deleted from Firestore');
    }

    console.log('\n🎉 API endpoint test completed!');

  } catch (error) {
    console.error('❌ API test error:', error);
  }
}

testApiEndpoint().then(() => {
  console.log('\n📋 Test completed');
  process.exit(0);
});

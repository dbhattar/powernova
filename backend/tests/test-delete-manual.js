#!/usr/bin/env node

// Load environment variables first
require('dotenv').config({ path: '../.env' });

const admin = require('../src/config/firebase');
const firebaseService = require('../src/services/firebaseService');
const vectorService = require('../src/services/vectorService');
const fs = require('fs');
const path = require('path');

async function testDeleteDocument() {
  try {
    const userId = '6mB5hZWnmKQzVkiPaptb2mqTQMs1';

    console.log('🧪 Testing document deletion process...');
    console.log(' User ID:', userId);

    // Step 1: Upload a test document
    console.log('\n1️⃣ Uploading test document...');
    const testFilePath = path.join(__dirname, 'test-document.txt');
    const testContent = fs.readFileSync(testFilePath, 'utf8');
    
    const documentData = {
      fileName: 'test-document.txt',
      fileSize: testContent.length,
      fileType: 'text/plain',
      userId: userId,
      uploadedAt: new Date(),
      processingStatus: 'pending',
      isProcessed: false,
      chunkCount: 0
    };
    
    const docId = await firebaseService.saveDocumentMetadata(documentData);
    console.log('✅ Test document uploaded:', docId);

    // Step 2: Process the document (simulate vectorization)
    console.log('\n2️⃣ Processing document...');
    await vectorService.processDocument(docId, userId, 'test-document.txt', testContent);
    
    await firebaseService.updateDocumentStatus(docId, {
      processingStatus: 'completed',
      isProcessed: true,
      chunkCount: 1
    });
    
    console.log('✅ Document processed and vectorized');

    // Step 3: Test deletion
    console.log('\n3️⃣ Testing deletion...');
    console.log('📄 Document ID:', docId);

    // Check if document exists
    const doc = await firebaseService.getDocument(docId);
    console.log('✅ Document found before deletion:', {
      id: docId,
      fileName: doc.fileName,
      userId: doc.userId,
      fileSize: doc.fileSize
    });

    // Delete from vector store
    console.log('\n🗑️  Deleting from vector store...');
    const vectorResult = await vectorService.deleteDocument(docId, userId);
    console.log('✅ Vector deletion result:', vectorResult);
    
    // Delete metadata from Firestore
    console.log('\n🗑️  Deleting from Firestore...');
    await firebaseService.deleteDocument(docId);
    console.log('✅ Firestore deletion completed');

    // Verify deletion
    console.log('\n4️⃣ Verifying deletion...');
    try {
      await firebaseService.getDocument(docId);
      console.log('❌ ERROR: Document still exists after deletion!');
    } catch (error) {
      console.log('✅ Document successfully deleted - not found in Firestore');
    }

    console.log('\n🎉 Document deletion test completed successfully!');

  } catch (error) {
    console.error('❌ Delete test error:', error);
  }
}

testDeleteDocument().then(() => {
  console.log('\n📋 Test completed');
  process.exit(0);
});

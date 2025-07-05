#!/usr/bin/env node

// Quick test to verify what documents exist and should be shown in frontend
require('dotenv').config({ path: '../.env' });
const admin = require('../src/config/firebase');

async function listCurrentDocuments() {
  try {
    console.log('📋 Current documents in Firestore:');
    console.log('=====================================');
    
    const snapshot = await admin.firestore().collection('documents').get();
    
    if (snapshot.empty) {
      console.log('❌ No documents found');
      return;
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📄 ID: ${doc.id}`);
      console.log(`   📝 Name: ${data.fileName}`);
      console.log(`   👤 User: ${data.userId}`);
      console.log(`   📊 Status: ${data.processingStatus}`);
      console.log(`   📅 Uploaded: ${data.uploadedAt?.toDate?.() || data.uploadedAt}`);
      console.log('   -------------------------');
    });
    
    console.log('');
    console.log('💡 If the frontend shows different documents, it has cached/stale data.');
    console.log('💡 Try refreshing the app or checking the loadUserDocuments function.');
    
  } catch (error) {
    console.error('❌ Error listing documents:', error);
  }
}

listCurrentDocuments().then(() => process.exit(0));

#!/usr/bin/env node

/**
 * Test script to verify document listing works
 * This will help us see if the uid/userId field issue is resolved
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'powernova-6753c'
});

const db = admin.firestore();

async function testDocumentListing() {
  console.log('🔍 Testing document listing...');
  
  try {
    // Get all documents to see what fields they have
    const snapshot = await db.collection('documents').get();
    
    console.log('📋 Total documents in database:', snapshot.size);
    
    if (snapshot.empty) {
      console.log('❌ No documents found in database');
      return;
    }
    
    // Analyze field names
    const fieldAnalysis = { uid: 0, userId: 0, other: 0 };
    const sampleDocs = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      sampleDocs.push({
        id: doc.id,
        uid: data.uid,
        userId: data.userId,
        fileName: data.fileName
      });
      
      if (data.uid) fieldAnalysis.uid++;
      if (data.userId) fieldAnalysis.userId++;
      if (!data.uid && !data.userId) fieldAnalysis.other++;
    });
    
    console.log('📊 Field analysis:');
    console.log('  Documents with uid field:', fieldAnalysis.uid);
    console.log('  Documents with userId field:', fieldAnalysis.userId);
    console.log('  Documents with neither field:', fieldAnalysis.other);
    
    console.log('\n📄 Sample documents:');
    sampleDocs.slice(0, 3).forEach(doc => {
      console.log(`  - ${doc.fileName} (uid: ${doc.uid}, userId: ${doc.userId})`);
    });
    
    // Test specific user
    const testUserId = '6mB5hZWnmKQzVkiPaptb2mqTQMs1';
    console.log(`\n🔍 Testing for user: ${testUserId}`);
    
    // Test with userId field
    const userIdSnapshot = await db.collection('documents').where('userId', '==', testUserId).get();
    console.log('📄 Documents with userId field:', userIdSnapshot.size);
    
    // Test with uid field
    const uidSnapshot = await db.collection('documents').where('uid', '==', testUserId).get();
    console.log('📄 Documents with uid field:', uidSnapshot.size);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDocumentListing().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

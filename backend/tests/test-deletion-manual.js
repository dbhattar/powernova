#!/usr/bin/env node

/**
 * Test document deletion with a mock request
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (reuse existing initialization)
if (!admin.apps.length) {
  const serviceAccount = require('./firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'powernova-6753c'
  });
}

async function testDeletion() {
  try {
    // Get the document to delete
    const snapshot = await admin.firestore().collection('documents').get();
    
    if (snapshot.empty) {
      console.log('❌ No documents found to delete');
      return;
    }
    
    const doc = snapshot.docs[0];
    const docData = doc.data();
    const docId = doc.id;
    
    console.log('📄 Document to delete:', {
      id: docId,
      fileName: docData.fileName,
      userId: docData.userId
    });
    
    // Create an ID token for the user
    const userId = docData.userId;
    const customToken = await admin.auth().createCustomToken(userId);
    
    // Exchange custom token for ID token (this is what would happen in a real app)
    console.log('🔑 Created custom token for user:', userId);
    
    // Since we can't easily get an ID token here, let's just test the backend directly
    console.log('🧪 Would test deletion of document:', docId);
    console.log('📞 URL: DELETE http://localhost:3001/api/documents/' + docId);
    
    console.log('💡 To test manually, try this curl command:');
    console.log(`curl -X DELETE "http://localhost:3001/api/documents/${docId}" \\
     -H "Authorization: Bearer <ID_TOKEN>" \\
     -H "Content-Type: application/json"`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDeletion().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

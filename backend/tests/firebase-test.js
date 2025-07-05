// Simple Firebase test file to check connection
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

// Test Firebase connection
export const testFirebaseConnection = async () => {
  console.log('Testing Firebase connection...');
  
  try {
    // Test 1: Check if Firebase is initialized
    console.log('✓ Firebase initialized');
    console.log('Auth:', auth);
    console.log('Firestore:', db);
    
    // Test 2: Check auth state
    const user = auth.currentUser;
    console.log('Current user:', user ? user.uid : 'none');
    
    if (user) {
      // Test 3: Try to write to Firestore
      console.log('Testing Firestore write...');
      try {
        const testDoc = await addDoc(collection(db, 'test'), {
          message: 'Hello from Firebase test',
          timestamp: new Date(),
          uid: user.uid
        });
        console.log('✓ Firestore write successful:', testDoc.id);
        
        // Test 4: Try to read from Firestore
        console.log('Testing Firestore read...');
        const q = query(collection(db, 'test'), where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        console.log('✓ Firestore read successful, docs:', querySnapshot.size);
        
      } catch (firestoreError) {
        console.error('✗ Firestore error:', firestoreError);
        console.error('Error code:', firestoreError.code);
        console.error('Error message:', firestoreError.message);
        
        if (firestoreError.code === 'permission-denied') {
          console.log('🔑 This appears to be a Firestore security rules issue');
          console.log('You need to update your Firestore security rules to allow authenticated users to read/write');
          console.log('Suggested rules:');
          console.log(`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`);
        } else if (firestoreError.code === 'invalid-argument') {
          console.log('❌ Invalid argument error - check your document structure');
        } else {
          console.log('❌ Unknown Firestore error:', firestoreError.code);
        }
      }
    } else {
      console.log('⚠️  No user signed in, skipping Firestore tests');
    }
    
  } catch (error) {
    console.error('✗ Firebase connection error:', error);
  }
};

// Call this function to test
window.testFirebase = testFirebaseConnection;

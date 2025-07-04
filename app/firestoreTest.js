import { db, auth } from './firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

// Manual check for documents in Firestore
export const checkDocumentsInFirestore = async () => {
  console.log('Manually checking documents in Firestore...');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No user signed in');
      alert('Please sign in first');
      return;
    }
    
    console.log('✓ Checking documents for user:', user.uid);
    
    // Query documents collection
    const documentsRef = collection(db, 'documents');
    const q = query(
      documentsRef,
      where('uid', '==', user.uid),
      orderBy('uploadedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    console.log('Query completed, document count:', querySnapshot.size);
    
    if (querySnapshot.empty) {
      console.log('📄 No documents found for this user');
      alert('No documents found in Firestore for your account');
    } else {
      console.log('📄 Found documents:');
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Document:', {
          id: doc.id,
          fileName: data.fileName,
          uploadedAt: data.uploadedAt?.toDate?.() || data.uploadedAt,
          isProcessed: data.isProcessed,
          uid: data.uid
        });
      });
      
      alert(`Found ${querySnapshot.size} document(s) in Firestore. Check console for details.`);
    }
    
  } catch (error) {
    console.error('❌ Error checking documents:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'failed-precondition') {
      console.error('🔍 This might be a missing Firestore index issue');
      alert('Missing Firestore index. Check Firebase console for index creation prompts.');
    } else if (error.code === 'permission-denied') {
      console.error('🔑 Permission denied accessing documents collection');
      alert('Permission denied. Check your Firestore security rules.');
    } else {
      alert(`Error checking documents: ${error.message}`);
    }
  }
};

// Add to window for easy testing
if (typeof window !== 'undefined') {
  window.checkDocumentsInFirestore = checkDocumentsInFirestore;
}

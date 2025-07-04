import { db, auth } from './firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

// Test conversations in Firestore
export const testConversations = async () => {
  console.log('Testing conversations in Firestore...');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No user signed in');
      alert('Please sign in first to test conversations');
      return;
    }
    
    console.log('✓ Checking conversations for user:', user.uid);
    
    // Query conversations collection (without orderBy to avoid index requirement initially)
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('uid', '==', user.uid)
    );
    
    const querySnapshot = await getDocs(q);
    console.log('Query completed, conversation count:', querySnapshot.size);
    
    if (querySnapshot.empty) {
      console.log('💬 No conversations found for this user');
      alert('No conversations found in Firestore for your account');
    } else {
      console.log('💬 Found conversations:');
      const conversations = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        conversations.push({
          id: doc.id,
          prompt: data.prompt,
          response: data.response?.substring(0, 100) + '...',
          threadId: data.threadId,
          type: data.type,
          isFollowUp: data.isFollowUp,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          uid: data.uid
        });
      });
      
      // Sort manually by creation date (descending)
      conversations.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt?.seconds * 1000 || 0);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt?.seconds * 1000 || 0);
        return dateB - dateA;
      });
      
      conversations.forEach((conv, index) => {
        console.log(`${index + 1}. Conversation:`, conv);
      });
      
      alert(`Found ${querySnapshot.size} conversation(s) in Firestore. Check console for details.`);
    }
    
  } catch (error) {
    console.error('❌ Error checking conversations:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'permission-denied') {
      alert('Permission denied. Please check your Firestore security rules.');
    } else if (error.code === 'failed-precondition') {
      alert('Missing index. Please check the Firebase console for index requirements.');
    } else {
      alert('Error checking conversations: ' + error.message);
    }
  }
};

// Test saving a conversation
export const testSaveConversation = async () => {
  console.log('Testing conversation save...');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No user signed in');
      alert('Please sign in first to test saving');
      return;
    }
    
    console.log('✓ Testing save for user:', user.uid);
    
    // Import required functions
    const { addDoc, serverTimestamp } = await import('firebase/firestore');
    
    const testConversation = {
      uid: user.uid,
      threadId: 'test-thread-' + Date.now(),
      audioUri: null,
      transcription: null,
      prompt: 'Test question: What is power factor?',
      response: 'Test response: Power factor is the ratio of real power to apparent power.',
      type: 'text',
      isFollowUp: false,
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, 'conversations'), testConversation);
    console.log('✓ Test conversation saved with ID:', docRef.id);
    alert('Test conversation saved successfully! ID: ' + docRef.id);
    
  } catch (error) {
    console.error('❌ Error saving test conversation:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'permission-denied') {
      alert('Permission denied. Please check your Firestore security rules.');
    } else {
      alert('Error saving test conversation: ' + error.message);
    }
  }
};

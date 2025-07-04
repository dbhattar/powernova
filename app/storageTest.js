import { storage, auth } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Test Firebase Storage permissions
export const testStoragePermissions = async () => {
  console.log('Testing Firebase Storage permissions...');
  
  try {
    // Check if user is authenticated
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No user signed in');
      alert('Please sign in first to test storage permissions');
      return;
    }
    
    console.log('✓ User authenticated:', user.uid);
    
    // Create a test file
    const testContent = 'This is a test file for Firebase Storage permissions';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    const testFileName = `test_${Date.now()}.txt`;
    const testPath = `documents/${user.uid}/${testFileName}`;
    
    console.log('Testing upload to path:', testPath);
    
    // Test upload
    const storageRef = ref(storage, testPath);
    const uploadTask = uploadBytes(storageRef, testFile);
    
    const snapshot = await uploadTask;
    console.log('✓ Upload successful');
    
    // Test download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('✓ Download URL obtained:', downloadURL);
    
    // Test file deletion
    await deleteObject(storageRef);
    console.log('✓ File deleted successfully');
    
    console.log('🎉 All Firebase Storage tests passed!');
    alert('Firebase Storage permissions are working correctly!');
    
  } catch (error) {
    console.error('❌ Storage test failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'storage/unauthorized') {
      console.error('🔑 This is a permission error. Please update your Firebase Storage security rules.');
      alert('Storage permission denied. Please check the FIREBASE_STORAGE_SETUP.md file for instructions.');
    } else {
      alert(`Storage test failed: ${error.message}`);
    }
  }
};

// Add to window for easy testing
if (typeof window !== 'undefined') {
  window.testStoragePermissions = testStoragePermissions;
}

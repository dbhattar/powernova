# Firestore Security Rules Setup

## The Problem
You're seeing 400 Bad Request errors when trying to write to Firestore. This is because the default Firestore security rules deny all operations.

## The Solution
You need to update your Firestore security rules to allow authenticated users to read and write data.

## Steps to Fix:

### 1. Go to Firebase Console
- Open https://console.firebase.google.com/
- Select your project: `powernova-6753c`

### 2. Navigate to Firestore Database
- Click on "Firestore Database" in the left sidebar
- Click on the "Rules" tab

### 3. Update Security Rules
Replace the existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read and write all documents
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // More specific rules for your app:
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
    }
    
    match /test/{testId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Publish the Rules
- Click the "Publish" button
- Wait for the rules to be deployed

### 5. Test Again
- Go back to your app
- Click "Test Firebase Connection" again
- The Firestore operations should now succeed

## Security Notes
The rules above allow any authenticated user to read/write any document. For production, you should implement more restrictive rules based on your app's requirements.

## Alternative: Development Mode (Less Secure)
If you want to quickly test without authentication restrictions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ Warning**: This allows anyone to read/write your database. Only use for development!

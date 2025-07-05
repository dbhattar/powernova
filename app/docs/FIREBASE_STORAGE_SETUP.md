# Firebase Storage Security Rules Setup

## The Problem
You're seeing "User does not have permission to access" errors when trying to upload documents to Firebase Storage. This is because the default Firebase Storage security rules deny all operations.

## The Solution
You need to update your Firebase Storage security rules to allow authenticated users to upload and manage their documents.

## Steps to Fix:

### 1. Go to Firebase Console
- Open https://console.firebase.google.com/
- Select your project: `powernova-6753c`

### 2. Navigate to Storage
- Click on "Storage" in the left sidebar
- Click on the "Rules" tab

### 3. Update Storage Security Rules
Replace the existing rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to read/write their own documents
    match /documents/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write test files (for debugging)
    match /test/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### 4. Publish the Rules
- Click the "Publish" button
- Wait for the rules to be deployed

### 5. Test Again
- Go back to your app
- Try uploading a document again
- The upload should now succeed

## Security Features of These Rules

1. **User Isolation**: Users can only access their own documents (`userId` must match `request.auth.uid`)
2. **Authentication Required**: Only signed-in users can upload/download files
3. **Path Structure**: Documents are organized by user ID in `/documents/{userId}/` folders
4. **Test Support**: Includes a `/test/{userId}/` path for debugging
5. **Default Deny**: All other paths are explicitly denied

## Alternative: Development Mode (Less Secure)
If you want to quickly test without authentication restrictions:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ Warning**: This allows anyone to read/write your storage. Only use for development!

## File Path Structure
With these rules, your files will be stored as:
```
/documents/
  /{user-id-1}/
    /1234567890_document1.pdf
    /1234567891_document2.docx
  /{user-id-2}/
    /1234567892_document3.txt
```

## Testing the Rules
After updating the rules, you can test by:
1. Signing in to your app
2. Trying to upload a small document
3. Checking the Firebase Storage console to see if the file appears

The document should appear under `/documents/{your-user-id}/filename`

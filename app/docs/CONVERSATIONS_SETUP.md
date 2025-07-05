# Firestore Security Rules for Conversations

## The Issue
If the conversation history is not showing up, it's likely because the Firestore security rules are not configured to allow users to read/write conversations.

## Solution
You need to update your Firestore security rules to include the conversations collection.

## Steps to Fix:

### 1. Go to Firebase Console
- Open https://console.firebase.google.com/
- Select your project: `powernova-6753c`

### 2. Navigate to Firestore
- Click on "Firestore Database" in the left sidebar
- Click on the "Rules" tab

### 3. Update Firestore Security Rules
Your rules should look like this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own documents
    match /documents/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
    
    // Allow users to read/write their own conversations
    match /conversations/{conversation} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 4. Important: Create Required Index
You also need to create a composite index for conversations:

1. In Firebase Console, go to **Firestore Database**
2. Click on **Indexes** tab
3. Click **Create Index**
4. Set up the index with:
   - **Collection ID**: `conversations`
   - **Field 1**: `uid` (Ascending)
   - **Field 2**: `createdAt` (Descending)
   - **Query scopes**: Collection

### 5. Publish the Rules
- Click the "Publish" button in the Rules tab
- Wait for the rules to be deployed

### 6. Test the Conversations
- Go back to your app
- Try asking a question
- Check if the conversation appears in the history
- Use the "Check Conversations" debug button

## Testing Steps

1. **Sign in to your app**
2. **Ask a question** (text or voice)
3. **Check browser console** for save/load logs
4. **Open conversation history** - should show the conversation
5. **Use debug buttons** in document management:
   - "Check Conversations" - shows if conversations exist
   - "Test Save Conversation" - tests saving functionality

## Common Issues

### Issue 1: Permission Denied
```
Error: Missing or insufficient permissions
```
**Solution**: Make sure the security rules above are properly set

### Issue 2: Missing Index
```
Error: The query requires an index
```
**Solution**: Create the composite index as described in step 4

### Issue 3: No Conversations Show
- Check browser console for error messages
- Use "Check Conversations" debug button
- Verify you're signed in
- Make sure conversations are actually being saved

## Security Rules Explained

```javascript
// Allow users to read/write their own conversations
match /conversations/{conversation} {
  allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
}
```

This rule:
- Requires user authentication (`request.auth != null`)
- Only allows access to conversations where the `uid` field matches the authenticated user's ID
- Allows read, write, and create operations for the user's own conversations
- Prevents users from accessing other users' conversations

## Alternative: Development Mode (Less Secure)
For quick testing, you can use these permissive rules:

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

**⚠️ Warning**: This allows anyone to read/write all data. Only use for development!

# Conversation History Troubleshooting Checklist

## Quick Diagnosis
The conversation history not showing up is most likely due to one of these issues:

### 1. **Missing Firestore Security Rules**
- The `conversations` collection may not be included in your security rules
- **Solution**: Update Firestore rules to include conversations (see `CONVERSATIONS_SETUP.md`)

### 2. **Missing Firestore Index**
- The conversation query requires a composite index
- **Solution**: Create index for `conversations` collection with `uid` (asc) + `createdAt` (desc)

### 3. **Permission Issues**
- User authentication might not be working properly
- **Solution**: Verify user is signed in and has proper permissions

## Step-by-Step Testing

### Step 1: Check Current State
1. Open your app
2. Sign in with Google
3. Ask a question (text or voice)
4. Open browser console and look for these logs:
   - `✅ Conversation saved to Firestore successfully: [ID]`
   - `📞 Received conversation snapshot, size: [number]`

### Step 2: Use Debug Tools
1. Go to Document Management (click documents icon)
2. Scroll down to see debug buttons
3. Click "Check Conversations" - this will show if conversations exist
4. Click "Test Save Conversation" - this will test saving a new conversation

### Step 3: Check Firebase Console
1. Go to Firebase Console → Firestore Database
2. Look for `conversations` collection
3. Check if documents exist with your user ID

### Step 4: Verify Security Rules
1. In Firebase Console → Firestore → Rules
2. Make sure you have rules for `conversations` collection
3. Rules should allow read/write for authenticated users

### Step 5: Create Missing Index
1. In Firebase Console → Firestore → Indexes
2. Look for composite index on `conversations` collection
3. If missing, create index with:
   - Collection: `conversations`
   - Field 1: `uid` (Ascending)
   - Field 2: `createdAt` (Descending)

## Expected Console Logs

### When Saving Conversation:
```
Attempting to save to Firestore for user: [user-id]
Conversation data: { uid: "[user-id]", threadId: "[thread-id]", ... }
✅ Conversation saved to Firestore successfully: [document-id]
```

### When Loading Conversations:
```
Loading conversation history for user: [user-id]
📞 Received conversation snapshot, size: [number]
📄 Conversation doc: { id: "[doc-id]", prompt: "[question]...", ... }
📋 Loaded conversations for state: [number]
```

### When Opening History:
```
User should see conversations listed in the history view
```

## Common Error Messages

### "Permission Denied"
```
❌ Error loading conversations: FirebaseError: Missing or insufficient permissions
🔒 Firestore permission denied for conversations collection
```
**Fix**: Update Firestore security rules

### "Missing Index"
```
❌ Error loading conversations: FirebaseError: The query requires an index
📊 Missing Firestore index for conversations query
```
**Fix**: Create composite index in Firebase Console

### "No Conversations Found"
```
💬 No conversations found for this user
```
**Fix**: Make sure conversations are being saved (check save logs)

## Files to Check

1. **CONVERSATIONS_SETUP.md** - Firestore rules and index setup
2. **conversationTest.js** - Test functions for debugging
3. **App.js** - Main conversation logic with enhanced logging

## Quick Fix Commands

### Test if conversations exist:
```javascript
// In browser console
testConversations();
```

### Test saving a conversation:
```javascript
// In browser console
testSaveConversation();
```

### Check current user:
```javascript
// In browser console
console.log('Current user:', auth.currentUser);
```

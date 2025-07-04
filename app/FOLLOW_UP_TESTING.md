# Follow-up Questions Testing Guide

## Test Scenarios

### 1. **Basic Follow-up Flow**
- [ ] Ask an initial question
- [ ] Verify AI response appears
- [ ] Check "Ask Follow-up" button appears
- [ ] Click follow-up button
- [ ] Verify follow-up input opens
- [ ] Type follow-up question
- [ ] Send follow-up
- [ ] Verify response includes context from previous question

### 2. **Thread Storage**
- [ ] Ask question and follow-up
- [ ] Check browser console for Firestore saves
- [ ] Verify both messages have same threadId
- [ ] Check Firebase console for stored data

### 3. **History Integration**
- [ ] Complete a conversation with follow-ups
- [ ] Open conversation history
- [ ] Verify thread appears with follow-up indicators
- [ ] Click on thread entry
- [ ] Verify full conversation loads

### 4. **Thread Management**
- [ ] Start conversation with follow-ups
- [ ] Click "New Conversation" button
- [ ] Verify thread clears
- [ ] Start new question
- [ ] Verify new thread ID generated

### 5. **UI/UX Testing**
- [ ] Verify follow-up input is responsive
- [ ] Test Cancel button functionality
- [ ] Test Send button enable/disable states
- [ ] Verify thread display formatting
- [ ] Test multiline follow-up input

### 6. **Document Integration**
- [ ] Upload documents
- [ ] Ask question about documents
- [ ] Ask follow-up about same documents
- [ ] Verify document context maintained in follow-ups

### 7. **Error Handling**
- [ ] Test follow-up with network error
- [ ] Test follow-up without authentication
- [ ] Test follow-up with invalid input
- [ ] Verify graceful error handling

## Expected Behaviors

### Follow-up Button
- Appears after AI response
- Opens dedicated input field
- Input has proper focus and styling

### Conversation Context
- Follow-up questions include previous Q&A
- AI responses reference earlier conversation
- Context is maintained across multiple follow-ups

### Thread Storage
- All messages in thread share same threadId
- Firestore documents include isFollowUp flag
- Thread loading works correctly

### History Display
- Follow-up questions show "↳" prefix
- Thread indicators are visible
- Clicking thread loads full conversation

## Debug Console Commands

```javascript
// Check current thread
console.log('Current thread:', conversationThread);

// Check thread ID
console.log('Thread ID:', threadId);

// Check Firestore data
checkDocumentsInFirestore();
```

## Firebase Console Checks

1. **Firestore Database**
   - Navigate to `conversations` collection
   - Filter by your user UID
   - Check for threadId field
   - Verify isFollowUp flags

2. **Expected Document Structure**
```json
{
  "uid": "user-id",
  "threadId": "1234567890",
  "prompt": "What is power factor?",
  "response": "Power factor is...",
  "type": "text",
  "isFollowUp": false,
  "createdAt": "timestamp"
}
```

## Performance Considerations

- Thread loading should be fast
- Follow-up input should be responsive
- History should load quickly
- No memory leaks in thread management

## Known Limitations

- Thread context limited by OpenAI token limits
- Very long conversations may need context truncation
- Thread storage depends on Firestore availability

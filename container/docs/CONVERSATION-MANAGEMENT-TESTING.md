# Conversation Management - Testing Guide

## 🎯 Overview
This guide provides step-by-step instructions to test the complete conversation management feature with document upload capabilities.

## 🚀 Getting Started

### Prerequisites
1. **Backend API Running**: Ensure the API is running at `http://localhost:8000`
   ```bash
   docker ps --filter "name=powernova-api"
   ```

2. **Frontend App Running**: Ensure the chat app is running at `http://localhost:8081`
   ```bash
   docker ps --filter "name=powernova-chat-app"
   ```

3. **Test User Account**: You need a registered user account to test conversation features

### Access the Application
Open your browser and navigate to: **http://localhost:8081**

---

## 📝 Test Scenarios

### 1. Initial State (Guest Mode)
**Expected Behavior:**
- ✅ Welcome screen is displayed
- ✅ "Login" button visible in header
- ✅ Conversations sidebar is hidden (only visible for logged-in users)
- ✅ No document upload functionality visible
- ✅ Can send messages as guest (no conversation saved)

**Steps:**
1. Open http://localhost:8081
2. Verify welcome screen with example questions
3. Send a test message as guest
4. Verify response appears but no conversation is saved

---

### 2. User Login & Auto-Load Conversations
**Expected Behavior:**
- ✅ After login, conversations sidebar appears on the left
- ✅ Previous conversations automatically load
- ✅ User menu appears in header with username

**Steps:**
1. Click "Login" button in header
2. Enter your credentials and login
3. **Verify:**
   - Conversations sidebar slides in from the left
   - If you have previous conversations, they appear in the list
   - User menu button appears (shows username on desktop)
4. Check browser console for any errors (F12 → Console tab)

---

### 3. Create New Conversation
**Expected Behavior:**
- ✅ New conversation is created and becomes active
- ✅ Welcome screen appears
- ✅ Conversation appears in sidebar with "New Conversation" title
- ✅ First message auto-generates a better title

**Steps:**
1. While logged in, click **"New Conversation"** button (top of sidebar)
2. **Verify:**
   - New conversation appears in sidebar
   - It's highlighted as active (purple gradient background)
   - Shows timestamp "Just now"
   - Shows message count: "0 messages"
3. Send a message: "Tell me about renewable energy"
4. **Verify:**
   - After AI responds, conversation title updates to something descriptive
   - Message count updates to "2 messages"
   - Timestamp updates

---

### 4. Switch Between Conversations
**Expected Behavior:**
- ✅ Clicking a conversation loads its messages
- ✅ Active conversation is highlighted
- ✅ Previous messages are displayed correctly

**Steps:**
1. Create at least 2 conversations with different topics
2. Click on the first conversation in the sidebar
3. **Verify:**
   - Previous messages load in chat area
   - Conversation is highlighted as active
   - Message count and timestamp are accurate
4. Click on the second conversation
5. **Verify:**
   - Chat area clears and loads different messages
   - Second conversation becomes active
   - Context is completely separate (no message mixing)

---

### 5. Rename Conversation
**Expected Behavior:**
- ✅ Modal appears with current title pre-filled
- ✅ Title updates in sidebar after saving
- ✅ Changes persist after page reload

**Steps:**
1. Hover over a conversation in the sidebar
2. Click the **pencil icon** (✏️) that appears on the right
3. **Verify:**
   - "Rename Conversation" modal appears
   - Input field contains current title
4. Enter a new title: "My Custom Title"
5. Click "Save"
6. **Verify:**
   - Modal closes
   - Sidebar shows new title
   - Success notification appears
7. **Refresh the page** (F5)
8. **Verify:**
   - New title persists after reload

---

### 6. Upload Document to Conversation
**Expected Behavior:**
- ✅ File picker opens with correct file type filter
- ✅ Upload progress modal shows during upload
- ✅ Document appears in documents panel with status badge
- ✅ Document is linked only to current conversation

**Steps:**
1. Create or select a conversation
2. Click the **paperclip icon** (📎) next to the message input
3. **Verify:**
   - File picker opens
   - Accepts: PDF, DOCX, TXT, MD files
4. Select a PDF file (under 10MB)
5. **Verify:**
   - Upload progress modal appears
   - Progress bar fills to 100%
   - Modal shows "Processing..." then closes
6. Click the **documents icon** (📄) at the bottom right
7. **Verify:**
   - Documents panel slides in from right
   - Your uploaded document appears with:
     - PDF icon (red background)
     - File name
     - File size
     - Upload timestamp
     - Status badge: "COMPLETED" (green)

---

### 7. Document Status Progression
**Expected Behavior:**
- ✅ Status changes: pending → processing → completed
- ✅ Different badge colors for each status

**Upload a document and observe:**
1. **Pending**: Blue badge - File uploaded, waiting for processing
2. **Processing**: Yellow badge - Extracting text and generating embeddings
3. **Completed**: Green badge - Ready to use in RAG
4. **Failed** (if something goes wrong): Red badge

---

### 8. Use Uploaded Document in Chat
**Expected Behavior:**
- ✅ AI uses uploaded document content in responses
- ✅ Sources indicate document was used
- ✅ Document context is conversation-specific

**Steps:**
1. Upload a document with specific content (e.g., a research paper)
2. Wait for status badge to show "COMPLETED"
3. Ask a question related to document content: "Summarize the key findings"
4. **Verify:**
   - AI response references document content
   - Sources section shows your uploaded document
   - Response is based on document, not general knowledge
5. Switch to a **different conversation**
6. Ask the same question
7. **Verify:**
   - AI does NOT have access to the document (context isolation)
   - Response is generic or uses platform-wide documents only

---

### 9. Delete Document from Conversation
**Expected Behavior:**
- ✅ Confirmation dialog appears
- ✅ Document is removed from conversation only (not deleted from system)
- ✅ AI no longer uses that document in responses

**Steps:**
1. Open documents panel
2. Hover over a document
3. Click the **trash icon** (🗑️)
4. **Verify:**
   - Browser confirmation dialog: "Are you sure you want to delete..."
5. Click "OK"
6. **Verify:**
   - Document disappears from panel
   - Document count badge decreases
7. Send a message asking about document content
8. **Verify:**
   - AI no longer references that document

---

### 10. Delete Conversation
**Expected Behavior:**
- ✅ Confirmation dialog appears
- ✅ Conversation and all linked documents are removed
- ✅ Cannot be recovered (hard delete)

**Steps:**
1. Create a test conversation with uploaded documents
2. Hover over the conversation in sidebar
3. Click the **trash icon** (🗑️)
4. **Verify:**
   - Confirmation dialog: "Are you sure you want to delete this conversation?"
   - Warning: "This will also remove all documents and messages."
5. Click "OK"
6. **Verify:**
   - Conversation disappears from sidebar
   - If it was active, welcome screen appears
   - All messages and document links are deleted
7. **Refresh page**
8. **Verify:**
   - Conversation does not reappear (permanent deletion)

---

### 11. Logout & Persistence
**Expected Behavior:**
- ✅ Conversations sidebar hides
- ✅ Returns to guest mode
- ✅ After re-login, all conversations are restored

**Steps:**
1. Click user menu button (top right)
2. Click "Logout"
3. **Verify:**
   - Conversations sidebar slides out and hides
   - Returns to welcome screen
   - Login button appears
4. **Login again** with the same account
5. **Verify:**
   - All conversations are restored
   - Documents are still linked
   - Message history is intact

---

### 12. Mobile Responsive Design
**Expected Behavior:**
- ✅ Sidebar becomes overlay on mobile
- ✅ Toggle button appears to show/hide sidebar
- ✅ Documents panel takes full width on mobile

**Steps:**
1. Open browser DevTools (F12)
2. Click "Toggle Device Toolbar" (phone icon) or press Ctrl+Shift+M
3. Select "iPhone 12 Pro" or any mobile device
4. **Verify:**
   - Conversations sidebar is hidden by default
   - Toggle button appears to open sidebar
   - Sidebar becomes overlay (not pushing content)
   - Documents panel takes full screen width when opened
5. Test all features in mobile view

---

### 13. Error Handling
**Test these error scenarios:**

#### File Too Large
1. Upload a file > 10MB
2. **Verify:** Error message: "File size must be less than 10MB"

#### Invalid File Type
1. Try uploading a .exe or .zip file
2. **Verify:** Error message: "Only PDF, DOCX, TXT, and MD files are supported"

#### Network Error (Simulated)
1. Stop the API container: `docker stop powernova-api`
2. Try creating a conversation
3. **Verify:** Error notification appears
4. Restart API: `docker start powernova-api`

#### Unauthorized Access
1. Logout
2. Try directly accessing: http://localhost:8000/api/conversations
3. **Verify:** 401 Unauthorized response

---

### 14. RAG Hierarchical Search
**Expected Behavior:**
- ✅ AI searches: Platform docs + User-uploaded docs + Conversation docs
- ✅ Results are ranked by relevance
- ✅ Sources indicate document type

**Steps:**
1. Create a conversation and upload a document about "solar panels"
2. Ask: "What do you know about solar energy?"
3. **Verify AI response includes:**
   - Platform-wide documents (general renewable energy info)
   - Your uploaded document (specific solar panel details)
   - Sources show both types with badges:
     - 🌍 Platform (blue badge)
     - 📄 Uploaded (yellow badge)

---

### 15. Analytics Tracking
**Check Google Analytics events:**
1. Open browser DevTools → Network tab
2. Filter by "analytics" or "google-analytics"
3. **Perform these actions and verify events are sent:**
   - ✅ `conversation_created`
   - ✅ `conversation_switched`
   - ✅ `conversation_deleted`
   - ✅ `document_uploaded`
   - ✅ `document_deleted`

---

## 🔍 Backend API Testing

### Check API Endpoints Directly

#### 1. Get All Conversations
```bash
# Get your auth token first (login via frontend, check localStorage)
TOKEN="your_jwt_token_here"

# List conversations
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/conversations
```

Expected response:
```json
[
  {
    "id": 1,
    "title": "Renewable Energy Discussion",
    "created_at": "2024-11-16T...",
    "updated_at": "2024-11-16T...",
    "message_count": 4,
    "document_count": 2,
    "last_message_at": "2024-11-16T..."
  }
]
```

#### 2. Get Conversation Messages
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/conversations/1/messages
```

#### 3. Get Conversation Documents
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/conversations/1/documents
```

Expected response:
```json
[
  {
    "id": 5,
    "title": "solar-panel-research.pdf",
    "url": "https://...",
    "file_type": "pdf",
    "file_size": 245632,
    "document_scope": "conversation",
    "status": "completed",
    "created_at": "2024-11-16T..."
  }
]
```

#### 4. Test RAG Search
```bash
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What do you know about solar panels?",
    "conversation_id": 1
  }'
```

---

## 🐛 Troubleshooting

### Conversations Not Loading
1. **Check browser console** for JavaScript errors
2. **Verify API is running**: `curl http://localhost:8000/health`
3. **Check auth token**: Open DevTools → Application → Local Storage → `token`
4. **Check network requests**: DevTools → Network → Filter "conversations"

### Documents Not Uploading
1. **File size**: Ensure < 10MB
2. **File type**: Only PDF, DOCX, TXT, MD
3. **Check API logs**: `docker logs powernova-api --tail 50`
4. **Verify Azure Blob Storage config**: Check `.env` file

### UI Not Styled Correctly
1. **Hard refresh**: Ctrl+F5 or Cmd+Shift+R
2. **Clear cache**: DevTools → Application → Clear storage
3. **Check CSS loaded**: DevTools → Network → Filter "css"

### Database Issues
1. **Check migrations**: 
   ```bash
   docker exec -it powernova-api alembic current
   docker exec -it powernova-api alembic history
   ```
2. **Expected migrations**:
   - `conv_docs_001` (ConversationDocument table)
   - `doc_hierarchy_001` (Document scope fields)

### Context Not Isolated
1. **Verify conversation_id in requests**: DevTools → Network → Check POST to /chat/stream
2. **Check RAG query**: API logs should show UNION query with conversation_id
3. **Test in different conversations**: Upload doc in one, verify not accessible in another

---

## ✅ Testing Checklist

### Core Functionality
- [ ] Login/Logout works
- [ ] Conversations auto-load after login
- [ ] Create new conversation
- [ ] Switch between conversations
- [ ] Rename conversation
- [ ] Delete conversation
- [ ] Upload document (PDF)
- [ ] Upload document (DOCX)
- [ ] Upload document (TXT/MD)
- [ ] Delete document
- [ ] Document status progression
- [ ] Documents panel toggle

### Chat & RAG
- [ ] Send message in conversation
- [ ] Auto-generate conversation title
- [ ] AI uses uploaded documents in responses
- [ ] Context is isolated between conversations
- [ ] Sources show document types (platform/uploaded)
- [ ] Markdown rendering works
- [ ] Code syntax highlighting works

### UI/UX
- [ ] Sidebar toggle works
- [ ] Active conversation highlighted
- [ ] Timestamps display correctly ("Just now", "5m ago", etc.)
- [ ] Message/document counts accurate
- [ ] Modals open/close smoothly
- [ ] Progress bar shows during upload
- [ ] Status badges show correct colors
- [ ] Hover effects on buttons/conversations
- [ ] Responsive design on mobile

### Persistence
- [ ] Conversations persist after page reload
- [ ] Document links persist after page reload
- [ ] Messages persist after page reload
- [ ] Logout clears UI but data persists in DB
- [ ] Re-login restores all data

### Error Handling
- [ ] File size validation (>10MB)
- [ ] File type validation (invalid types)
- [ ] Network error handling
- [ ] Unauthorized access handling
- [ ] Confirmation dialogs for destructive actions

### Analytics
- [ ] conversation_created event
- [ ] conversation_switched event
- [ ] conversation_deleted event
- [ ] document_uploaded event
- [ ] document_deleted event

---

## 📊 Performance Testing

### Test with Multiple Conversations
1. Create 20+ conversations
2. **Verify:**
   - Sidebar scrolls smoothly
   - No lag when switching conversations
   - Messages load quickly

### Test with Large Documents
1. Upload a 9MB PDF
2. **Verify:**
   - Progress bar updates smoothly
   - Processing completes within 30 seconds
   - Embeddings generation succeeds

### Test Concurrent Users
1. Open app in 2 different browsers (Chrome + Firefox)
2. Login with different accounts
3. **Verify:**
   - Each user sees only their conversations
   - No data leakage between users
   - Simultaneous operations work correctly

---

## 📝 Report Issues

If you find any bugs or unexpected behavior:

1. **Document the steps to reproduce**
2. **Include screenshots** (especially for UI issues)
3. **Check browser console** for errors
4. **Check API logs**: `docker logs powernova-api --tail 100`
5. **Note your environment**:
   - Browser: Chrome/Firefox/Safari
   - OS: macOS/Windows/Linux
   - Docker version: `docker --version`

---

## 🎉 Success Criteria

The feature is working correctly if:

✅ **All 15 test scenarios pass**  
✅ **Checklist is 100% complete**  
✅ **No console errors**  
✅ **No API errors in logs**  
✅ **Works on mobile and desktop**  
✅ **Context isolation is maintained**  
✅ **Data persists correctly**  

---

## 🚀 Next Steps

After successful testing:

1. **Deploy to staging environment**
2. **Run end-to-end tests**
3. **User acceptance testing**
4. **Production deployment**

---

**Happy Testing! 🎯**

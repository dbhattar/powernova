# User Profile & Document Management Feature

## Overview

Users can now:
1. **View their profile** with statistics (conversations, documents, messages)
2. **Manage their uploaded documents** across all conversations
3. **Upload documents to their personal library** (available across ALL conversations)
4. **Edit their profile** (change username)
5. **Change their password**

This addresses the gap where users couldn't see or manage documents they uploaded to different conversations.

## Features Implemented

### 1. User Profile Page (`app/profile.html`)

**URL**: `https://app.powernova.ai/profile.html`

**Features**:
- Display user information (email, username, status badges)
- Statistics dashboard (total conversations, documents, messages)
- Edit profile functionality
- Change password
- Document management interface

### 2. Document Management

**Three Document Scopes**:

```
┌─────────────────────────────────────────┐
│ 1. Platform (scope='platform')          │
│    - Crawled by system                  │
│    - Available to ALL users             │
├─────────────────────────────────────────┤
│ 2. User Library (scope='user') ✨ NEW  │
│    - User's personal documents          │
│    - Available across ALL conversations │
├─────────────────────────────────────────┤
│ 3. Conversation (scope='conversation')  │
│    - Uploaded to specific conversation  │
│    - Only available in that conversation│
└─────────────────────────────────────────┘
```

**Document Filters**:
- **All Documents**: Show all user's uploaded documents
- **My Library**: Only documents in personal library (scope='user')
- **In Conversations**: Only conversation-specific documents (scope='conversation')

**Document Actions**:
- **View**: Open document in new tab
- **Delete**: Remove document (with confirmation)

### 3. Backend API Endpoints

#### User Profile Routes (`api/routes/users.py`)

**GET /api/users/profile**
- Returns user profile with statistics
- Authentication required
- Response includes: total_conversations, total_documents, total_messages

**PUT /api/users/profile**
- Update user profile (currently supports username only)
- Authentication required
- Request body: `{ "username": "New Name" }`

**POST /api/users/profile/change-password**
- Change user's password
- Authentication required
- Request body: `{ "current_password": "...", "new_password": "..." }`

#### Document Management Routes

**GET /api/users/documents**
- Get all documents uploaded by user
- Query params:
  - `scope`: Filter by 'user' or 'conversation' (optional)
  - `limit`: Max results (default 100)
  - `offset`: Pagination offset (default 0)
- Returns document list with conversation info (if applicable)

**POST /api/users/documents**
- Upload document to user's personal library (scope='user')
- Form data: `file` (PDF, DOCX, TXT, MD)
- Max size: 10MB
- Auto-extracts text and generates embeddings
- Document available across ALL user's conversations

**DELETE /api/users/documents/{document_id}**
- Delete document from user's library
- Only owner can delete
- Removes from Azure Storage and database (CASCADE)
- Also removes from any conversations it was linked to

**GET /api/users/documents/stats**
- Get document statistics
- Returns counts by scope, status, type
- Returns total size in bytes and MB

## How It Works

### Document Upload to Library

When a user uploads a document to their library:

1. **Frontend** (`profile.js`):
   - User clicks "Upload to Library"
   - Selects file (PDF, DOCX, TXT, MD)
   - File validated (size < 10MB, valid type)
   - Uploaded via FormData POST to `/api/users/documents`

2. **Backend** (`routes/users.py`):
   - Validates file size and type
   - Uploads to Azure Blob Storage (`user_library/{user_id}/...`)
   - Creates Document record with `scope='user'` and `uploaded_by=user_id`
   - Extracts text content (PDF/DOCX/TXT/MD)
   - Queues for embedding generation (background task)

3. **RAG Integration** (`services/rag_service.py`):
   - When user asks a question in ANY conversation:
   - Searches Platform documents (scope='platform')
   - Searches User library (scope='user', uploaded_by=user_id)
   - Searches Conversation docs (scope='conversation', linked to conversation)
   - Returns top-K most relevant across ALL sources

### Document Scope Hierarchy

```python
# In RAG search query (simplified)
documents = db.query(DocumentChunk).join(Document).filter(
    or_(
        # Platform documents (available to all)
        Document.document_scope == DocumentScope.PLATFORM,
        
        # User's library (available across all their conversations)
        and_(
            Document.document_scope == DocumentScope.USER,
            Document.uploaded_by == user_id
        ),
        
        # Conversation-specific documents (only this conversation)
        and_(
            Document.document_scope == DocumentScope.CONVERSATION,
            Document.id.in_(conversation_document_ids)
        )
    )
).order_by(similarity).limit(top_k)
```

## Files Modified/Created

### Backend

**New Files**:
- ✅ `api/routes/users.py` - User profile and document management routes

**Modified Files**:
- ✅ `api/main.py` - Added users router
- ✅ `api/services/auth.py` - Already had get_current_user (no changes needed)

### Frontend

**New Files**:
- ✅ `app/profile.html` - Profile page UI
- ✅ `app/css/profile.css` - Profile page styles
- ✅ `app/js/profile.js` - Profile page JavaScript

**Modified Files**:
- ✅ `app/index.html` - Added "My Profile" button to user menu
- ✅ `app/js/app.js` - Added profile navigation handler

## User Interface

### Profile Page Sections

**1. Profile Card**
```
┌─────────────────────────────────────┐
│  👤 User Icon                       │
│  John Doe                           │
│  john@example.com                   │
│  ✓ Active  ✓ Verified               │
│                                     │
│  [5]           [12]          [234]  │
│  Conversations Documents    Messages│
│                                     │
│  [Edit Profile] [Change Password]  │
└─────────────────────────────────────┘
```

**2. Documents Section**
```
┌─────────────────────────────────────┐
│  📁 My Documents  [Upload to Library]│
│                                     │
│  [All] [My Library] [In Conversations]│
│                                     │
│  ┌───────┐ ┌───────┐ ┌───────┐    │
│  │ 📄 PDF│ │ 📄 Doc│ │ 📄 TXT│    │
│  │Report │ │Guide  │ │Notes  │    │
│  │📚 Lib │ │💬 Conv│ │📚 Lib │    │
│  │👁 🗑   │ │👁 🗑   │ │👁 🗑   │    │
│  └───────┘ └───────┘ └───────┘    │
└─────────────────────────────────────┘
```

### Navigation

**From Chat Interface**:
- User menu → "My Profile"

**From Profile Page**:
- Header → "Back to Chat" icon

## Usage Examples

### Example 1: Upload Document to Library

```javascript
// User uploads document to library
1. Navigate to profile.html
2. Click "Upload to Library"
3. Select file (e.g., "Company_Policy.pdf")
4. Click "Upload Document"
5. ✅ Document uploaded to user library

// Now available in ALL conversations
6. Go back to chat
7. Create new conversation
8. Ask: "Summarize the company policy"
9. AI searches: Platform + User Library (finds Company_Policy.pdf) + Conversation docs
10. AI responds with content from Company_Policy.pdf
```

### Example 2: View All Uploaded Documents

```javascript
// User wants to see what they've uploaded
1. Navigate to profile.html
2. Documents section shows ALL uploaded documents
3. Filter by "My Library" → Shows only library docs
4. Filter by "In Conversations" → Shows conversation-specific docs
5. Each document shows:
   - Title, type, scope, status
   - Which conversation it's linked to (if applicable)
   - Upload date, chunk count
```

### Example 3: Delete Old Document

```javascript
// User wants to remove an old document
1. Navigate to profile.html
2. Find document in grid
3. Click trash icon
4. Confirm deletion
5. ✅ Document removed from:
   - Azure Blob Storage
   - Database (documents table)
   - All conversations it was linked to
   - Document chunks (CASCADE delete)
```

## Testing Checklist

### Profile Features
- [ ] Profile loads with correct user info
- [ ] Statistics display correctly
- [ ] Edit username works
- [ ] Change password works
- [ ] Back to chat navigation works

### Document Management
- [ ] All documents display correctly
- [ ] Filter tabs work (All, Library, Conversations)
- [ ] Upload to library succeeds
- [ ] Document appears in library
- [ ] Delete document works
- [ ] Deleted document removed from storage

### Document Availability
- [ ] Library doc available in ALL conversations
- [ ] Conversation doc only in that conversation
- [ ] RAG search includes library docs
- [ ] Deleted library doc no longer searchable

### UI/UX
- [ ] Profile link in user menu
- [ ] Mobile responsive design
- [ ] Modals work correctly
- [ ] File upload validation works
- [ ] Toast notifications display

## Deployment

### Local Testing

```bash
# Restart containers
docker restart powernova-api powernova-chat-app

# Test profile endpoint
curl http://localhost:8000/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test document upload
curl -X POST http://localhost:8000/api/users/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf"

# Test document list
curl http://localhost:8000/api/users/documents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Azure Deployment

```bash
# Deploy API
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container
./scripts/azure-deploy-api.sh --update

# Deploy Chat App
./scripts/azure-deploy-chat.sh --update
```

## Database Schema

No new tables required! Uses existing tables:

**documents** (already has):
- `uploaded_by` - User who uploaded
- `document_scope` - 'platform', 'user', or 'conversation'

**conversation_documents** (already exists):
- Links documents to conversations

## Benefits

1. **Centralized Document Management**
   - Users can see ALL their documents in one place
   - No more losing track of what was uploaded where

2. **Personal Knowledge Base**
   - Upload documents to library once
   - Use across ALL conversations
   - No need to re-upload for each conversation

3. **Better Organization**
   - Filter by scope (library vs conversation)
   - See which conversation each document belongs to
   - Easy deletion and management

4. **Improved RAG**
   - User's library documents always included in search
   - Better context across conversations
   - More relevant answers

5. **User Empowerment**
   - Full control over uploaded content
   - Edit profile information
   - Manage passwords

## Future Enhancements

1. **Bulk Upload**
   - Upload multiple documents at once
   - Drag and drop interface

2. **Document Tags**
   - Add custom tags to documents
   - Filter by tags
   - Organize into collections

3. **Sharing**
   - Share library documents with other users
   - Team libraries (shared documents)

4. **Advanced Search**
   - Search within user's documents
   - Full-text search across library
   - Filter by date, type, size

5. **Storage Quotas**
   - Set limits per user
   - Display usage statistics
   - Upgrade tiers for more storage

6. **Document Versions**
   - Upload new versions of existing documents
   - Track version history
   - Revert to previous versions

## Known Limitations

1. **File Types**
   - Currently supports: PDF, DOCX, TXT, MD
   - Future: XLSX, PPTX, images (OCR)

2. **File Size**
   - Max 10MB per document
   - Future: Configurable limits

3. **Profile Fields**
   - Can only edit username currently
   - Future: Add more fields (avatar, bio, preferences)

4. **Document Preview**
   - No preview in profile (opens in new tab)
   - Future: Inline preview modal

## Security Considerations

- ✅ All endpoints require authentication
- ✅ Users can only see/modify their own documents
- ✅ Document deletion verified by ownership
- ✅ Password change requires current password
- ✅ File type and size validation
- ✅ Azure Blob Storage for secure file storage

---

**Status**: ✅ Implemented and ready for testing  
**Next**: Local testing → Azure deployment

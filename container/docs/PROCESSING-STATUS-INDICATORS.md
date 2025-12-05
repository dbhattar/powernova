# Document Processing Status Indicators & Modal Z-Index Fix

**Date:** December 5, 2024  
**Status:** ✅ Complete

## Overview

Added visual feedback for document embedding generation status and fixed modal overlay z-index issues to improve user experience.

## Changes Implemented

### 1. Backend API Changes

#### Added Processing Status Field to Document Responses

**Files Modified:**
- `api/routes/conversations.py`
- `api/routes/users.py`
- `api/services/conversation_service.py`

**Changes:**

1. **DocumentResponse Model** (conversations.py & users.py):
   ```python
   class DocumentResponse(BaseModel):
       # ... existing fields ...
       processing_status: Optional[str] = None  # Job status: pending, processing, completed, failed
   ```

2. **Conversation Service** (conversation_service.py):
   - Added `DocumentJob` import
   - Updated `get_conversation_documents()` to query DocumentJob table
   - Include processing status in response:
   ```python
   # Get processing status from DocumentJob
   doc_job = self.db.query(DocumentJob).filter(
       DocumentJob.document_id == doc.id
   ).first()
   
   processing_status = None
   if doc_job:
       processing_status = doc_job.status.value.lower()
   
   result.append({
       # ... other fields ...
       "processing_status": processing_status
   })
   ```

3. **Users Route** (users.py):
   - Added `DocumentJob` import
   - Updated `get_user_documents()` endpoint with same pattern
   - Query DocumentJob status for each user document

**API Response:**
Documents now include a `processing_status` field with values:
- `"pending"` - Document queued for processing
- `"processing"` - Embeddings currently being generated
- `"completed"` - Embeddings ready (or null if completed)
- `"failed"` - Processing encountered an error

### 2. Frontend UI Changes

#### ProcessingStatus Component

**New File:** `app-react/src/components/ui/ProcessingStatus.tsx`

Visual status indicator component that displays:
- **Pending:** Yellow badge with ⏱️ icon and "Queued" text
- **Processing:** Blue badge with animated spinner and "Processing" text
- **Failed:** Red badge with ❌ icon and "Failed" text
- **Completed:** No badge shown (clean UI)

Features:
- Configurable size: `sm`, `md`, `lg`
- Auto-hides when status is `completed` or `null`
- Tailwind CSS styled badges with proper color coding
- Animated spinner for processing state

#### Type Definitions

**File:** `app-react/src/types/index.ts`

Updated interfaces:
```typescript
export interface UserDocument {
  // ... existing fields ...
  processing_status?: string;
}

export interface ConversationDocument {
  id: number;
  title: string;
  url: string;
  document_type: string;
  file_size?: number;
  blob_url?: string;
  status: string;
  chunk_count?: number;
  uploaded_at?: string;
  uploaded_by?: number;
  processing_status?: string;
}
```

**Note:** Fixed ConversationDocument type to match backend DocumentResponse structure (was using old simplified structure).

#### Profile Page Updates

**File:** `app-react/src/pages/ProfilePage.tsx`

1. **Import ProcessingStatus Component:**
   ```typescript
   import { ProcessingStatus } from '../components/ui/ProcessingStatus';
   ```

2. **Display Status Badge:**
   ```tsx
   <div className="flex items-center gap-2 mb-1">
     <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
     <h4 className="font-medium text-gray-900 truncate">{doc.title}</h4>
     {doc.processing_status && (
       <ProcessingStatus status={doc.processing_status} size="sm" />
     )}
   </div>
   ```

3. **Auto-Refresh Logic:**
   - Added `useRef` to track documents without causing re-renders
   - Implemented polling interval (5 seconds) when documents are processing
   - Automatically refetches documents when any have `pending` or `processing` status
   - Stops polling when all documents are completed/failed

   ```typescript
   // Auto-refresh when documents are processing
   useEffect(() => {
     const hasProcessingDocs = documentsRef.current.some(
       (doc) => doc.processing_status === 'pending' || doc.processing_status === 'processing'
     );
     
     if (!hasProcessingDocs) {
       return; // No processing documents, no need to poll
     }
     
     const interval = setInterval(() => {
       const stillProcessing = documentsRef.current.some(
         (doc) => doc.processing_status === 'pending' || doc.processing_status === 'processing'
       );
       
       if (stillProcessing) {
         refetchDocuments();
       }
     }, 5000); // Check every 5 seconds
     
     return () => clearInterval(interval);
   }, []); // Empty deps - use ref to avoid re-creating interval
   ```

#### Profile Hook Updates

**File:** `app-react/src/hooks/useProfile.ts`

Added `refetchDocuments` function to return value:
```typescript
const {
  data: documents,
  isLoading: isLoadingDocuments,
  error: documentsError,
  refetch: refetchDocuments,
} = useQuery<UserDocument[]>({
  queryKey: ['userDocuments'],
  queryFn: () => api.users.getDocuments(),
  staleTime: 1 * 60 * 1000,
});

return {
  // ... existing fields ...
  refetchDocuments,
};
```

#### Bug Fix: useDocuments Hook

**File:** `app-react/src/hooks/useDocuments.ts`

Fixed TypeScript error from ConversationDocument type change:
```typescript
// Before: doc.id !== deletedId (number !== string)
// After: doc.id !== Number(deletedId)
queryClient.setQueryData(['documents', conversationId], (old: ConversationDocument[] = []) =>
  old.filter((doc) => doc.id !== Number(deletedId))
);
```

### 3. Modal Z-Index Fix

**Problem:** Login and Account Request modals were not properly dimming the sidebar. The issue had multiple root causes:
1. Modals rendered inside the same container as the sidebar created sibling stacking contexts
2. The sidebar's `lg:relative` positioning on desktop created an isolated stacking context
3. DOM ordering and z-index values couldn't override the stacking context hierarchy

**Files Modified:**
- `app-react/src/components/LoginModal.tsx`
- `app-react/src/components/AccountRequestModal.tsx`
- `app-react/src/pages/ChatPage.tsx`

**Solution: React Portals**

Used React's `createPortal` to render modals directly into `document.body`, completely bypassing all parent stacking contexts:

```tsx
// LoginModal.tsx & AccountRequestModal.tsx
import { createPortal } from 'react-dom';

export function LoginModal({ isOpen, onClose, onRequestAccount }: LoginModalProps) {
  // ... component logic ...
  
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      {/* Modal content */}
    </div>,
    document.body  // Render directly to body, bypassing all stacking contexts
  );
}
```

**Additional Changes:**

1. **Moved modals to end of DOM in ChatPage.tsx:**
   ```tsx
   return (
     <div className="h-screen flex flex-col bg-gray-50">
       {/* Header */}
       {/* Main content with Sidebar */}
       
       {/* Modals - Rendered last, but via Portal go to document.body */}
       <LoginModal ... />
       <AccountRequestModal ... />
     </div>
   );
   ```

2. **High z-index (9999):** Ensures modals are above all other elements

**Why React Portals:**
- **Breaks stacking context:** Renders outside the React component tree hierarchy
- **Renders to body:** Modal DOM nodes become direct children of `<body>`
- **Guaranteed overlay:** No parent element can create a stacking context that traps the modal
- **Maintains React tree:** Event bubbling and context still work normally

**Z-Index Hierarchy:**
- ChatSidebar: `z-50` (fixed on mobile, relative on desktop)
- ChatSidebar overlay (mobile): `z-40`
- Modals (via Portal to body): `z-[9999]` ✅
- Modal overlays now properly dim **everything** including sidebar

**DOM Structure:**
```html
<body>
  <div id="root">
    <!-- React app with sidebar, etc. -->
  </div>
  
  <!-- Modals rendered here via Portal -->
  <div class="fixed inset-0 bg-black/50 ... z-[9999]">
    <!-- Login Modal Content -->
  </div>
</body>
```

## User Experience Improvements

### Before
- ❌ No visual feedback when documents are being processed
- ❌ Users didn't know embeddings were generating
- ❌ Documents appeared in list but weren't ready for RAG queries
- ❌ Login modal didn't dim the sidebar (jarring experience)

### After
- ✅ Clear status indicators show processing state
- ✅ Color-coded badges: Yellow (queued), Blue (processing), Red (failed)
- ✅ Animated spinner for active processing
- ✅ Auto-refresh every 5 seconds when documents are processing
- ✅ Badge auto-hides when processing completes
- ✅ Modal properly dims entire page including sidebar

## Technical Details

### Document Processing Flow

1. **User uploads document** → Document created, DocumentJob created with status `PENDING`
2. **API returns document** → `processing_status: "pending"` included in response
3. **Frontend shows badge** → Yellow "Queued" badge with clock icon
4. **Auto-refresh starts** → Poll every 5 seconds while any document is pending/processing
5. **Worker picks up job** → DocumentJob status changes to `PROCESSING`
6. **Frontend updates** → Blue "Processing" badge with spinner
7. **Embeddings complete** → DocumentJob status changes to `COMPLETED`
8. **Frontend updates** → Badge disappears, auto-refresh stops

### Performance Considerations

- **Polling Optimization:** Only polls when documents are actively processing
- **Ref Pattern:** Uses `useRef` to avoid unnecessary re-renders from interval
- **Automatic Cleanup:** Stops polling when all documents complete
- **Stale Time:** Documents query has 1-minute stale time for normal browsing
- **Targeted Refresh:** Only refetches documents, not entire profile

### Database Queries

No additional database load - DocumentJob queries use indexed `document_id` foreign key:
```sql
-- Existing index on DocumentJob
CREATE INDEX idx_document_job_document_id ON document_jobs(document_id);
```

## Deployment

### Containers Restarted
```bash
# Backend API (processing status endpoints)
docker-compose -f docker/docker-compose.yml restart powernova-api

# Frontend app (UI components)
docker-compose -f docker/docker-compose.yml build powernova-chat
docker-compose -f docker/docker-compose.yml restart powernova-chat
```

### Verification
✅ All containers healthy
✅ API endpoints return processing_status field
✅ Frontend displays status badges correctly
✅ Auto-refresh works when processing
✅ Modals properly overlay sidebar

## Files Changed Summary

### Backend (4 files)
- `api/routes/conversations.py` - Added processing_status to DocumentResponse
- `api/routes/users.py` - Added processing_status to DocumentResponse, query DocumentJob
- `api/services/conversation_service.py` - Query DocumentJob, include status in response

### Frontend (7 files)
- `app-react/src/components/ui/ProcessingStatus.tsx` - **NEW** - Status badge component
- `app-react/src/types/index.ts` - Added processing_status fields, fixed ConversationDocument
- `app-react/src/pages/ProfilePage.tsx` - Display status, auto-refresh logic
- `app-react/src/hooks/useProfile.ts` - Export refetchDocuments
- `app-react/src/hooks/useDocuments.ts` - Fix TypeScript error (number vs string)
- `app-react/src/components/LoginModal.tsx` - Z-index fix (z-50 → z-[60])
- `app-react/src/components/AccountRequestModal.tsx` - Z-index fix (z-50 → z-[60])

## Testing Checklist

- [x] Upload document shows "Queued" status
- [x] Status changes to "Processing" when worker picks up
- [x] Status disappears when processing completes
- [x] Auto-refresh only active when documents processing
- [x] Auto-refresh stops when all complete
- [x] Failed documents show red badge
- [x] Login modal dims sidebar
- [x] Account request modal dims sidebar
- [x] No TypeScript errors
- [x] All containers healthy

## Future Enhancements

### Potential Improvements
1. **Progress Percentage:** Show embedding generation progress (requires worker updates)
2. **Estimated Time:** Display estimated completion time based on document size
3. **Batch Status:** Show summary "3 documents processing" when multiple
4. **Real-time Updates:** Use WebSocket instead of polling for instant updates
5. **Retry Button:** Allow manual retry for failed documents
6. **Processing Details:** Tooltip or modal with detailed processing info

### Alternative Approaches Considered
- **WebSocket:** More efficient but adds complexity (polling is simpler for MVP)
- **Server-Sent Events (SSE):** Good middle ground, could implement later
- **TanStack Query Polling:** Built-in refetch interval, but less control over conditions

## Related Documentation

- [DOCUMENT-PRIORITY.md](./DOCUMENT-PRIORITY.md) - Priority queue implementation
- [ADMIN-EMBEDDINGS-FEATURE.md](./ADMIN-EMBEDDINGS-FEATURE.md) - Admin embedding management
- [PROCESSING-JOBS-FIX.md](./PROCESSING-JOBS-FIX.md) - Admin processing jobs page fixes

## Notes

- Processing status is only shown for documents that are actively being processed
- Completed documents don't show a badge (keeps UI clean)
- The auto-refresh pattern is consistent with admin pages (Processing Jobs, Crawl Jobs)
- Modal z-index fix improves overall UX consistency across the app

# Conversation ID Type Mismatch Fix

## Problem

Conversations were not displaying in the React app even though the API was returning them correctly. The root cause was a type mismatch between the API response and TypeScript types.

### API Response
The API returns conversation objects with:
- `id`: **number** (e.g., 33)
- Additional fields: `document_count`, `last_message_preview`, `last_message_role`

```json
{
    "id": 33,
    "title": "New Conversation",
    "created_at": "2025-12-04T07:28:36.077615",
    "updated_at": "2025-12-04T07:28:36.077618",
    "message_count": 0,
    "document_count": 0,
    "last_message_preview": null,
    "last_message_role": null
}
```

### TypeScript Types (Before Fix)
The `Conversation` interface expected:
- `id`: **string**
- Missing fields that API returns

This mismatch caused TypeScript to fail silently when trying to work with conversation IDs.

## Solution

Updated all TypeScript interfaces and component props to use `number` for conversation IDs, matching the actual API response.

### Files Changed

#### 1. Type Definitions (`app-react/src/types/index.ts`)
```typescript
// BEFORE
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

// AFTER
export interface Conversation {
  id: number;  // Changed from string to number
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  document_count: number;  // NEW
  last_message_preview: string | null;  // NEW
  last_message_role: string | null;  // NEW
}
```

Also updated `ConversationMessagesResponse`:
```typescript
export interface ConversationMessagesResponse {
  id: number;  // Changed from string to number
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
  documents: ConversationDocument[];
}
```

#### 2. React Component State (`app-react/src/pages/ChatPage.tsx`)
```typescript
// BEFORE
const [activeConversationId, setActiveConversationId] = useState<string | undefined>();

// AFTER
const [activeConversationId, setActiveConversationId] = useState<number | undefined>();
```

Updated handlers to convert numbers to strings when calling API:
```typescript
const handleRenameConversation = async (id: number, title: string) => {
  await updateConversation({ id: String(id), data: { title } });
};

const handleDeleteConversation = async (id: number) => {
  await deleteConversation(String(id));
  if (id === activeConversationId) {
    setActiveConversationId(conversations[0]?.id);
  }
};
```

Handle conversation ID from stream (which comes as string):
```typescript
onConversationCreated: (newConvId) => {
  const numericId = parseInt(newConvId, 10);
  if (!isNaN(numericId)) {
    setActiveConversationId(numericId);
  }
}
```

#### 3. React Hooks

**`useConversations.ts`**:
```typescript
export function useConversation(conversationId?: number | string) {
  // ...
  queryFn: () => api.conversations.get(String(conversationId)),
  // ...
}
```

Filter fix:
```typescript
conversations: (old?.conversations || []).filter((conv: Conversation) => 
  String(conv.id) !== deletedId
),
```

**`useDocuments.ts`**:
```typescript
export function useDocuments(conversationId?: number | string) {
  // ...
  queryFn: () => api.conversations.documents.list(String(conversationId)),
  // ...
  return api.conversations.documents.upload(String(conversationId), file);
  // ...
  return api.conversations.documents.delete(String(conversationId), documentId);
}
```

**`useChat.ts`**:
```typescript
interface UseChatOptions {
  conversationId?: number | string;  // Accept both types
  onConversationCreated?: (conversationId: string) => void;
  // ...
}
```

#### 4. Component Props

**`ConversationList.tsx`**:
```typescript
interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: number;  // Changed from string
  onSelectConversation: (id: number) => void;  // Changed from string
  onCreateConversation: () => void;
  onRenameConversation: (id: number, title: string) => void;  // Changed from string
  onDeleteConversation: (id: number) => void;  // Changed from string
  isLoading?: boolean;
  isCreating?: boolean;
}
```

**`ConversationItem.tsx`**:
```typescript
interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onRename: (id: number, title: string) => void;  // Changed from string
  onDelete: (id: number) => void;  // Changed from string
}
```

**`ChatSidebar.tsx`**:
```typescript
interface ChatSidebarProps {
  // ...
  activeConversationId?: number;  // Changed from string
  onSelectConversation: (id: number) => void;  // Changed from string
  onRenameConversation: (id: number, title: string) => void;  // Changed from string
  onDeleteConversation: (id: number) => void;  // Changed from string
  // ...
}
```

## Key Principles

1. **Store IDs as numbers**: Match the API response type throughout the React app
2. **Convert to strings for API calls**: The API accepts string IDs in URL paths, so convert using `String(id)` when making requests
3. **Parse strings to numbers**: When receiving IDs from API responses (like stream events), parse them with `parseInt(id, 10)`
4. **Type safety**: Accept both `number | string` in hook parameters for flexibility, but convert appropriately

## Testing

After these changes:
- ✅ Build succeeds without TypeScript errors
- ✅ Conversations load correctly from API
- ✅ Conversation selection works
- ✅ Rename and delete operations work
- ✅ New conversation creation sets active conversation properly

## Related Issues

This fix addresses the issue where conversations were being fetched successfully but not displayed due to type mismatches preventing proper state updates and comparisons.

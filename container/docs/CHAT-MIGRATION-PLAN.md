# Chat Interface Migration Plan

## Current Features Analysis

### Core Functionality
1. **Chat Interface**
   - Stream chat responses with SSE (Server-Sent Events)
   - Send messages with conversation context
   - Display user and assistant messages
   - Markdown rendering with code syntax highlighting
   - Follow-up question suggestions

2. **Conversation Management**
   - Create new conversations
   - Load conversation history
   - Switch between conversations
   - Rename conversations
   - Delete conversations
   - Sidebar with conversation list

3. **Document Upload**
   - Upload documents to conversations
   - View uploaded documents
   - Delete documents
   - Documents panel

4. **Authentication**
   - Login/logout
   - Token management (localStorage)
   - Password change
   - Account request
   - Protected routes

5. **UI Features**
   - Mobile-responsive sidebar
   - Beta notice banner
   - Search modal
   - Loading states
   - Error handling
   - Toast notifications

### API Endpoints Used

```typescript
// Authentication
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/change-password

// Chat
POST /api/chat/stream  // SSE streaming
POST /api/chat/follow-up-questions

// Conversations
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/:id
DELETE /api/conversations/:id
PATCH  /api/conversations/:id

// Documents
GET    /api/conversations/:id/documents
POST   /api/conversations/:id/documents
DELETE /api/conversations/:id/documents/:docId
```

## React Migration Strategy

### Phase 1: Setup & Types
- [x] Create TypeScript types for all entities
- [x] Extend API client with chat/conversation methods
- [x] Create custom hooks (useChat, useConversations, useAuth)

### Phase 2: Core Components
- [ ] ChatPage (main container)
- [ ] ChatHeader (with user menu, new chat button)
- [ ] ChatSidebar (conversation list)
- [ ] ChatMessages (message list with virtualization)
- [ ] ChatMessage (single message with markdown)
- [ ] ChatInput (message input with file upload)
- [ ] ConversationList (sidebar conversations)
- [ ] ConversationItem (single conversation)

### Phase 3: Feature Components
- [ ] DocumentsPanel (uploaded docs list)
- [ ] FollowUpQuestions (suggestion chips)
- [ ] UserMenu (dropdown with profile/logout)
- [ ] BetaNotice (dismissible banner)
- [ ] SearchModal (reuse from search page or create)

### Phase 4: State Management
- [ ] AuthContext (user, token, login/logout)
- [ ] ChatContext (messages, streaming state)
- [ ] ConversationsContext (list, current conversation)
- [ ] Use Zustand for global state

### Phase 5: Streaming Implementation
- [ ] SSE streaming with fetch EventSource
- [ ] Handle streaming messages
- [ ] Cancel streaming on unmount
- [ ] Error handling and reconnection

### Phase 6: Integration & Testing
- [ ] Wire up all components
- [ ] Test streaming
- [ ] Test conversation management
- [ ] Test document upload
- [ ] Mobile responsive testing
- [ ] Update nginx routing

## Component Hierarchy

```
ChatPage
├── BetaNotice
├── ChatHeader
│   ├── Logo
│   ├── NewChatButton
│   └── UserMenu
│       ├── ProfileButton
│       ├── PasswordChangeModal
│       └── LogoutButton
├── ChatSidebar
│   ├── SidebarToggle
│   ├── NewConversationButton
│   └── ConversationList
│       └── ConversationItem[]
│           ├── ConversationName
│           ├── RenameButton
│           └── DeleteButton
├── ChatContainer
│   ├── ChatMessages
│   │   └── ChatMessage[]
│   │       ├── Avatar
│   │       ├── MessageContent (with Markdown)
│   │       └── Timestamp
│   ├── FollowUpQuestions
│   │   └── QuestionChip[]
│   └── ChatInput
│       ├── FileUploadButton
│       ├── TextArea
│       └── SendButton
└── DocumentsPanel
    ├── DocumentList
    │   └── DocumentItem[]
    │       ├── DocumentName
    │       ├── DocumentSize
    │       └── DeleteButton
    └── CloseButton
```

## TypeScript Types Needed

```typescript
// Message types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  conversation_id: string;
}

// Conversation types
interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

// Document types
interface ConversationDocument {
  id: string;
  filename: string;
  size: number;
  uploaded_at: string;
  conversation_id: string;
}

// Chat request/response
interface ChatRequest {
  message: string;
  conversation_id?: string;
}

interface ChatStreamEvent {
  type: 'start' | 'token' | 'end' | 'error';
  content?: string;
  conversation_id?: string;
  message_id?: string;
  error?: string;
}

// Follow-up questions
interface FollowUpQuestionsResponse {
  questions: string[];
}
```

## Custom Hooks

```typescript
// hooks/useAuth.ts
- Manages user authentication state
- Login/logout functions
- Token management
- Auto-login on mount

// hooks/useConversations.ts
- Load conversations list
- Create/delete/rename conversations
- Switch conversations
- React Query for caching

// hooks/useChat.ts
- Send messages
- Stream responses
- Manage chat history
- Handle SSE streaming

// hooks/useDocuments.ts
- Load conversation documents
- Upload documents
- Delete documents
```

## State Management Strategy

### Option 1: React Context + React Query (Recommended)
- AuthContext for global auth state
- React Query for server state (conversations, messages)
- Local component state for UI (sidebar open, modals)

### Option 2: Zustand (Alternative)
- Single store for all global state
- React Query for server operations
- Cleaner than Context API for complex state

### Chosen: Hybrid Approach
- **AuthContext**: User authentication (needs to wrap app)
- **React Query**: All server data (conversations, messages, documents)
- **Zustand**: UI state (sidebar, panels, selected conversation)
- **Component state**: Form inputs, local UI state

## Streaming Implementation

### SSE with Fetch API

```typescript
async function streamChat(message: string, conversationId?: string) {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message, conversation_id: conversationId })
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        handleStreamEvent(data);
      }
    }
  }
}
```

## Migration Steps

### Step 1: Create Types & API Methods (30 min)
- Add TypeScript interfaces
- Extend api.ts with chat/conversation endpoints
- Create ChatResponse, ConversationResponse types

### Step 2: Create Custom Hooks (1 hour)
- useAuth hook with context
- useConversations with React Query
- useChat with streaming support
- useDocuments for file management

### Step 3: Build UI Components (2-3 hours)
- Start with simple components (ChatMessage, ConversationItem)
- Build container components (ChatMessages, ConversationList)
- Create layout components (ChatSidebar, ChatHeader)
- Build main ChatPage

### Step 4: Implement Streaming (1 hour)
- SSE streaming logic
- Message accumulation
- Error handling
- Cancel/cleanup on unmount

### Step 5: Wire Up Features (1-2 hours)
- Connect all components
- Test conversation switching
- Test message sending
- Test document upload
- Add loading states

### Step 6: Polish & Test (1 hour)
- Mobile responsive
- Error boundaries
- Toast notifications
- Beta notice
- Update routing

## Routing Update

```nginx
# Update nginx-dual-app.local.conf
location / {
    # Redirect to React chat
    try_files $uri /react/index.html;
}

location /react {
    alias /usr/share/nginx/html/react;
    try_files $uri $uri/ /react/index.html;
}

location /classic {
    # Old vanilla JS version
    alias /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
}
```

## Estimated Timeline

- **Types & API**: 30 minutes
- **Custom Hooks**: 1 hour
- **UI Components**: 2-3 hours
- **Streaming**: 1 hour
- **Integration**: 1-2 hours
- **Testing & Polish**: 1 hour

**Total**: 6-8 hours

## Success Criteria

- [ ] Chat streaming works correctly
- [ ] Conversation switching maintains state
- [ ] Documents can be uploaded and viewed
- [ ] Authentication works (login/logout)
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Graceful error handling
- [ ] Performance is acceptable (no lag during streaming)

## Potential Challenges

1. **SSE Streaming**: Need to handle cleanup, reconnection, errors
2. **State Synchronization**: Keep React Query cache in sync with streaming messages
3. **Mobile UX**: Sidebar overlays, touch gestures
4. **Markdown Rendering**: Code highlighting, tables, links
5. **Real-time Updates**: Optimistic updates vs server confirmation

## Next Action

Start with Step 1: Create TypeScript types and extend the API client.


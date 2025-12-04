# Chat 422 Error Fix

## Problem
After deploying the React app to production, the chat functionality was returning HTTP 422 errors when trying to send messages.

## Root Cause
The React app was sending an incorrect request format to the `/api/chat/stream` endpoint:

**What React app was sending:**
```json
{
  "message": "user message string",
  "conversation_id": 123
}
```

**What API expected (ChatRequest model):**
```python
class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., description="List of chat messages")  # Required!
    conversation_id: Optional[int] = Field(default=None)
    model: str = Field(default="gpt-4o-mini")
    temperature: Optional[float] = Field(default=0.7)
    max_tokens: Optional[int] = Field(default=2000)
    stream: bool = Field(default=True)
    use_rag: bool = Field(default=True)
    top_k: int = Field(default=5)
    similarity_threshold: float = Field(default=0.5)
```

The API requires a `messages` array containing the full conversation history, not just a single `message` string.

## Solution

### 1. Updated `useChat` Hook
Modified `app-react/src/hooks/useChat.ts` to:
- Accept `messages` array in options
- Format request body to include full conversation history
- Add new user message to the messages array
- Include all RAG parameters

**Before:**
```typescript
interface UseChatOptions {
  conversationId?: number | string;
  onConversationCreated?: (conversationId: string) => void;
  // ...
}

// Request body
body: JSON.stringify({
  message,
  conversation_id: conversationId,
})
```

**After:**
```typescript
interface UseChatOptions {
  conversationId?: number | string;
  messages?: Message[];  // Added!
  onConversationCreated?: (conversationId: string) => void;
  // ...
}

// Request body
const allMessages = [
  ...messages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({ role: msg.role, content: msg.content })),
  { role: 'user', content: message },
];

const requestBody = {
  messages: allMessages,
  conversation_id: conversationId,
  model: 'gpt-4o-mini',
  temperature: 0.7,
  max_tokens: 2000,
  stream: true,
  use_rag: true,
  top_k: 5,
  similarity_threshold: 0.5,
};
```

### 2. Updated ChatPage Component
Modified `app-react/src/pages/ChatPage.tsx` to pass messages to `useChat`:

```typescript
const { messages } = useConversation(activeConversationId);

const { sendMessage, isStreaming, streamingMessage } = useChat({
  conversationId: activeConversationId,
  messages: messages || [],  // Pass conversation history
  onConversationCreated: (newConvId) => { /* ... */ },
  onMessageComplete: () => { /* ... */ },
});
```

## How It Works Now

1. **ChatPage** loads conversation messages via `useConversation` hook
2. **useChat** receives the messages array as a prop
3. When sending a new message:
   - Filter conversation history (only user/assistant messages)
   - Append new user message to the array
   - Send complete messages array to API
4. API receives properly formatted ChatRequest with full context

## Legacy App Comparison
The legacy app (`app/js/app.js`) was already doing this correctly:

```javascript
const messages = this.messages
  .filter(msg => msg.role === 'user' || msg.role === 'assistant')
  .map(msg => ({ role: msg.role, content: msg.content }));

const requestBody = {
  messages: messages,
  model: 'gpt-4o-mini',
  // ... other params
};
```

The React migration initially missed this implementation detail, causing the 422 validation error.

## Testing
After this fix:
1. Build the React app: `npm run build`
2. Deploy to production
3. Test chat functionality - should now work correctly
4. Verify conversation history is maintained in context

## Related Files
- `api/routes/chat.py` - ChatRequest model definition
- `app-react/src/hooks/useChat.ts` - Chat hook with streaming
- `app-react/src/pages/ChatPage.tsx` - Main chat interface
- `app-react/src/types/index.ts` - Message type definitions

## Lessons Learned
- Always check API Pydantic models to understand exact request format
- Compare with legacy implementation when migrating features
- HTTP 422 = Unprocessable Entity = Validation error (check request body)
- Test all features after deployment, not just build success

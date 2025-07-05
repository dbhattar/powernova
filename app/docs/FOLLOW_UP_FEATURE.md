# Follow-up Questions Feature

## Overview
The PowerNOVA app now supports follow-up questions, allowing users to have continuous conversations with the AI assistant. This feature maintains conversation context and stores the entire conversation chain in Firestore.

## Key Features

### 1. **Follow-up Question Button**
- After receiving a response, users see an "Ask Follow-up" button
- Clicking it opens a dedicated input field for follow-up questions
- The input field supports multiline text and has Cancel/Send buttons

### 2. **Conversation Context**
- Follow-up questions include the entire conversation history as context
- The AI assistant can reference previous questions and answers
- This enables more natural, contextual conversations

### 3. **Conversation Threads**
- Each conversation has a unique thread ID
- All related messages (initial question + follow-ups) share the same thread ID
- Threads are stored in Firestore with proper user authentication

### 4. **Thread Storage Schema**
```javascript
{
  uid: "user-id",
  threadId: "unique-thread-id",
  prompt: "user question",
  response: "AI response",
  type: "text" | "voice",
  isFollowUp: true | false,
  createdAt: timestamp,
  // ... other fields
}
```

### 5. **Enhanced History View**
- Conversation history now shows follow-up indicators
- Follow-up questions are marked with "↳" prefix
- Threading information is preserved and displayed

### 6. **Thread Management**
- "New Conversation" button clears the current thread
- Starting a new question begins a fresh thread
- Thread history is maintained for context

## UI Components

### Follow-up Input
- Appears below AI responses
- Has dedicated Cancel/Send buttons
- Supports multiline input
- Auto-focuses when opened

### Conversation Thread Display
- Shows the conversation history in a dedicated section
- User messages appear on the right (blue)
- AI responses appear on the left (gray)
- Properly formatted with timestamps

### History Enhancements
- Follow-up questions have special indicators
- Thread relationships are visually clear
- Easy navigation between conversation threads

## Technical Implementation

### State Management
- `conversationThread`: Array of messages in current thread
- `threadId`: Current conversation thread identifier
- `showFollowUpInput`: Controls follow-up input visibility
- `followUpText`: Current follow-up question text

### Database Structure
- Enhanced Firestore schema with thread support
- Proper indexing for thread queries
- User-specific thread isolation

### API Integration
- Modified OpenAI API calls to include conversation context
- Smart context management to stay within token limits
- Proper error handling for threaded conversations

## Usage Flow

1. **Initial Question**: User asks a question (voice or text)
2. **AI Response**: System provides answer with follow-up button
3. **Follow-up**: User clicks "Ask Follow-up" to continue conversation
4. **Context**: Follow-up includes full conversation history
5. **Thread Storage**: All messages saved with same thread ID
6. **History**: Thread accessible via conversation history

## Benefits

- **Better Context**: AI understands conversation flow
- **Natural Interaction**: Users can dig deeper into topics
- **Persistent History**: Conversation threads are saved
- **Enhanced UX**: Smooth follow-up question experience
- **Document Integration**: Follow-ups can reference uploaded documents

## Future Enhancements

- Thread branching for different conversation paths
- Thread search and filtering
- Thread sharing between users
- Thread export functionality
- Advanced thread analytics

## Security & Privacy

- Thread data is user-specific and properly isolated
- Same Firebase security rules apply to threaded conversations
- No cross-user thread access
- Proper authentication required for all thread operations

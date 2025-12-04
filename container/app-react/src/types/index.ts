export interface SearchResult {
  id: number;
  url: string;
  title: string;
  snippet: string;
  similarity_score: number;
  document_type: string;
  source?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  page: number;
  pages: number;
  search_time_ms: number;
}

export interface User {
  id: number;
  email: string;
  username: string;
  is_admin: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// Chat & Conversation Types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  conversation_id: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationDocument {
  id: string;
  filename: string;
  size: number;
  uploaded_at: string;
  conversation_id: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatStreamEvent {
  type: 'start' | 'token' | 'end' | 'error';
  content?: string;
  conversation_id?: string;
  message_id?: string;
  error?: string;
}

export interface FollowUpQuestionsResponse {
  questions: string[];
}

export interface CreateConversationRequest {
  title?: string;
}

export interface UpdateConversationRequest {
  title: string;
}

export interface ConversationsListResponse {
  conversations: Conversation[];
}

export interface ConversationMessagesResponse {
  messages: Message[];
  conversation: Conversation;
}

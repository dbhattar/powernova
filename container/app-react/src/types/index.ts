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
  model?: string;
  token_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  document_count: number;
  last_message_preview: string | null;
  last_message_role: string | null;
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

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatStreamEvent {
  type: 'start' | 'token' | 'content' | 'sources' | 'end' | 'error';
  content?: string;
  conversation_id?: string;
  message_id?: string;
  error?: string;
  done?: boolean;  // Indicates streaming is complete
  finish_reason?: string;
  sources?: Array<{
    title: string;
    url: string;
    similarity: number;
  }>;
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

// API returns a flat array of conversations, not a nested object
export type ConversationsListResponse = Conversation[];

export interface ConversationMessagesResponse {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
  documents: ConversationDocument[];
}

// User Profile Types
export interface UserProfile {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  total_conversations: number;
  total_documents: number;
  total_messages: number;
}

export interface UserProfileUpdate {
  username?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserDocument {
  id: number;
  title: string;
  url: string;
  document_type: string;
  document_scope: string;
  file_size?: number;
  blob_url?: string;
  status: string;
  chunk_count?: number;
  embedding_generated: boolean;
  created_at: string;
  conversation_id?: number;
  conversation_title?: string;
  processing_status?: string;
}

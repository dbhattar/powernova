import { API_URL } from './config';
import type { 
  SearchResponse, 
  AuthResponse, 
  User,
  ConversationsListResponse,
  Conversation,
  ConversationMessagesResponse,
  CreateConversationRequest,
  UpdateConversationRequest,
  ConversationDocument,
  FollowUpQuestionsResponse,
  ChatRequest
} from '@/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('auth_token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  return response.json();
}

export const api = {
  search: {
    query: async (
      query: string,
      page: number = 1,
      limit: number = 20
    ): Promise<SearchResponse> => {
      return fetchApi<SearchResponse>(
        `/api/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
      );
    },
  },
  
  auth: {
    login: async (email: string, password: string): Promise<AuthResponse> => {
      return fetchApi<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    
    me: async (): Promise<User> => {
      return fetchApi<User>('/api/auth/me');
    },
    
    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
      return fetchApi<void>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
    },
  },
  
  conversations: {
    list: async (): Promise<ConversationsListResponse> => {
      return fetchApi<ConversationsListResponse>('/api/conversations');
    },
    
    create: async (data: CreateConversationRequest = {}): Promise<Conversation> => {
      return fetchApi<Conversation>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    get: async (id: string): Promise<ConversationMessagesResponse> => {
      return fetchApi<ConversationMessagesResponse>(`/api/conversations/${id}`);
    },
    
    update: async (id: string, data: UpdateConversationRequest): Promise<Conversation> => {
      return fetchApi<Conversation>(`/api/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    
    delete: async (id: string): Promise<void> => {
      return fetchApi<void>(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
    },
    
    documents: {
      list: async (conversationId: string): Promise<ConversationDocument[]> => {
        return fetchApi<ConversationDocument[]>(`/api/conversations/${conversationId}/documents`);
      },
      
      upload: async (conversationId: string, file: File): Promise<ConversationDocument> => {
        const token = localStorage.getItem('auth_token');
        const formData = new FormData();
        formData.append('file', file);
        
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(
          `${API_URL}/api/conversations/${conversationId}/documents`,
          {
            method: 'POST',
            headers,
            body: formData,
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiError(
            errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData
          );
        }
        
        return response.json();
      },
      
      delete: async (conversationId: string, documentId: string): Promise<void> => {
        return fetchApi<void>(`/api/conversations/${conversationId}/documents/${documentId}`, {
          method: 'DELETE',
        });
      },
    },
  },
  
  chat: {
    // Note: Stream endpoint returns SSE, handled separately in useChat hook
    getFollowUpQuestions: async (conversationId: string, message: string): Promise<FollowUpQuestionsResponse> => {
      return fetchApi<FollowUpQuestionsResponse>('/api/chat/follow-up-questions', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: conversationId, message }),
      });
    },
  },
};

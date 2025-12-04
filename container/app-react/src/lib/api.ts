import { API_URL } from './config';
import type { SearchResponse } from '@/types';

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
    login: async (email: string, password: string) => {
      return fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    
    me: async () => {
      return fetchApi('/api/auth/me');
    },
  },
};

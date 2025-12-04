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

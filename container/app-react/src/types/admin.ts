// Admin-specific types

export interface CrawlJob {
  id: number;
  start_url: string;
  max_depth: number;
  max_pages: number;
  allowed_domains: string[];
  file_types: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  pages_crawled: number;
  documents_found: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CrawlJobCreate {
  start_url: string;
  max_depth?: number;
  max_pages?: number;
  allowed_domains?: string[];
  file_types?: string[];
  include_patterns?: string[];
  exclude_patterns?: string[];
}

export interface AdminDocument {
  id: number;
  url: string;
  title?: string;
  document_type: string;
  file_path?: string;
  blob_url?: string;
  file_size?: number;
  status: string;
  error_message?: string;
  crawl_job_id?: number;
  embedding_generated: boolean;
  chunk_count: number;
  created_at: string;
  updated_at: string;
  scope?: string;
  user_id?: number;
  conversation_id?: number;
}

export interface DocumentJob {
  id: number;
  document_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface UserCreate {
  email: string;
  username: string;
  password?: string;
  full_name?: string;
  is_active?: boolean;
  is_superuser?: boolean;
}

export interface UserUpdate {
  email?: string;
  username?: string;
  full_name?: string;
  is_active?: boolean;
  is_superuser?: boolean;
  password?: string;
}

export interface Feedback {
  id: number;
  name: string;
  email: string;
  message: string;
  status: 'new' | 'in_progress' | 'resolved';
  user_id?: number;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FeedbackUpdate {
  status?: 'new' | 'in_progress' | 'resolved';
  admin_notes?: string;
}

export interface SystemStats {
  crawl_jobs: {
    total: number;
    running: number;
    pending: number;
    completed: number;
    failed: number;
  };
  documents: {
    total: number;
    with_embeddings: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  embeddings: {
    documents_with_chunks: number;
    documents_with_old_embeddings: number;
    total_chunks: number;
    migration_progress: number;
  };
  users: {
    total: number;
    active: number;
  };
}

export interface EmbeddingStats {
  total_documents: number;
  with_chunks: number;
  old_embeddings: number;
  total_chunks: number;
  anomalies?: number;
  avg_anomaly_ratio?: number;
}

export interface DocumentJobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface DuplicateStats {
  duplicate_count: number;
  affected_urls: number;
  chunks_to_remove: number;
  blobs_to_delete: number;
}

export interface DuplicateCleanupResult {
  documents_deleted: number;
  chunks_deleted: number;
  blobs_deleted: number;
  errors: string[];
}

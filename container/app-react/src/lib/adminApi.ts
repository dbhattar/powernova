import { API_URL } from './config';
import type {
  CrawlJob,
  CrawlJobCreate,
  AdminDocument,
  DocumentJob,
  AdminUser,
  UserCreate,
  UserUpdate,
  Feedback,
  FeedbackUpdate,
  SystemStats,
  EmbeddingStats,
  DocumentJobStats,
  DuplicateStats,
  DuplicateCleanupResult,
} from '@/types/admin';

// Admin key management
const ADMIN_KEY_STORAGE_KEY = 'powernova_admin_key';

export const adminAuth = {
  getAdminKey: (): string | null => {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY);
  },
  
  setAdminKey: (key: string): void => {
    sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
  },
  
  clearAdminKey: (): void => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
  },
  
  isAuthenticated: (): boolean => {
    return !!sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY);
  },
};

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'AdminApiError';
    Object.setPrototypeOf(this, AdminApiError.prototype);
  }

  toString() {
    return this.message;
  }
}

async function fetchAdminApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const adminKey = adminAuth.getAdminKey();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (adminKey) {
    headers['X-Admin-Key'] = adminKey;
  }

  const url = `${API_URL}/api/admin${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401/403 by clearing admin key
    if (response.status === 401 || response.status === 403) {
      adminAuth.clearAdminKey();
      throw new AdminApiError('Admin authentication failed', response.status);
    }

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.statusText}`;
      let errorData: unknown;

      try {
        errorData = await response.json();
        if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
          errorMessage = String(errorData.detail);
        }
      } catch {
        // If JSON parsing fails, use default error message
      }

      throw new AdminApiError(errorMessage, response.status, errorData);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AdminApiError) {
      throw error;
    }
    throw new AdminApiError(
      error instanceof Error ? error.message : 'Network error occurred'
    );
  }
}

// Admin API endpoints
export const adminService = {
  // System Overview
  async getSystemStats(): Promise<SystemStats> {
    return fetchAdminApi<SystemStats>('/stats');
  },

  // Crawl Jobs
  async getCrawlJobs(skip = 0, limit = 50): Promise<CrawlJob[]> {
    return fetchAdminApi<CrawlJob[]>(`/crawl-jobs?skip=${skip}&limit=${limit}`);
  },

  async getCrawlJob(id: number): Promise<CrawlJob> {
    return fetchAdminApi<CrawlJob>(`/crawl-jobs/${id}`);
  },

  async createCrawlJob(job: CrawlJobCreate): Promise<CrawlJob> {
    return fetchAdminApi<CrawlJob>('/crawl-jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    });
  },

  async cancelCrawlJob(id: number): Promise<void> {
    return fetchAdminApi<void>(`/crawl-jobs/${id}/cancel`, {
      method: 'POST',
    });
  },

  async deleteCrawlJob(id: number): Promise<void> {
    return fetchAdminApi<void>(`/crawl-jobs/${id}`, {
      method: 'DELETE',
    });
  },

  // Documents
  async getDocuments(params?: {
    skip?: number;
    limit?: number;
    scope?: string;
    status?: string;
    has_embeddings?: boolean;
  }): Promise<AdminDocument[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return fetchAdminApi<AdminDocument[]>(`/documents${query ? `?${query}` : ''}`);
  },

  async getDocument(id: number): Promise<AdminDocument> {
    return fetchAdminApi<AdminDocument>(`/documents/${id}`);
  },

  async deleteDocument(id: number): Promise<void> {
    return fetchAdminApi<void>(`/documents/${id}`, {
      method: 'DELETE',
    });
  },

  // Embeddings
  async getEmbeddingStats(): Promise<EmbeddingStats> {
    return fetchAdminApi<EmbeddingStats>('/embeddings/stats');
  },

  async reprocessDocuments(limit?: number): Promise<{ job_count: number }> {
    return fetchAdminApi<{ job_count: number }>('/embeddings/reprocess', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  },

  async checkDuplicates(): Promise<DuplicateStats> {
    return fetchAdminApi<DuplicateStats>('/embeddings/duplicates');
  },

  async removeDuplicates(): Promise<DuplicateCleanupResult> {
    return fetchAdminApi<DuplicateCleanupResult>('/embeddings/duplicates/remove', {
      method: 'POST',
    });
  },

  async getTokenAnomalies(limit = 100): Promise<AdminDocument[]> {
    return fetchAdminApi<AdminDocument[]>(`/embeddings/anomalies?limit=${limit}`);
  },

  // Document Jobs
  async getDocumentJobStats(): Promise<DocumentJobStats> {
    return fetchAdminApi<DocumentJobStats>('/document-jobs/stats');
  },

  async getDocumentJobs(params?: {
    skip?: number;
    limit?: number;
    status?: string;
  }): Promise<DocumentJob[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return fetchAdminApi<DocumentJob[]>(`/document-jobs${query ? `?${query}` : ''}`);
  },

  async processDocumentJobs(batch_size = 10): Promise<{ processed: number }> {
    return fetchAdminApi<{ processed: number }>('/document-jobs/process', {
      method: 'POST',
      body: JSON.stringify({ batch_size }),
    });
  },

  async retryDocumentJob(id: number): Promise<void> {
    return fetchAdminApi<void>(`/document-jobs/${id}/retry`, {
      method: 'POST',
    });
  },

  async deleteDocumentJob(id: number): Promise<void> {
    return fetchAdminApi<void>(`/document-jobs/${id}`, {
      method: 'DELETE',
    });
  },

  // Users
  async getUsers(params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
  }): Promise<AdminUser[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return fetchAdminApi<AdminUser[]>(`/users${query ? `?${query}` : ''}`);
  },

  async getUser(id: number): Promise<AdminUser> {
    return fetchAdminApi<AdminUser>(`/users/${id}`);
  },

  async createUser(user: UserCreate): Promise<AdminUser> {
    return fetchAdminApi<AdminUser>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  async updateUser(id: number, user: UserUpdate): Promise<AdminUser> {
    return fetchAdminApi<AdminUser>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(user),
    });
  },

  async deleteUser(id: number): Promise<void> {
    return fetchAdminApi<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  async resetUserPassword(id: number): Promise<{ password: string }> {
    return fetchAdminApi<{ password: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
    });
  },

  // Feedback
  async getFeedback(params?: {
    skip?: number;
    limit?: number;
    status?: string;
  }): Promise<Feedback[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return fetchAdminApi<Feedback[]>(`/feedback${query ? `?${query}` : ''}`);
  },

  async getFeedbackStats(): Promise<{
    total: number;
    new: number;
    in_progress: number;
    resolved: number;
  }> {
    return fetchAdminApi('/feedback/stats');
  },

  async updateFeedback(id: number, update: FeedbackUpdate): Promise<Feedback> {
    return fetchAdminApi<Feedback>(`/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  },

  async deleteFeedback(id: number): Promise<void> {
    return fetchAdminApi<void>(`/feedback/${id}`, {
      method: 'DELETE',
    });
  },

  // Admin Key Management
  async changeAdminKey(newKey: string): Promise<void> {
    await fetchAdminApi<void>('/change-key', {
      method: 'POST',
      body: JSON.stringify({ new_key: newKey }),
    });
    adminAuth.setAdminKey(newKey);
  },
};

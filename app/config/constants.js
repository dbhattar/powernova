// API Configuration
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:9000';

// Document viewer settings
export const DOCUMENT_VIEWER_CONFIG = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  supportedTypes: ['pdf', 'doc', 'docx', 'txt'],
  defaultRelevanceThreshold: 0.3,
};

// Chat settings
export const CHAT_CONFIG = {
  maxMessageLength: 4000,
  historyLimit: 50,
  searchResultsLimit: 5,
};

export default {
  API_BASE_URL,
  DOCUMENT_VIEWER_CONFIG,
  CHAT_CONFIG,
};

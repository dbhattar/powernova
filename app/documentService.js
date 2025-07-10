// Utility functions for document handling
// Note: All document upload/download operations are now handled by the backend API

// Format file size for display
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get appropriate icon for file type
export const getFileIcon = (fileType) => {
  if (!fileType || typeof fileType !== 'string') return 'document';
  
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return 'document-text';
  if (type.includes('word') || type.includes('doc')) return 'document';
  if (type.includes('text')) return 'document-outline';
  return 'document';
};
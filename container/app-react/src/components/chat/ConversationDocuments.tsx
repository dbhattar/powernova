import { FileText, Loader2, X } from 'lucide-react';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import type { ConversationDocument } from '@/types';

interface ConversationDocumentsProps {
  documents: ConversationDocument[];
  isLoading: boolean;
  onDelete?: (documentId: string) => void;
  isDeleting?: boolean;
}

export function ConversationDocuments({ 
  documents, 
  isLoading,
  onDelete,
  isDeleting 
}: ConversationDocumentsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-6 px-4">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No documents in this conversation</p>
        <p className="text-xs text-gray-400 mt-1">Upload documents to enhance AI responses</p>
      </div>
    );
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">      
      <div className="space-y-2 px-3 pb-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="group relative flex items-start gap-2 p-2 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/30 transition-colors"
          >
            <FileText className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.title}
                </p>
                {doc.processing_status && (
                  <ProcessingStatus status={doc.processing_status} size="sm" />
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{formatFileSize(doc.file_size)}</span>
                {doc.chunk_count && (
                  <>
                    <span>•</span>
                    <span>{doc.chunk_count} chunks</span>
                  </>
                )}
              </div>
            </div>

            {onDelete && (
              <button
                onClick={() => onDelete(String(doc.id))}
                disabled={isDeleting}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity disabled:opacity-50"
                title="Remove document"
              >
                <X className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

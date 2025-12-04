import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ConversationDocument } from '@/types';

export function useDocuments(conversationId?: string) {
  const queryClient = useQueryClient();

  // Fetch documents for a conversation
  const {
    data: documents = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['documents', conversationId],
    queryFn: () => api.conversations.documents.list(conversationId!),
    enabled: !!conversationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Upload document
  const uploadDocument = useMutation({
    mutationFn: ({ file }: { file: File }) => {
      if (!conversationId) {
        throw new Error('No conversation selected');
      }
      return api.conversations.documents.upload(conversationId, file);
    },
    onSuccess: (newDocument) => {
      // Add to cache
      queryClient.setQueryData(['documents', conversationId], (old: ConversationDocument[] = []) => [
        ...old,
        newDocument,
      ]);
    },
  });

  // Delete document
  const deleteDocument = useMutation({
    mutationFn: (documentId: string) => {
      if (!conversationId) {
        throw new Error('No conversation selected');
      }
      return api.conversations.documents.delete(conversationId, documentId);
    },
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.setQueryData(['documents', conversationId], (old: ConversationDocument[] = []) =>
        old.filter((doc) => doc.id !== deletedId)
      );
    },
  });

  return {
    documents,
    isLoading,
    error,
    refetch,
    uploadDocument: uploadDocument.mutateAsync,
    deleteDocument: deleteDocument.mutateAsync,
    isUploading: uploadDocument.isPending,
    isDeleting: deleteDocument.isPending,
  };
}

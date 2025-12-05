import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ConversationDocument } from '@/types';

export function useDocuments(conversationId?: number | string) {
  const queryClient = useQueryClient();

  // Fetch documents for a conversation
  const {
    data: documents = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['documents', conversationId],
    queryFn: () => api.conversations.documents.list(String(conversationId)),
    enabled: !!conversationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Upload document
  const uploadDocument = useMutation({
    mutationFn: ({ file }: { file: File }) => {
      if (!conversationId) {
        throw new Error('No conversation selected');
      }
      return api.conversations.documents.upload(String(conversationId), file);
    },
    onSuccess: (newDocument: ConversationDocument) => {
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
      return api.conversations.documents.delete(String(conversationId), documentId);
    },
    onSuccess: (_: void, deletedId: string) => {
      // Remove from cache
      queryClient.setQueryData(['documents', conversationId], (old: ConversationDocument[] = []) =>
        old.filter((doc) => doc.id !== Number(deletedId))
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

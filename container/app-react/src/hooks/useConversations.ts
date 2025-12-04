import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Conversation, CreateConversationRequest, UpdateConversationRequest } from '@/types';

export function useConversations() {
  const queryClient = useQueryClient();

  // Fetch all conversations
  const {
    data: conversationsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.conversations.list(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const conversations = conversationsData?.conversations || [];

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: (data: CreateConversationRequest = {}) => api.conversations.create(data),
    onSuccess: (newConversation) => {
      // Add to cache
      queryClient.setQueryData(['conversations'], (old: any) => ({
        conversations: [newConversation, ...(old?.conversations || [])],
      }));
    },
  });

  // Update conversation (rename)
  const updateConversation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateConversationRequest }) =>
      api.conversations.update(id, data),
    onSuccess: (updatedConversation) => {
      // Update in cache
      queryClient.setQueryData(['conversations'], (old: any) => ({
        conversations: (old?.conversations || []).map((conv: Conversation) =>
          conv.id === updatedConversation.id ? updatedConversation : conv
        ),
      }));
      
      // Also invalidate the specific conversation
      queryClient.invalidateQueries({ queryKey: ['conversation', updatedConversation.id] });
    },
  });

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: (id: string) => api.conversations.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.setQueryData(['conversations'], (old: any) => ({
        conversations: (old?.conversations || []).filter((conv: Conversation) => conv.id !== deletedId),
      }));
      
      // Invalidate the specific conversation query
      queryClient.removeQueries({ queryKey: ['conversation', deletedId] });
    },
  });

  return {
    conversations,
    isLoading,
    error,
    refetch,
    createConversation: createConversation.mutateAsync,
    updateConversation: updateConversation.mutateAsync,
    deleteConversation: deleteConversation.mutateAsync,
    isCreating: createConversation.isPending,
    isUpdating: updateConversation.isPending,
    isDeleting: deleteConversation.isPending,
  };
}

// Hook for a single conversation with messages
export function useConversation(conversationId?: string) {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => api.conversations.get(conversationId!),
    enabled: !!conversationId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
  };

  return {
    conversation: data?.conversation,
    messages: data?.messages || [],
    isLoading,
    error,
    refetch,
    invalidate,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Conversation, CreateConversationRequest, UpdateConversationRequest } from '@/types';

export function useConversations() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Fetch all conversations
  const {
    data: conversationsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.conversations.list(),
    enabled: isAuthenticated, // Only fetch if user is authenticated (reactive!)
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // API returns flat array, not nested object
  const conversations = conversationsData || [];

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: (data: CreateConversationRequest = {}) => api.conversations.create(data),
    onSuccess: (newConversation) => {
      // Add to cache - flat array structure
      queryClient.setQueryData(['conversations'], (old: Conversation[] = []) => 
        [newConversation, ...old]
      );
    },
  });

  // Update conversation (rename)
  const updateConversation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateConversationRequest }) =>
      api.conversations.update(id, data),
    onSuccess: (updatedConversation) => {
      // Update in cache - flat array structure
      queryClient.setQueryData(['conversations'], (old: Conversation[] = []) =>
        old.map((conv) => conv.id === updatedConversation.id ? updatedConversation : conv)
      );
      
      // Also invalidate the specific conversation
      queryClient.invalidateQueries({ queryKey: ['conversation', updatedConversation.id] });
    },
  });

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: (id: string) => api.conversations.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache - flat array structure
      queryClient.setQueryData(['conversations'], (old: Conversation[] = []) =>
        old.filter((conv) => String(conv.id) !== deletedId)
      );
      
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
export function useConversation(conversationId?: number | string) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => api.conversations.get(String(conversationId)),
    enabled: !!conversationId && isAuthenticated, // Only fetch if we have both conversationId and user is authenticated
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
  };

  return {
    conversation: data ? {
      id: data.id,
      title: data.title,
      created_at: data.created_at,
      updated_at: data.updated_at,
      message_count: data.messages?.length || 0,
    } : undefined,
    messages: data?.messages || [],
    documents: data?.documents || [],
    isLoading,
    error,
    refetch,
    invalidate,
  };
}

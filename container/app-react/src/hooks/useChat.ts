import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/config';
import type { Message, ChatStreamEvent } from '@/types';

interface UseChatOptions {
  conversationId?: number | string;
  onConversationCreated?: (conversationId: string) => void;
  onMessageComplete?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const { conversationId, onConversationCreated, onMessageComplete, onError } = options;
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState<Error | null>(null);
  
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isStreaming) return;

      // Get auth token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        const authError = new Error('Not authenticated');
        setError(authError);
        onError?.(authError);
        return;
      }

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setStreamingMessage('');
      setError(null);

      let currentConversationId = conversationId;
      let accumulatedContent = '';
      let currentMessageId = '';

      try {
        const response = await fetch(`${API_URL}/api/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            message,
            conversation_id: conversationId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            
            if (line.startsWith('data: ')) {
              try {
                const event: ChatStreamEvent = JSON.parse(line.slice(6));
                
                switch (event.type) {
                  case 'start':
                    if (event.conversation_id && !currentConversationId) {
                      currentConversationId = event.conversation_id;
                      onConversationCreated?.(event.conversation_id);
                    }
                    if (event.message_id) {
                      currentMessageId = event.message_id;
                    }
                    break;
                    
                  case 'token':
                    if (event.content) {
                      accumulatedContent += event.content;
                      setStreamingMessage(accumulatedContent);
                    }
                    break;
                    
                  case 'end':
                    // Message complete
                    if (currentMessageId && currentConversationId) {
                      const completedMessage: Message = {
                        id: currentMessageId,
                        role: 'assistant',
                        content: accumulatedContent,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };
                      
                      onMessageComplete?.(completedMessage);
                      
                      // Invalidate conversation to refresh messages
                      queryClient.invalidateQueries({ 
                        queryKey: ['conversation', currentConversationId] 
                      });
                      queryClient.invalidateQueries({ 
                        queryKey: ['conversations'] 
                      });
                    }
                    break;
                    
                  case 'error':
                    throw new Error(event.error || 'Streaming error occurred');
                }
              } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError);
              }
            }
          }
        }
      } catch (err) {
        const streamError = err instanceof Error ? err : new Error('Unknown streaming error');
        
        // Don't treat abort as an error
        if (streamError.name === 'AbortError') {
          console.log('Stream aborted by user');
        } else {
          console.error('Chat streaming error:', streamError);
          setError(streamError);
          onError?.(streamError);
        }
      } finally {
        setIsStreaming(false);
        setStreamingMessage('');
        abortControllerRef.current = null;
      }
    },
    [conversationId, isStreaming, queryClient, onConversationCreated, onMessageComplete, onError]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamingMessage('');
  }, []);

  return {
    sendMessage,
    cancelStream,
    isStreaming,
    streamingMessage,
    error,
  };
}

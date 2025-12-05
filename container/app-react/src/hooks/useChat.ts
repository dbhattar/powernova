import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/config';
import type { Message, ChatStreamEvent } from '@/types';

interface Source {
  title: string;
  url: string;
  similarity: number;
}

interface UseChatOptions {
  conversationId?: number | string;
  messages?: Message[];
  onConversationCreated?: (conversationId: string) => void;
  onMessageComplete?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const { conversationId, messages = [], onConversationCreated, onMessageComplete, onError } = options;
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
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
      // Don't clear sources here - let them be updated by new SSE event
      // This prevents flickering during the request
      setError(null);

      let currentConversationId = conversationId;
      let accumulatedContent = '';
      let currentMessageId = '';

      try {
        // Prepare messages array (include conversation history + new message)
        const allMessages = [
          ...messages
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
              role: msg.role,
              content: msg.content,
            })),
          {
            role: 'user' as const,
            content: message,
          },
        ];

        const requestBody: {
          messages: Array<{ role: string; content: string }>;
          conversation_id?: number | string;
          model: string;
          temperature: number;
          max_tokens: number;
          stream: boolean;
          use_rag: boolean;
          top_k: number;
          similarity_threshold: number;
        } = {
          messages: allMessages,
          model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 2000,
          stream: true,
          use_rag: true,
          top_k: 5,
          similarity_threshold: 0.5,
        };

        // Add conversation_id if available
        if (conversationId) {
          requestBody.conversation_id = conversationId;
        }

        const response = await fetch(`${API_URL}/api/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
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
              const data = line.slice(6).trim();
              
              // Skip the [DONE] message from OpenAI/Azure OpenAI
              if (data === '[DONE]') {
                continue;
              }
              
              try {
                const event: ChatStreamEvent = JSON.parse(data);
                
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
                    
                  case 'content':  // Backend sends 'content' type for streaming tokens
                  case 'token':    // Keep backward compatibility
                    if (event.content) {
                      accumulatedContent += event.content;
                      setStreamingMessage(accumulatedContent);
                    }
                    
                    // Check if this is the final message with done flag
                    if (event.done && currentConversationId) {
                      // Create completed message object
                      const completedMessage: Message = {
                        id: currentMessageId || '0',
                        role: 'assistant',
                        content: accumulatedContent,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };
                      
                      // Invalidate queries to refetch with new messages
                      // Wait for refetch to complete before clearing streaming message
                      await queryClient.invalidateQueries({ 
                        queryKey: ['conversation', currentConversationId] 
                      });
                      await queryClient.invalidateQueries({ 
                        queryKey: ['conversations'] 
                      });
                      
                      // Small delay to ensure new messages are rendered
                      await new Promise(resolve => setTimeout(resolve, 200));
                      
                      // Call onMessageComplete callback AFTER queries are invalidated
                      onMessageComplete?.(completedMessage);
                    }
                    break;
                    
                  case 'sources':
                    // Store document sources - clear old sources and set new ones
                    if (event.sources) {
                      setSources(event.sources);
                    } else {
                      setSources([]);
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
                      // Wait for the query to refetch before clearing streaming message
                      await queryClient.invalidateQueries({ 
                        queryKey: ['conversation', currentConversationId] 
                      });
                      await queryClient.invalidateQueries({ 
                        queryKey: ['conversations'] 
                      });
                      
                      // Small delay to ensure UI updates before clearing
                      await new Promise(resolve => setTimeout(resolve, 100));
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
    sources,
    error,
  };
}

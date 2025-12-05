import { useEffect, useRef } from 'react';
import { Loader2, Bot, ExternalLink } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { FollowUpQuestions } from './FollowUpQuestions';
import type { Message } from '@/types';

interface Source {
  title: string;
  url: string;
  similarity: number;
}

interface FollowUpQuestion {
  text: string;
  icon: string;
}

// Simple markdown-like formatting (same as ChatMessage)
function formatMessageContent(content: string): string {
  let formatted = content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>');
  return formatted;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  streamingMessage?: string;
  sources?: Source[];
  followUpQuestions?: FollowUpQuestion[];
  isLoadingQuestions?: boolean;
  onQuestionClick?: (question: string) => void;
}

export function ChatMessages({ 
  messages, 
  isLoading, 
  streamingMessage, 
  sources,
  followUpQuestions = [],
  isLoadingQuestions = false,
  onQuestionClick = () => {},
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !streamingMessage) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-purple-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Start a conversation
          </h3>
          <p className="text-sm text-gray-600">
            Ask questions about energy documents, regulations, and technical data.
            I'm here to help!
          </p>
        </div>
      </div>
    );
  }

  // Check if the last message is from assistant
  const lastMessage = messages[messages.length - 1];
  const showSourcesAndQuestions = lastMessage && lastMessage.role === 'assistant' && !streamingMessage;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Render messages */}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Streaming message */}
        {streamingMessage && (
          <div className="flex gap-4 p-4 bg-gray-50">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold text-gray-900">PowerNOVA</span>
                <Loader2 className="w-3 h-3 text-purple-600 animate-spin" />
              </div>
              <div className="prose prose-sm max-w-none text-gray-800 break-words">
                <div
                  dangerouslySetInnerHTML={{
                    __html: formatMessageContent(streamingMessage),
                  }}
                />
                <span className="inline-block w-2 h-4 bg-purple-600 ml-1 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Sources and Follow-up Questions - shown after assistant's response completes */}
        {showSourcesAndQuestions && (
          <div className="px-4 pb-4 bg-gray-50">
            <div className="ml-12">
              {/* Sources */}
              {sources && sources.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Sources:</h4>
                  <div className="flex flex-col gap-2">
                    {sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                        <span>{source.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Follow-up Questions */}
              <FollowUpQuestions
                questions={followUpQuestions}
                onQuestionClick={onQuestionClick}
                isLoading={isLoadingQuestions}
              />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

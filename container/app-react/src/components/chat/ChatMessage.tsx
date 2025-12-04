import { memo } from 'react';
import { User, Bot } from 'lucide-react';
import type { Message } from '@/types';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage = memo(({ message }: ChatMessageProps) => {
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-4 p-4 ${isAssistant ? 'bg-gray-50' : 'bg-white'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold text-gray-900">
            {isUser ? 'You' : 'PowerNOVA'}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* Message text with markdown support */}
        <div className="prose prose-sm max-w-none text-gray-800 break-words">
          <div
            dangerouslySetInnerHTML={{
              __html: formatMessageContent(message.content),
            }}
          />
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

// Simple markdown-like formatting
// TODO: Add proper markdown library (marked.js) and syntax highlighting (highlight.js)
function formatMessageContent(content: string): string {
  // For now, just handle basic formatting
  let formatted = content
    // Convert line breaks to <br>
    .replace(/\n/g, '<br>')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic text
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>');

  return formatted;
}

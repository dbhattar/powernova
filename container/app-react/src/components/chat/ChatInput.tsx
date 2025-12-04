import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onFileUpload?: (file: File) => void;
  isStreaming?: boolean;
  isUploading?: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onFileUpload,
  isStreaming,
  isUploading,
  disabled,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!message.trim() || isStreaming || disabled) return;

    onSend(message.trim());
    setMessage('');
    setSelectedFile(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onFileUpload?.(file);
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    setMessage(e.target.value);
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* File preview */}
        {selectedFile && (
          <div className="mb-2 flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
            <Paperclip className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-purple-900 flex-1">{selectedFile.name}</span>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1 hover:bg-purple-100 rounded"
            >
              <X className="w-4 h-4 text-purple-600" />
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-2">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="flex-shrink-0 p-2.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Upload document"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt"
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask about energy documents, regulations, or technical data..."
            disabled={disabled || isStreaming}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
            rows={1}
            style={{ minHeight: '48px', maxHeight: '200px' }}
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isStreaming || disabled}
            className="flex-shrink-0 p-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
            title="Send message"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Helper text */}
        <p className="mt-2 text-xs text-gray-500 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

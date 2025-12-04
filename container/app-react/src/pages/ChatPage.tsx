import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConversations, useConversation } from '@/hooks/useConversations';
import { useChat } from '@/hooks/useChat';
import { useDocuments } from '@/hooks/useDocuments';
import { Header } from '@/components/Header';
import { LoginModal } from '@/components/LoginModal';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { AlertCircle } from 'lucide-react';

export function ChatPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  // Sidebar closed by default on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Hooks
  const {
    conversations,
    isLoading: conversationsLoading,
    createConversation,
    updateConversation,
    deleteConversation,
    isCreating,
  } = useConversations();

  const {
    messages,
    isLoading: messagesLoading,
    invalidate: invalidateConversation,
  } = useConversation(activeConversationId);

  const {
    sendMessage,
    isStreaming,
    streamingMessage,
    error: chatError,
  } = useChat({
    conversationId: activeConversationId,
    onConversationCreated: (newConvId) => {
      setActiveConversationId(newConvId);
    },
    onMessageComplete: () => {
      invalidateConversation();
    },
  });

  const {
    uploadDocument,
    isUploading,
  } = useDocuments(activeConversationId);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  const handleCreateConversation = async () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      const newConv = await createConversation({});
      setActiveConversationId(newConv.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleRenameConversation = async (id: string, title: string) => {
    try {
      await updateConversation({ id, data: { title } });
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      if (id === activeConversationId) {
        setActiveConversationId(conversations[0]?.id);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleSendMessage = async (message: string) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

    if (!activeConversationId) {
      // Create conversation first
      const newConv = await createConversation({});
      setActiveConversationId(newConv.id);
    }
    
    try {
      await uploadDocument({ file });
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  // Loading state - only show spinner if we're checking auth, not for the whole interface
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <Header variant="chat" />

      {/* Login Prompt Modal */}
      <LoginModal 
        isOpen={showLoginPrompt} 
        onClose={() => setShowLoginPrompt(false)} 
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <ChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onCreateConversation={handleCreateConversation}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          isLoading={conversationsLoading}
          isCreating={isCreating}
        />

        {/* Chat area */}
        <main className="flex-1 flex flex-col bg-white">
          {/* Error banner */}
          {chatError && (
            <div className="bg-red-50 border-b border-red-200 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4" />
                <span>{chatError.message}</span>
              </div>
            </div>
          )}

          {/* Messages */}
          <ChatMessages
            messages={messages}
            isLoading={messagesLoading}
            streamingMessage={streamingMessage}
          />

          {/* Input */}
          <ChatInput
            onSend={handleSendMessage}
            onFileUpload={handleFileUpload}
            isStreaming={isStreaming}
            isUploading={isUploading}
            disabled={!activeConversationId && !isStreaming}
          />
        </main>
      </div>
    </div>
  );
}

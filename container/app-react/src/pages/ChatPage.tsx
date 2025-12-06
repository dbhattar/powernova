import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConversations, useConversation } from '@/hooks/useConversations';
import { useChat } from '@/hooks/useChat';
import { useFollowUpQuestions } from '@/hooks/useFollowUpQuestions';
import { useDocuments } from '@/hooks/useDocuments';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Header } from '@/components/Header';
import { LoginModal } from '@/components/LoginModal';
import { AccountRequestModal } from '@/components/AccountRequestModal';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { ConversationDocuments } from '@/components/chat/ConversationDocuments';
import { AlertCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { Message } from '@/types';

export function ChatPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const isMobile = useIsMobile();
  // Sidebar closed by default on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [activeConversationId, setActiveConversationId] = useState<number | undefined>();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showAccountRequest, setShowAccountRequest] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);

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
    sources,
    error: chatError,
  } = useChat({
    conversationId: activeConversationId,
    messages: messages || [],
    onConversationCreated: (newConvId) => {
      // Convert string ID from API to number
      const numericId = parseInt(newConvId, 10);
      if (!isNaN(numericId)) {
        setActiveConversationId(numericId);
      }
    },
    onMessageComplete: () => {
      invalidateConversation();
      // Generate follow-up questions after message completes
      // Need to wait a bit for the messages to be refetched
      setTimeout(() => {
        // Refetch messages to get the latest
        if (activeConversationId) {
          queryClient.invalidateQueries({ 
            queryKey: ['conversation', activeConversationId] 
          }).then(() => {
            // Now generate questions with the updated messages
            const updatedMessages = queryClient.getQueryData(['conversation', activeConversationId]) as { messages: Message[] } | undefined;
            if (updatedMessages?.messages && updatedMessages.messages.length > 0) {
              generateQuestions(updatedMessages.messages, 3);
            }
          });
        }
      }, 300);
    },
  });

  const {
    questions: followUpQuestions,
    isLoading: isLoadingQuestions,
    generateQuestions,
    clearQuestions,
  } = useFollowUpQuestions();

  // Create combined messages array with pending user message
  const displayMessages = useMemo(() => {
    const baseMessages = messages || [];
    
    if (pendingUserMessage) {
      // Add optimistic user message
      const optimisticMessage: Message = {
        id: 'pending-user',
        role: 'user',
        content: pendingUserMessage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return [...baseMessages, optimisticMessage];
    }
    
    return baseMessages;
  }, [messages, pendingUserMessage]);
  
  // Clear pending message when messages update with the actual user message
  useEffect(() => {
    if (pendingUserMessage && messages && messages.length > 0) {
      // Check if any message matches our pending message
      // After streaming, we'll have both user and assistant messages
      const hasMatchingMessage = messages.some(
        msg => msg.role === 'user' && msg.content === pendingUserMessage
      );
      
      if (hasMatchingMessage) {
        setPendingUserMessage(null);
      }
    }
  }, [messages, pendingUserMessage]);

  const {
    documents,
    isLoading: isLoadingDocuments,
    uploadDocument,
    deleteDocument,
    isUploading,
    isDeleting,
  } = useDocuments(activeConversationId);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // Handle conversation query parameter (for navigation from profile)
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId) {
      const id = Number(conversationId);
      if (!isNaN(id)) {
        setActiveConversationId(id);
        // Clear the query parameter after setting the conversation
        setSearchParams({});
        // Open sidebar on mobile to show the conversation is selected
        if (isMobile) {
          setSidebarOpen(true);
        }
      }
    }
  }, [searchParams, setSearchParams, isMobile]);

  const handleCreateConversation = async () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      // Close sidebar on mobile when showing login prompt
      if (isMobile) {
        setSidebarOpen(false);
      }
      return;
    }

    try {
      const newConv = await createConversation({});
      setActiveConversationId(newConv.id);
      // Close sidebar on mobile after creating conversation
      if (isMobile) {
        setSidebarOpen(false);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleRenameConversation = async (id: number, title: string) => {
    try {
      await updateConversation({ id: String(id), data: { title } });
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  };

  const handleDeleteConversation = async (id: number) => {
    try {
      await deleteConversation(String(id));
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
      // Clear follow-up questions when sending a new message
      clearQuestions();
      // Set pending message immediately for optimistic UI
      setPendingUserMessage(message);
      await sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      setPendingUserMessage(null); // Clear on error
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
      <Header variant="chat" onMenuClick={() => setSidebarOpen(true)} />

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
          isAuthenticated={isAuthenticated}
          user={user}
          onLogout={logout}
          onLogin={() => setShowLoginPrompt(true)}
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
            messages={displayMessages}
            isLoading={messagesLoading}
            streamingMessage={streamingMessage}
            sources={sources}
            followUpQuestions={followUpQuestions}
            isLoadingQuestions={isLoadingQuestions}
            onQuestionClick={handleSendMessage}
          />

          {/* Documents Panel */}
          {activeConversationId && documents && documents.length > 0 && (
            <div className="border-t border-gray-200">
              {/* Toggle Button */}
              <button
                onClick={() => setShowDocuments(!showDocuments)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Documents ({documents.length})</span>
                </div>
                {showDocuments ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {/* Documents List */}
              {showDocuments && (
                <div className="border-t border-gray-200">
                  <ConversationDocuments
                    documents={documents}
                    isLoading={isLoadingDocuments}
                    onDelete={deleteDocument}
                    isDeleting={isDeleting}
                  />
                </div>
              )}
            </div>
          )}

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

      {/* Modals - Rendered last to ensure proper z-index stacking */}
      <LoginModal 
        isOpen={showLoginPrompt} 
        onClose={() => setShowLoginPrompt(false)}
        onRequestAccount={() => setShowAccountRequest(true)}
      />

      <AccountRequestModal
        isOpen={showAccountRequest}
        onClose={() => setShowAccountRequest(false)}
        onBackToLogin={() => setShowLoginPrompt(true)}
      />
    </div>
  );
}

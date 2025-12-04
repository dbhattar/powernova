import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConversationList } from './ConversationList';
import type { Conversation } from '@/types';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  conversations: Conversation[];
  activeConversationId?: number;
  onSelectConversation: (id: number) => void;
  onCreateConversation: () => void;
  onRenameConversation: (id: number, title: string) => void;
  onDeleteConversation: (id: number) => void;
  isLoading?: boolean;
  isCreating?: boolean;
}

export function ChatSidebar({
  isOpen,
  onClose,
  onToggle,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
  isLoading,
  isCreating,
}: ChatSidebarProps) {
  return (
    <div className="relative flex">
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transform transition-all duration-300 ease-in-out flex overflow-hidden ${
          isOpen 
            ? 'translate-x-0 w-80' 
            : '-translate-x-full lg:translate-x-0 w-80 lg:w-0 lg:border-r-0'
        }`}
      >
        {/* Sidebar content */}
        <div className="w-80 flex-shrink-0 flex flex-col">
          {/* Mobile close button */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Conversation list */}
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={(id) => {
              onSelectConversation(id);
              // Close sidebar on mobile after selecting
              if (window.innerWidth < 1024) {
                onClose();
              }
            }}
            onCreateConversation={onCreateConversation}
            onRenameConversation={onRenameConversation}
            onDeleteConversation={onDeleteConversation}
            isLoading={isLoading}
            isCreating={isCreating}
          />
        </div>
      </aside>

      {/* Toggle button - visible on desktop only, positioned outside sidebar */}
      <button
        onClick={onToggle}
        className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 w-6 h-12 bg-white border border-gray-200 rounded-r-lg items-center justify-center hover:bg-gray-50 transition-all duration-300 shadow-sm z-50 ${
          isOpen ? 'left-[317px]' : 'left-0'
        }`}
        title={isOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-600" />
        )}
      </button>
    </div>
  );
}

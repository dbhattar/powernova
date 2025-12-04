import { memo, useState } from 'react';
import { MessageSquare, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { Conversation } from '@/types';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export const ConversationItem = memo(({
  conversation,
  isActive,
  onClick,
  onRename,
  onDelete,
}: ConversationItemProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(conversation.id, editTitle.trim());
    }
    setIsEditing(false);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this conversation?')) {
      onDelete(conversation.id);
    }
    setShowMenu(false);
  };

  return (
    <div
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-l-2 border-purple-500'
          : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      {/* Icon */}
      <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-600' : 'text-gray-400'}`} />

      {/* Title */}
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') {
              setEditTitle(conversation.title);
              setIsEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
          autoFocus
        />
      ) : (
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? 'text-purple-900' : 'text-gray-900'}`}>
            {conversation.title}
          </p>
          <p className="text-xs text-gray-500">
            {conversation.message_count} {conversation.message_count === 1 ? 'message' : 'messages'}
          </p>
        </div>
      )}

      {/* Menu */}
      {!isEditing && (
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4 text-gray-600" />
          </button>

          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />

              {/* Menu */}
              <div className="absolute right-0 top-8 z-20 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="w-4 h-4" />
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

ConversationItem.displayName = 'ConversationItem';

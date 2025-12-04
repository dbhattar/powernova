import { memo, useState } from 'react';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import type { Conversation } from '@/types';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
}

export const ConversationItem = memo(({
  conversation,
  isActive,
  onClick,
  onRename,
  onDelete,
}: ConversationItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(conversation.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      onDelete(conversation.id);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
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

      {/* Action Icons - Always visible on hover */}
      {!isEditing && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleEditClick}
            className="p-1.5 rounded hover:bg-purple-100 transition-colors"
            title="Rename conversation"
          >
            <Pencil className="w-3.5 h-3.5 text-purple-600" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-red-100 transition-colors"
            title="Delete conversation"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
          </button>
        </div>
      )}
    </div>
  );
});

ConversationItem.displayName = 'ConversationItem';

'use client';

import { ChatItem } from '@/lib/types';

interface LeftSidebarProps {
  chats: ChatItem[];
  currentChatId: string; // New prop to indicate the active chat
  onSelectChat: (chatId: string) => void; // New prop for switching chats
}

export default function LeftSidebar({ chats, currentChatId, onSelectChat }: LeftSidebarProps) {
  return (
    <div className="left-sidebar">
      <div className="sidebar-header">
        <input type="text" className="search-box" placeholder="Search..." />
      </div>
      <div className="chat-list">
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`} // Use currentChatId for active state
            onClick={() => onSelectChat(chat.id)} // Add click handler to switch chats
          >
            <div className="chat-item-title">{chat.title}</div>
            <div className="chat-item-preview">{chat.preview}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
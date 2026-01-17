'use client';

import { ChatItem } from '@/lib/types';

interface LeftSidebarProps {
  chats: ChatItem[];
}

export default function LeftSidebar({ chats }: LeftSidebarProps) {
  return (
    <div className="left-sidebar">
      <div className="sidebar-header">
        <input type="text" className="search-box" placeholder="Search..." />
      </div>
      <div className="chat-list">
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`chat-item ${chat.active ? 'active' : ''}`}
          >
            <div className="chat-item-title">{chat.title}</div>
            <div className="chat-item-preview">{chat.preview}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

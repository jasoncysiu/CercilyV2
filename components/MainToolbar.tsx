'use client';

interface MainToolbarProps {
  onToggleSidebar: () => void;
  onNewChat: () => void; // New prop for creating a new chat
}

export default function MainToolbar({ onToggleSidebar, onNewChat }: MainToolbarProps) {
  return (
    <div className="main-toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={onToggleSidebar}>
          ☰
        </button>
        <span className="chat-title">Engine Optimization Project</span>
      </div>
      <div className="toolbar-right">
        <button className="new-chat-btn" onClick={onNewChat}>+ New Chat</button>
        <button className="toolbar-btn active">🎨</button>
        <button className="toolbar-btn">⚙</button>
      </div>
    </div>
  );
}
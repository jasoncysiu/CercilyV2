'use client';

interface MainToolbarProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  chatTitle: string; // New prop for the current chat's title
}

export default function MainToolbar({ onToggleSidebar, onNewChat, chatTitle }: MainToolbarProps) {
  return (
    <div className="main-toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={onToggleSidebar}>
          ☰
        </button>
        <span className="chat-title">{chatTitle}</span> {/* Display dynamic chat title */}
      </div>
      <div className="toolbar-right">
        <button className="new-chat-btn" onClick={onNewChat}>+ New Chat</button>
        <button className="toolbar-btn active">🎨</button>
        <button className="toolbar-btn">⚙</button>
      </div>
    </div>
  );
}
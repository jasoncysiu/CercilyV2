'use client';

interface MainToolbarProps {
  onToggleSidebar: () => void;
}

export default function MainToolbar({ onToggleSidebar }: MainToolbarProps) {
  return (
    <div className="main-toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={onToggleSidebar}>
          ☰
        </button>
        <span className="chat-title">Engine Optimization Project</span>
      </div>
      <div className="toolbar-right">
        <button className="new-chat-btn">+ New Chat</button>
        <button className="toolbar-btn active">🎨</button>
        <button className="toolbar-btn">⚙</button>
      </div>
    </div>
  );
}

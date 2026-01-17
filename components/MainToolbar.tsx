'use client';

import { Settings } from 'lucide-react';

interface MainToolbarProps {
  chatTitle: string;
}

export default function MainToolbar({
  chatTitle,
}: MainToolbarProps) {
  return (
    <div className="main-toolbar">
      <div className="toolbar-left">
        <span className="chat-title">{chatTitle}</span>
      </div>
      <div className="toolbar-right">
        {/* Placeholder for future tools if needed */}
      </div>
    </div>
  );
}
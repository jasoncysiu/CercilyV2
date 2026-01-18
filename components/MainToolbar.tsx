'use client';

import { Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MainToolbarProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  chatTitle: string;
  availableModels: string[];
  activeChatModel: string;
  onSetActiveChatModel: (modelName: string) => void;
  onOpenSettings: () => void; // New prop for opening settings
}

export default function MainToolbar({
  onToggleSidebar,
  onNewChat,
  chatTitle,
  availableModels,
  activeChatModel,
  onSetActiveChatModel,
  onOpenSettings,
}: MainToolbarProps) {
  return (
    <div className="main-toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={onToggleSidebar}>
          ☰
        </button>
        <div className="toolbar-brand">
          <span className="platform-name">Cercily</span>
        </div>
      </div>
      <div className="toolbar-right">
        {availableModels.length > 0 && (
          <Select value={activeChatModel} onValueChange={onSetActiveChatModel}>
            <SelectTrigger className="w-[180px] bg-[#3a3a3c] border-gray-700 text-white">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent className="bg-[#2c2c2e] border-gray-700 text-white">
              {availableModels.map(modelName => (
                <SelectItem key={modelName} value={modelName}>
                  {modelName.replace('models/', '')} {/* Display name without 'models/' prefix */}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <button className="new-chat-btn" onClick={onNewChat}>+ New Chat</button>
        <button className="toolbar-btn" onClick={onOpenSettings} title="Settings">
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}
'use client';

import { Block, ConnectionPosition } from '@/lib/types';
import ReactMarkdown from 'react-markdown';

interface CanvasBlockProps {
  block: Block;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onEdit: (newText: string) => void;
  onConnectionPointMouseDown: (blockId: string, pos: ConnectionPosition, e: React.MouseEvent) => void;
  onNavigateSource?: () => void;
  onToggle?: () => void;
  isDropTarget?: boolean;
  isDragging?: boolean;
}

export default function CanvasBlock({
  block,
  isSelected,
  onMouseDown,
  onDelete,
  onEdit,
  onConnectionPointMouseDown,
  onNavigateSource,
  onToggle,
  isDropTarget,
  isDragging,
}: CanvasBlockProps) {
  const displayText = block.text.length > 120 ? block.text.slice(0, 120) + '...' : block.text;
  const isCollapsed = block.isCollapsed;

  const handleEdit = () => {
    const newText = prompt('Edit:', block.text);
    if (newText) {
      onEdit(newText);
    }
  };

  const handleConnectionMouseDown = (pos: ConnectionPosition) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onConnectionPointMouseDown(block.id, pos, e);
  };

  return (
    <div
      id={block.id}
      className={`canvas-block ${block.color} ${block.type === 'table' ? 'table-block' : ''} ${isSelected ? 'selected' : ''} ${isDropTarget ? 'drop-target' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ left: block.x, top: block.y }}
      onMouseDown={onMouseDown}
    >
      <div className="block-header">
        <span className={`block-tag ${block.color}`}>{block.color}</span>
        <div className="block-actions">
          <button 
            className="block-action" 
            onClick={(e) => { e.stopPropagation(); onToggle?.(); }} 
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? '↕️' : '—'}
          </button>
          
          {onNavigateSource && block.messageId && (
            <button className="block-action" onClick={(e) => { e.stopPropagation(); onNavigateSource(); }} title="Go to source">
              🔗
            </button>
          )}
          <button className="block-action edit-btn" onClick={handleEdit}>
            ✏
          </button>
          <button className="block-action delete-btn" onClick={onDelete}>
            🗑
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <div 
          className={`block-content ${block.type === 'table' ? 'table-mode' : ''} cursor-pointer hover:underline`} 
          onClick={(e) => {
            if (onNavigateSource && block.messageId) {
              e.stopPropagation();
              onNavigateSource();
            }
          }}
          title={block.messageId ? "Click to jump to chat source" : undefined}
        >
          {block.type === 'table' ? (
            <div className="markdown-content">
              <ReactMarkdown>{block.text}</ReactMarkdown>
            </div>
          ) : (
            displayText
          )}
        </div>
      )}
      
      {isCollapsed && (
         <div className="block-content collapsed-preview" style={{ fontSize: '10px', color: '#8e8e93' }}>
           {block.text.slice(0, 20) + (block.text.length > 20 ? '...' : '')}
         </div>
      )}

      <div
        className="connection-point top"
        data-pos="top"
        onMouseDown={handleConnectionMouseDown('top')}
      />
      <div
        className="connection-point bottom"
        data-pos="bottom"
        onMouseDown={handleConnectionMouseDown('bottom')}
      />
      <div
        className="connection-point left"
        data-pos="left"
        onMouseDown={handleConnectionMouseDown('left')}
      />
      <div
        className="connection-point right"
        data-pos="right"
        onMouseDown={handleConnectionMouseDown('right')}
      />
    </div>
  );
}

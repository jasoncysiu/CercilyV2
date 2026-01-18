'use client';

import { Block, ConnectionPosition } from '@/lib/types';

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
  onResizeMouseDown?: (blockId: string, e: React.MouseEvent) => void;
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
  onResizeMouseDown,
}: CanvasBlockProps) {
  const displayText = block.text;
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
      className={`canvas-block ${block.color} ${isSelected ? 'selected' : ''} ${isDropTarget ? 'drop-target' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ 
        left: block.x, 
        top: block.y,
        width: block.width || (isCollapsed ? 160 : 260),
        height: block.height || 'auto',
        minHeight: isCollapsed ? 'unset' : '100px'
      }}
      onMouseDown={onMouseDown}
    >
      <div className="block-header">
        <span className={`block-tag ${block.color}`}>{block.color}</span>
      </div>
      
      {!isCollapsed && (
        <div 
          className="block-content cursor-pointer hover:underline" 
          onClick={(e) => {
            if (onNavigateSource && block.messageId) {
              e.stopPropagation();
              onNavigateSource();
            }
          }}
          title={block.messageId ? "Click to jump to chat source" : undefined}
          style={{ height: block.height ? 'calc(100% - 40px)' : 'auto', overflow: 'hidden' }}
        >
          {displayText}
        </div>
      )}
      
      {isCollapsed && (
         <div className="block-content collapsed-preview" style={{ fontSize: '10px', color: '#8e8e93' }}>
           {block.text.slice(0, 20) + (block.text.length > 20 ? '...' : '')}
         </div>
      )}

      {/* Resize Handle */}
      {!isCollapsed && onResizeMouseDown && (
        <div 
          className="resize-handle" 
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeMouseDown(block.id, e);
          }}
        >
          <div className="resize-icon">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 1V11H1L11 1Z" fill="white" />
            </svg>
          </div>
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

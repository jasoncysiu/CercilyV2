'use client';

import { Node, Graph } from '@antv/x6';
import { useRef, useEffect, useState } from 'react';
import { Block, ConnectionPosition } from '@/lib/types';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface X6CanvasBlockProps {
  node: Node;
  graph: Graph;
}

export default function X6CanvasBlock({ node, graph }: X6CanvasBlockProps) {
  const data = node.getData() as { block: Block } | undefined;
  const block = data?.block;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localText, setLocalText] = useState(block?.text || '');

  useEffect(() => {
    if (block) setLocalText(block.text);
  }, [block?.text]);

  useEffect(() => {
    if (block?.isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [block?.isEditing]);

  if (!block) return null;

  const isCollapsed = block.isCollapsed;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value);
  };

  const handleBlur = () => {
    // Dispatch edit via custom event (picked up by X6CanvasPanel)
    const event = new CustomEvent('x6-block-edit', {
      detail: { blockId: block.id, text: localText },
    });
    window.dispatchEvent(event);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const event = new CustomEvent('x6-block-edit', {
        detail: { blockId: block.id, text: localText },
      });
      window.dispatchEvent(event);
    }
    if (e.key === 'Escape') {
      const event = new CustomEvent('x6-block-edit', {
        detail: { blockId: block.id, text: block.text },
      });
      window.dispatchEvent(event);
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    if (block.messageId) {
      e.stopPropagation();
      const event = new CustomEvent('x6-block-navigate', {
        detail: {
          blockId: block.id,
          chatId: block.chatId,
          messageId: block.messageId,
          startOffset: block.startOffset,
          endOffset: block.endOffset,
        },
      });
      window.dispatchEvent(event);
    }
  };

  const handleToggleConnected = (pos: ConnectionPosition, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const event = new CustomEvent('x6-toggle-connected', {
      detail: { blockId: block.id, pos },
    });
    window.dispatchEvent(event);
  };

  return (
    <div
      className={`x6-block-inner ${block.color} ${block.isEditing ? 'editing' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '8px',
        cursor: 'grab',
      }}
    >
      <div className="block-header">
        <span className={`block-tag ${block.color}`}>{block.color}</span>
      </div>

      {!isCollapsed && !block.isEditing && (
        <div
          className="block-content cursor-pointer hover:underline"
          onClick={handleContentClick}
          title={block.messageId ? 'Click to jump to chat source' : undefined}
          style={{ height: block.height ? 'calc(100% - 40px)' : 'auto', overflow: 'hidden' }}
        >
          {block.text}
        </div>
      )}

      {!isCollapsed && block.isEditing && (
        <div
          className="block-content editing"
          style={{
            height: block.height ? `calc(${block.height}px - 50px)` : 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <textarea
            ref={textareaRef}
            className="w-full h-full bg-transparent border-none outline-none resize-none text-inherit font-inherit"
            style={{ flex: 1 }}
            value={localText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Type your note..."
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {isCollapsed && (
        <div className="block-content collapsed-preview" style={{ fontSize: '10px', opacity: 0.6 }}>
          {block.text.slice(0, 20) + (block.text.length > 20 ? '...' : '')}
        </div>
      )}
    </div>
  );
}

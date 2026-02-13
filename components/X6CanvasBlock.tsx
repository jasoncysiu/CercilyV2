'use client';

import { Node, Graph } from '@antv/x6';
import { useRef, useEffect, useState } from 'react';
import { Block, BlockColor, ConnectionPosition } from '@/lib/types';
import { branchColorMap } from '@/lib/x6-helpers';

interface X6CanvasBlockProps {
  node: Node;
  graph: Graph;
}

export default function X6CanvasBlock({ node, graph }: X6CanvasBlockProps) {
  const data = node.getData() as { block: Block; hasChildren?: boolean; isDropTarget?: boolean } | undefined;
  const block = data?.block;
  const hasChildren = data?.hasChildren ?? false;
  const isDropTarget = data?.isDropTarget ?? false;
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
  const branchColor = branchColorMap[block.color] || '#03A9F4';

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value);
  };

  const handleBlur = () => {
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

  const handleCollapseToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const event = new CustomEvent('x6-toggle-collapse', {
      detail: { blockId: block.id },
    });
    window.dispatchEvent(event);
  };

  // MMW-style: dual-layer background (white/dark base + semi-transparent color overlay)
  return (
    <div
      className={`x6-block-inner ${block.color} ${block.isEditing ? 'editing' : ''} ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '14px',
        cursor: 'grab',
        position: 'relative',
        // Base background from CSS variable, colored overlay via pseudo-element
        background: 'var(--bg-elevated)',
        boxShadow: isDropTarget
          ? `0 0 0 3px ${branchColor}, 0 0 20px ${branchColor}40`
          : undefined,
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      }}
    >
      {/* Semi-transparent color overlay (MMW's fill-opacity 0.18 style) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '14px',
          background: branchColor,
          opacity: 0.18,
          pointerEvents: 'none',
        }}
      />

      {/* Content layer */}
      <div style={{ position: 'relative', zIndex: 1, padding: '12px 22px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Collapse button — MMW circle style */}
        {hasChildren && (
          <button
            className="x6-collapse-btn"
            onClick={handleCollapseToggle}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            title={isCollapsed ? 'Expand children' : 'Collapse children'}
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              background: branchColor,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              lineHeight: 1,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          >
            {isCollapsed ? '+' : '\u2212'}
          </button>
        )}

        {/* Text content */}
        {!isCollapsed && !block.isEditing && (
          <div
            className="block-content"
            onClick={handleContentClick}
            title={block.messageId ? 'Click to jump to chat source' : undefined}
            style={{
              flex: 1,
              overflow: 'hidden',
              cursor: block.messageId ? 'pointer' : 'grab',
            }}
          >
            {renderFormattedText(block.text)}
          </div>
        )}

        {!isCollapsed && block.isEditing && (
          <div
            className="block-content editing"
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
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
          <div className="block-content collapsed-preview">
            {block.text.slice(0, 30) + (block.text.length > 30 ? '...' : '')}
          </div>
        )}
      </div>
    </div>
  );
}

/** Render inline markdown: **bold**, *italic*, ~~strikethrough~~ */
function renderFormattedText(text: string) {
  // Split by markdown patterns and render as React elements
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      // ~~strikethrough~~
      parts.push(<s key={key++}>{match[4]}</s>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

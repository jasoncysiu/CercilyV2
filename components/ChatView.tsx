'use client';

import { useState, useRef, useCallback } from 'react';
import { Message, BlockColor, Highlight } from '@/lib/types';

interface ChatViewProps {
  messages: Message[];
  highlights: Highlight[];
  onTextSelection: (text: string, rect: DOMRect, messageId: string, startOffset: number, endOffset: number) => void;
  onHighlightClick: (highlightId: string, rect: DOMRect) => void; // New prop
}

export default function ChatView({ messages, highlights, onTextSelection, onHighlightClick }: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';
    
    if (text.length > 0 && text.length < 500 && selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Find the message element that contains the selection
      let node = range.startContainer;
      while (node && !node.parentElement?.classList.contains('message-bubble')) {
        node = node.parentNode as Node;
      }
      
      const messageBubble = node?.parentElement;
      const messageEl = messageBubble?.closest('.message');
      const messageId = messageEl?.getAttribute('data-message-id') || '';
      
      if (messageId) {
        // Calculate offsets within the message text
        const startOffset = getTextOffset(messageBubble!, range.startContainer, range.startOffset);
        const endOffset = getTextOffset(messageBubble!, range.endContainer, range.endOffset);
        
        onTextSelection(text, rect, messageId, startOffset, endOffset);
      }
    }
  };

  // Get the text offset from the start of the element
  const getTextOffset = (root: Element, targetNode: Node, targetOffset: number): number => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let offset = 0;
    let node = walker.nextNode();
    
    while (node) {
      if (node === targetNode) {
        return offset + targetOffset;
      }
      offset += node.textContent?.length || 0;
      node = walker.nextNode();
    }
    
    return offset;
  };

  // Apply highlights to message content
  const renderMessageContent = useCallback((message: Message) => {
    const messageHighlights = highlights
      .filter(h => h.messageId === message.id)
      .sort((a, b) => a.startOffset - b.startOffset);

    if (messageHighlights.length === 0) {
      return (
        <div
          className="message-bubble selectable-text"
          dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br>') }}
        />
      );
    }

    // Build the highlighted content
    const content = message.content;
    const parts: { text: string; color?: BlockColor; highlightId?: string }[] = [];
    let lastIndex = 0;

    messageHighlights.forEach(highlight => {
      // Add text before this highlight
      if (highlight.startOffset > lastIndex) {
        parts.push({ text: content.slice(lastIndex, highlight.startOffset) });
      }
      // Add highlighted text
      parts.push({ 
        text: content.slice(highlight.startOffset, highlight.endOffset),
        color: highlight.color,
        highlightId: highlight.id // Add highlightId here
      });
      lastIndex = highlight.endOffset;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({ text: content.slice(lastIndex) });
    }

    return (
      <div className="message-bubble selectable-text">
        {parts.map((part, index) => {
          const htmlContent = part.text.replace(/\n/g, '<br>');
          if (part.color && part.highlightId) {
            return (
              <mark
                key={index}
                className={`highlight-${part.color}`}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering handleCanvasClick
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  onHighlightClick(part.highlightId!, rect);
                }}
              />
            );
          }
          return <span key={index} dangerouslySetInnerHTML={{ __html: htmlContent }} />;
        })}
      </div>
    );
  }, [highlights, onHighlightClick]);

  return (
    <div className="chat-view">
      <div className="chat-header">
        <span className="chat-header-title">💬 Conversation</span>
        <span style={{ fontSize: '11px', color: '#636366' }}>Select text → Canvas</span>
      </div>
      <div className="chat-messages" ref={messagesRef} onMouseUp={handleMouseUp}>
        {messages.map(message => (
          <div key={message.id} className={`message ${message.role}`} data-message-id={message.id}>
            {renderMessageContent(message)}
          </div>
        ))}
      </div>
      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            placeholder="Message ChatGPT..."
            rows={1}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />
          <button className="send-btn" disabled={!inputValue.trim()}>
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
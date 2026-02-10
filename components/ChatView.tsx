'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Message, BlockColor, Highlight } from '@/lib/types';
import { FileText } from 'lucide-react';

interface ChatViewProps {
  messages: Message[];
  highlights: Highlight[];
  onTextSelection: (text: string, rect: DOMRect, messageId: string, startOffset: number, endOffset: number) => void;
  onHighlightClick: (highlightId: string, rect: DOMRect) => void;
  onHighlightNavigate?: (messageId: string, startOffset: number, endOffset: number) => void;
  onSendMessage: (content: string) => Promise<void>;
  isSendingMessage: boolean;
  includeContext?: boolean;
  onToggleContext?: () => void;
  hasContext?: boolean;
}

export default function ChatView({
  messages,
  highlights,
  onTextSelection,
  onHighlightClick,
  onHighlightNavigate,
  onSendMessage,
  isSendingMessage,
  includeContext = true,
  onToggleContext,
  hasContext = false,
}: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    const text = selectedText.trim();

    if (text.length > 0 && text.length < 500 && selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Find the message element that contains the selection
      let node: Node | null = range.startContainer;
      let messageBubble: HTMLElement | null = null;

      // Traverse up to find the message-bubble
      while (node) {
        if (node instanceof HTMLElement && node.classList.contains('message-bubble')) {
          messageBubble = node;
          break;
        }
        if (node.parentElement?.classList.contains('message-bubble')) {
          messageBubble = node.parentElement;
          break;
        }
        node = node.parentNode;
      }

      const messageEl = messageBubble?.closest('.message');
      const messageId = messageEl?.getAttribute('data-message-id') || '';

      if (messageId && messageBubble) {
        const message = messages.find(m => m.id === messageId);
        if (message) {
          const content = message.content;

          // Calculate the DOM-based offset first using TreeWalker
          const treeWalker = document.createTreeWalker(messageBubble, NodeFilter.SHOW_TEXT);
          let charCount = 0;
          let domOffset = -1;

          while (treeWalker.nextNode()) {
            const currentNode = treeWalker.currentNode;
            const nodeLength = currentNode.textContent?.length || 0;

            if (domOffset === -1 && currentNode === range.startContainer) {
              domOffset = charCount + range.startOffset;
            }

            charCount += nodeLength;
          }

          // Map DOM offset to original content offset
          // The DOM textContent may differ from message.content (e.g. HTML entities,
          // <br> vs \n, markdown stripping). So we search for the selected text
          // in the original content near the proportional position.
          let startOffset = -1;
          const domText = messageBubble.textContent || '';

          if (domOffset !== -1 && domText.length > 0) {
            // Estimate where in the original content this position maps to
            const ratio = domOffset / domText.length;
            const estimatedPos = Math.round(ratio * content.length);

            // Find all occurrences and pick the one closest to the estimated position
            let searchFrom = 0;
            let bestOffset = -1;
            let bestDist = Infinity;

            while (searchFrom < content.length) {
              const idx = content.indexOf(text, searchFrom);
              if (idx === -1) break;
              const dist = Math.abs(idx - estimatedPos);
              if (dist < bestDist) {
                bestDist = dist;
                bestOffset = idx;
              }
              searchFrom = idx + 1;
            }

            if (bestOffset !== -1) {
              startOffset = bestOffset;
            }
          }

          // Fallback: simple indexOf on full content
          if (startOffset === -1) {
            startOffset = content.indexOf(text);
          }

          if (startOffset !== -1) {
            const endOffset = startOffset + text.length;
            onTextSelection(text, rect, messageId, startOffset, endOffset);
          }
        }
      }
    }
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
        highlightId: highlight.id
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
            const highlight = highlights.find(h => h.id === part.highlightId);
            return (
              <mark
                key={index}
                className={`highlight-${part.color}`}
                style={{ cursor: 'pointer' }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Navigate to the corresponding block on the canvas
                  if (highlight && onHighlightNavigate) {
                    onHighlightNavigate(highlight.messageId, highlight.startOffset, highlight.endOffset);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
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

  const handleSendClick = async () => {
    await onSendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  return (
    <div className="chat-view">
      <div className="chat-header">
        <span className="chat-header-title">Conversation</span>
        <span style={{ fontSize: '11px', opacity: 0.6 }}>Select text → Canvas</span>
      </div>
      <div className="chat-messages" ref={messagesRef} onMouseUp={handleMouseUp}>
        {messages.map(message => (
          <div key={message.id} className={`message ${message.role}`} data-message-id={message.id}>
            {renderMessageContent(message)}
          </div>
        ))}
        {isSendingMessage && (
          <div className="message assistant">
            <div className="message-bubble">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="chat-input-container">
        {hasContext && onToggleContext && (
          <div className="chat-input-options">
            <button
              className={`context-toggle ${includeContext ? 'active' : ''}`}
              onClick={onToggleContext}
              title={includeContext ? 'Context included' : 'Context not included'}
            >
              <FileText size={14} />
              <span>Context {includeContext ? 'On' : 'Off'}</span>
            </button>
          </div>
        )}
        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            placeholder="Message ChatGPT..."
            rows={1}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSendingMessage}
          />
          <button
            className="send-btn"
            disabled={!inputValue.trim() || isSendingMessage}
            onClick={handleSendClick}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
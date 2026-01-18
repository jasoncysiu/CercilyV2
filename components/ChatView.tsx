'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Message, BlockColor, Highlight } from '@/lib/types';

interface ChatViewProps {
  messages: Message[];
  highlights: Highlight[];
  onTextSelection: (text: string, rect: DOMRect, messageId: string, startOffset: number, endOffset: number) => void;
  onHighlightClick: (highlightId: string, rect: DOMRect) => void;
  onSendMessage: (content: string) => Promise<void>; // New prop for sending messages
  isSendingMessage: boolean; // New prop for loading state
}

export default function ChatView({
  messages,
  highlights,
  onTextSelection,
  onHighlightClick,
  onSendMessage,
  isSendingMessage,
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
      let node = range.startContainer;
      while (node && !node.parentElement?.classList.contains('message-bubble')) {
        node = node.parentNode as Node;
      }
      
      const messageBubble = node?.parentElement;
      const messageEl = messageBubble?.closest('.message');
      const messageId = messageEl?.getAttribute('data-message-id') || '';
      
      if (messageId) {
        // Find the message to get its content
        const message = messages.find(m => m.id === messageId);
        if (message) {
          // Find the exact position of the selected text in the message content
          const contentIndex = message.content.indexOf(text);
          if (contentIndex !== -1) {
            const startOffset = contentIndex;
            const endOffset = contentIndex + text.length;
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
            return (
              <mark
                key={index}
                className={`highlight-${part.color}`}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                onClick={(e) => {
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
        <span style={{ fontSize: '11px', color: '#636366' }}>Select text → Canvas</span>
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
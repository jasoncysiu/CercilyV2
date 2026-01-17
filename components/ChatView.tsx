'use client';

import { useState, useRef } from 'react';
import { Message } from '@/lib/types';

interface ChatViewProps {
  messages: Message[];
  onTextSelection: (text: string, rect: DOMRect) => void;
}

export default function ChatView({ messages, onTextSelection }: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';
    if (text.length > 0 && text.length < 500 && selection?.rangeCount) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      onTextSelection(text, rect);
    }
  };

  return (
    <div className="chat-view">
      <div className="chat-header">
        <span className="chat-header-title">💬 Conversation</span>
        <span style={{ fontSize: '11px', color: '#636366' }}>Select text → Canvas</span>
      </div>
      <div className="chat-messages" ref={messagesRef} onMouseUp={handleMouseUp}>
        {messages.map(message => (
          <div key={message.id} className={`message ${message.role}`}>
            <div
              className="message-bubble selectable-text"
              dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br>') }}
            />
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

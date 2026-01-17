'use client';

import { useState, useRef, useEffect } from 'react';
import { BlockColor } from '@/lib/types';

interface NewBlockInputProps {
  x: number;
  y: number;
  onCancel: () => void;
  onCreate: (text: string, color: BlockColor) => void;
}

const colors: BlockColor[] = ['yellow', 'blue', 'pink', 'green', 'orange'];

export default function NewBlockInput({ x, y, onCancel, onCreate }: NewBlockInputProps) {
  const [text, setText] = useState('');
  const [selectedColor, setSelectedColor] = useState<BlockColor>('yellow');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (text.trim()) {
        onCreate(text.trim(), selectedColor);
      }
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleCreate = () => {
    if (text.trim()) {
      onCreate(text.trim(), selectedColor);
    }
  };

  return (
    <div
      className="new-block-input"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        placeholder="Type your note here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="new-block-colors">
        {colors.map(color => (
          <button
            key={color}
            className={`color-btn ${color} ${selectedColor === color ? 'selected' : ''}`}
            onClick={() => setSelectedColor(color)}
          />
        ))}
      </div>
      <div className="new-block-actions">
        <button className="new-block-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="new-block-create"
          disabled={!text.trim()}
          onClick={handleCreate}
        >
          Create
        </button>
      </div>
    </div>
  );
}

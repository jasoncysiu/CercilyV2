'use client';

import { Trash2 } from 'lucide-react';
import React from 'react';

interface RemoveHighlightPopupProps {
  visible: boolean;
  x: number;
  y: number;
  onRemove: () => void;
  onClose: () => void;
}

export default function RemoveHighlightPopup({
  visible,
  x,
  y,
  onRemove,
  onClose,
}: RemoveHighlightPopupProps) {
  if (!visible) return null;

  return (
    <div
      id="remove-highlight-popup"
      className="remove-highlight-popup"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the popup itself
    >
      <button className="action-btn" onClick={onRemove} title="Remove highlight">
        <Trash2 size={18} />
      </button>
    </div>
  );
}
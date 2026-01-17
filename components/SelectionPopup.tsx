'use client';

import { BlockColor } from '@/lib/types';

interface SelectionPopupProps {
  visible: boolean;
  x: number;
  y: number;
  onColorClick: (color: BlockColor) => void;
  onCopyClick: () => void;
}

const colors: BlockColor[] = ['yellow', 'blue', 'pink', 'green', 'orange'];

export default function SelectionPopup({
  visible,
  x,
  y,
  onColorClick,
  onCopyClick,
}: SelectionPopupProps) {
  return (
    <div
      id="selection-popup"
      className={`selection-popup ${visible ? 'visible' : ''}`}
      style={{ top: y, left: x }}
    >
      {colors.map(color => (
        <button
          key={color}
          className={`color-btn ${color}`}
          onClick={() => onColorClick(color)}
        />
      ))}
      <div className="popup-divider" />
      <button className="action-btn" onClick={onCopyClick}>
        📋
      </button>
    </div>
  );
}

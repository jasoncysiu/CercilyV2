'use client';

import { Clipboard } from 'lucide-react'; // Import Lucide icon
import { BlockColor } from '@/lib/types';

interface SelectionPopupProps {
  visible: boolean;
  x: number;
  y: number;
  onColorClick: (color: BlockColor) => void;
  onCopyClick: () => void;
  currentColor?: BlockColor;
}

const colors: BlockColor[] = ['orange', 'cyan', 'pink', 'purple', 'green', 'gold', 'blue', 'teal'];

const colorLabels: Record<BlockColor, string> = {
  orange: 'Orange',
  cyan: 'Cyan',
  pink: 'Pink',
  purple: 'Purple',
  green: 'Green',
  gold: 'Gold',
  blue: 'Blue',
  teal: 'Teal',
};

export default function SelectionPopup({
  visible,
  x,
  y,
  onColorClick,
  onCopyClick,
  currentColor = 'blue',
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
          title={colorLabels[color]}
        />
      ))}
      <div className="popup-divider" />
      <button className="action-btn" onClick={onCopyClick} title="Copy to clipboard">
        <Clipboard size={18} />
      </button>
    </div>
  );
}
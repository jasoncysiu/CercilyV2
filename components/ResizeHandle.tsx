'use client';

import React, { useState, useEffect } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface ResizeHandleProps {
  onResize: (newLeftWidth: number) => void;
  minLeftWidth?: number;
  minRightWidth?: number;
}

export default function ResizeHandle({
  onResize,
  minLeftWidth = 300,
  minRightWidth = 300,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      onResize(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto'; 
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      className="relative flex justify-center items-center w-2 h-full cursor-col-resize z-50 group px-1"
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Vertical Divider Line */}
      <div 
        className={`absolute h-full w-[1px] transition-colors duration-200 ${
          isDragging || isHovered ? 'bg-[#0a84ff]' : 'bg-[#2c2c2e]'
        }`}
      />
      
      {/* Pill Handle Icon */}
      <div 
        className={`
          absolute flex items-center justify-center 
          w-5 h-8 rounded-full 
          bg-[#1c1c1e] border shadow-sm 
          transition-all duration-200
          ${isDragging || isHovered 
            ? 'border-[#0a84ff] text-[#0a84ff] scale-110' 
            : 'border-[#2c2c2e] text-[#636366]'
          }
        `}
      >
        <ChevronsLeftRight size={12} />
      </div>
    </div>
  );
}

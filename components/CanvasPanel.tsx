'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Block, Connection, BlockColor, ToolType, ConnectionPosition } from '@/lib/types';
import CanvasBlock from './CanvasBlock';
import NewBlockInput from './NewBlockInput';

interface CanvasPanelProps {
  blocks: Block[];
  connections: Connection[];
  selectedBlock: string | null;
  currentTool: ToolType;
  zoom: number;
  onSetTool: (tool: ToolType) => void;
  onAddBlock: (text: string, color: BlockColor, x?: number, y?: number) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onDeleteBlock: (id: string) => void;
  onSelectBlock: (id: string | null) => void;
  onAddConnection: (fromId: string, fromPos: ConnectionPosition, toId: string, toPos: ConnectionPosition) => void;
  onClearCanvas: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExport: () => void;
}

export default function CanvasPanel({
  blocks,
  connections,
  selectedBlock,
  currentTool,
  zoom,
  onSetTool,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  onSelectBlock,
  onAddConnection,
  onClearCanvas,
  onZoomIn,
  onZoomOut,
  onExport,
}: CanvasPanelProps) {
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const [newBlockPos, setNewBlockPos] = useState<{ x: number; y: number } | null>(null);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Connecting state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<{ blockId: string; pos: ConnectionPosition } | null>(null);
  const [tempLineEnd, setTempLineEnd] = useState({ x: 0, y: 0 });

  const getConnPoint = useCallback((blockId: string, pos: ConnectionPosition) => {
    const el = document.getElementById(blockId);
    const canvasArea = canvasAreaRef.current;
    if (!el || !canvasArea) return { x: 0, y: 0 };
    
    const rect = el.getBoundingClientRect();
    const cRect = canvasArea.getBoundingClientRect();
    
    let x = 0, y = 0;
    switch (pos) {
      case 'top':
        x = rect.left + rect.width / 2 - cRect.left;
        y = rect.top - cRect.top;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2 - cRect.left;
        y = rect.bottom - cRect.top;
        break;
      case 'left':
        x = rect.left - cRect.left;
        y = rect.top + rect.height / 2 - cRect.top;
        break;
      case 'right':
        x = rect.right - cRect.left;
        y = rect.top + rect.height / 2 - cRect.top;
        break;
    }
    return { x, y };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (currentTool !== 'text') return;
    if ((e.target as HTMLElement).closest('.canvas-block')) return;
    if ((e.target as HTMLElement).closest('.new-block-input')) return;

    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = Math.max(20, e.clientX - rect.left - 100);
    const y = Math.max(20, e.clientY - rect.top - 20);
    setNewBlockPos({ x, y });
  };

  const handleBlockMouseDown = (blockId: string, e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    
    onSelectBlock(blockId);
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleConnectionPointMouseDown = (blockId: string, pos: ConnectionPosition, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConnecting(true);
    setConnectingFrom({ blockId, pos });
    
    const pt = getConnPoint(blockId, pos);
    setTempLineEnd(pt);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && selectedBlock) {
        const canvasArea = canvasAreaRef.current;
        if (!canvasArea) return;
        
        const cRect = canvasArea.getBoundingClientRect();
        const newX = Math.max(0, e.clientX - cRect.left - dragOffset.x);
        const newY = Math.max(0, e.clientY - cRect.top - dragOffset.y);
        
        onUpdateBlock(selectedBlock, { x: newX, y: newY });
      }
      
      if (isConnecting) {
        const canvasArea = canvasAreaRef.current;
        if (!canvasArea) return;
        
        const cRect = canvasArea.getBoundingClientRect();
        setTempLineEnd({
          x: e.clientX - cRect.left,
          y: e.clientY - cRect.top,
        });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isDragging) {
        setIsDragging(false);
      }
      
      if (isConnecting && connectingFrom) {
        const target = e.target as HTMLElement;
        if (target.classList.contains('connection-point')) {
          const toEl = target.closest('.canvas-block') as HTMLElement;
          if (toEl && toEl.id !== connectingFrom.blockId) {
            const toPos = target.dataset.pos as ConnectionPosition;
            onAddConnection(connectingFrom.blockId, connectingFrom.pos, toEl.id, toPos);
          }
        }
        setIsConnecting(false);
        setConnectingFrom(null);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, selectedBlock, dragOffset, isConnecting, connectingFrom, onUpdateBlock, onAddConnection]);

  const renderConnectionPath = (conn: Connection) => {
    const from = getConnPoint(conn.from, conn.fromPos);
    const to = getConnPoint(conn.to, conn.toPos);
    
    let d: string;
    if (conn.fromPos === 'bottom' || conn.fromPos === 'top') {
      d = `M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2}, ${to.x} ${(from.y + to.y) / 2}, ${to.x} ${to.y}`;
    } else {
      const midX = (from.x + to.x) / 2;
      d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
    }
    
    return d;
  };

  const tempLineFrom = connectingFrom ? getConnPoint(connectingFrom.blockId, connectingFrom.pos) : { x: 0, y: 0 };

  return (
    <div className="canvas-panel">
      <div className="canvas-header">
        <div className="canvas-title">
          🎨 Canvas{' '}
          <span style={{ fontSize: '12px', color: '#636366' }}>({blocks.length})</span>
        </div>
        <div className="canvas-tools">
          <button
            className={`canvas-tool-btn ${currentTool === 'select' ? 'active' : ''}`}
            onClick={() => onSetTool('select')}
            title="Select & Move"
          >
            ↖
          </button>
          <button
            className={`canvas-tool-btn ${currentTool === 'connect' ? 'active' : ''}`}
            onClick={() => onSetTool('connect')}
            title="Connect blocks"
          >
            🔗
          </button>
          <button
            className={`canvas-tool-btn ${currentTool === 'text' ? 'active' : ''}`}
            onClick={() => onSetTool('text')}
            title="Click canvas to add text"
          >
            T
          </button>
          <button
            className="canvas-tool-btn"
            onClick={onClearCanvas}
            title="Clear canvas"
          >
            🗑
          </button>
        </div>
      </div>
      <div
        ref={canvasAreaRef}
        className={`canvas-area ${currentTool === 'select' ? 'select-mode' : ''}`}
        onClick={handleCanvasClick}
      >
        <svg className="connections-svg">
          {connections.map((conn, i) => (
            <path
              key={i}
              className={`connection-line ${conn.color}`}
              d={renderConnectionPath(conn)}
            />
          ))}
          {isConnecting && connectingFrom && (
            <line
              className="temp-connection"
              x1={tempLineFrom.x}
              y1={tempLineFrom.y}
              x2={tempLineEnd.x}
              y2={tempLineEnd.y}
            />
          )}
        </svg>
        <div
          ref={canvasContentRef}
          className="canvas-content"
          style={{ transform: `scale(${zoom})` }}
        >
          {blocks.length === 0 && currentTool === 'text' && !newBlockPos && (
            <div className="click-hint">
              👆 Click anywhere to add a note
              <br />
              <span style={{ fontSize: '12px', opacity: 0.7 }}>or select text from chat</span>
            </div>
          )}
          
          {blocks.map(block => (
            <CanvasBlock
              key={block.id}
              block={block}
              isSelected={selectedBlock === block.id}
              onMouseDown={(e) => handleBlockMouseDown(block.id, e)}
              onDelete={() => onDeleteBlock(block.id)}
              onEdit={(newText) => onUpdateBlock(block.id, { text: newText })}
              onConnectionPointMouseDown={handleConnectionPointMouseDown}
            />
          ))}
          
          {newBlockPos && (
            <NewBlockInput
              x={newBlockPos.x}
              y={newBlockPos.y}
              onCancel={() => setNewBlockPos(null)}
              onCreate={(text, color) => {
                onAddBlock(text, color, newBlockPos.x, newBlockPos.y);
                setNewBlockPos(null);
              }}
            />
          )}
        </div>
      </div>
      <div className="canvas-footer">
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={onZoomOut}>
            −
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={onZoomIn}>
            +
          </button>
        </div>
        <div className="canvas-stats">
          {blocks.length} blocks • {connections.length} connections
        </div>
        <div className="export-btns">
          <button className="export-btn" onClick={onExport}>
            💾 Save
          </button>
        </div>
      </div>
    </div>
  );
}

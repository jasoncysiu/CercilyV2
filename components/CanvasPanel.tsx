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
  onBlockClick?: (blockId: string, chatId?: string, messageId?: string, startOffset?: number, endOffset?: number) => void;
  onToggleCollapse?: (id: string) => void;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  onZoomChange?: (zoom: number) => void;
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
  onBlockClick,
  onToggleCollapse,
  onCollapseAll,
  onExpandAll,
  onZoomChange,
}: CanvasPanelProps) {
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null); // This will now be the transformed wrapper
  const [newBlockPos, setNewBlockPos] = useState<{ x: number; y: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // In Model Coordinates

  
  // Connecting state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<{ blockId: string; pos: ConnectionPosition } | null>(null);
  const [tempLineEnd, setTempLineEnd] = useState({ x: 0, y: 0 });
  const [justCompletedConnection, setJustCompletedConnection] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getConnPoint = useCallback((blockId: string, pos: ConnectionPosition) => {
    const el = document.getElementById(blockId);
    // Use the transformed content wrapper as reference to get model-relative coordinates (scaled)
    const container = canvasContentRef.current; 
    if (!el || !container) return { x: 0, y: 0 };
    
    const rect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    
    // Calculate relative position in screen pixels, then un-scale to get model pixels
    // Note: We don't need to subtract pan here because both rect and cRect include the pan offset.
    // They are both moving together. contentRef is the wrapper.
    const relativeLeft = rect.left - cRect.left;
    const relativeTop = rect.top - cRect.top;
    
    // Model coordinates
    const modelLeft = relativeLeft / zoom;
    const modelTop = relativeTop / zoom;
    const modelWidth = rect.width / zoom;
    const modelHeight = rect.height / zoom;

    let x = 0, y = 0;
    switch (pos) {
      case 'top':
        x = modelLeft + modelWidth / 2;
        y = modelTop;
        break;
      case 'bottom':
        x = modelLeft + modelWidth / 2;
        y = modelTop + modelHeight;
        break;
      case 'left':
        x = modelLeft;
        y = modelTop + modelHeight / 2;
        break;
      case 'right':
        x = modelLeft + modelWidth;
        y = modelTop + modelHeight / 2;
        break;
    }
    return { x, y };
  }, [zoom]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (justCompletedConnection) {
      setJustCompletedConnection(false);
      return;
    }
    if (currentTool !== 'text') return;
    if ((e.target as HTMLElement).closest('.canvas-block')) return;
    if ((e.target as HTMLElement).closest('.new-block-input')) return;

    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Calculate model coordinates from screen click
    // ModelX = (ScreenX - ContainerScreenLeft - PanX) / Zoom
    const x = (e.clientX - rect.left - pan.x) / zoom - 100; // Center roughly
    const y = (e.clientY - rect.top - pan.y) / zoom - 20;

    setNewBlockPos({ x, y });
  };

  const handleBlockMouseDown = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Important to prevent canvas drag
    const el = e.currentTarget as HTMLElement;
    // We need the block's current model position (from props/state)
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    onSelectBlock(blockId);
    setIsDragging(true);

    // Calculate Mouse Position in Model Logic
    const mouseModelX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseModelY = (e.clientY - rect.top - pan.y) / zoom;

    // Drag Offset = MouseModel - BlockModel
    setDragOffset({
      x: mouseModelX - block.x,
      y: mouseModelY - block.y,
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
        
        // Calculate new mouse model position
        const mouseModelX = (e.clientX - cRect.left - pan.x) / zoom;
        const mouseModelY = (e.clientY - cRect.top - pan.y) / zoom;

        // New Block Position = MouseModel - DragOffset
        const newX = mouseModelX - dragOffset.x;
        const newY = mouseModelY - dragOffset.y;
        
        onUpdateBlock(selectedBlock, { x: newX, y: newY });
      }
      
      if (isConnecting) {
        const canvasArea = canvasAreaRef.current; // Outer container
        const canvasContent = canvasContentRef.current; // Inner transformed container
        if (!canvasArea || !canvasContent) return;
        
        // We want temp line end in Model Coordinates.
        // Similar logic to getConnPoint: relative to transformed container
        const cRect = canvasContent.getBoundingClientRect();
        
        const relativeX = e.clientX - cRect.left;
        const relativeY = e.clientY - cRect.top;
        
        setTempLineEnd({
          x: relativeX / zoom,
          y: relativeY / zoom,
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
            setJustCompletedConnection(true);
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
  }, [isDragging, selectedBlock, dragOffset, isConnecting, connectingFrom, onUpdateBlock, onAddConnection, zoom, pan]);

  const handleWheel = (e: React.WheelEvent) => {
    // e.preventDefault(); // Note: Can't prevent default on passive event like this easily in React without refs, but we can try stopping propagation.
    // If the user uses a trackpad, this handles 2-finger pan and pinch-zoom (usually with Ctrl).
    
    if (e.ctrlKey || e.metaKey) {
        // Zoom
        if (onZoomChange) {
            // Calculate new zoom
            const newZoom = Math.min(2, Math.max(0.1, zoom - e.deltaY * 0.005));
            onZoomChange(newZoom);
        }
    } else {
        // Pan
        setPan(p => ({
            x: p.x - e.deltaX,
            y: p.y - e.deltaY
        }));
    }
  };

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

  const visibleBlocks = blocks.filter(b => !b.isHidden);
  const visibleBlockIds = new Set(visibleBlocks.map(b => b.id));
  const visibleConnections = connections.filter(c => visibleBlockIds.has(c.from) && visibleBlockIds.has(c.to));
  
  const areAllCollapsed = visibleBlocks.length > 0 && visibleBlocks.every(b => b.isCollapsed);

  return (
    <div className="canvas-panel">
      <div className="canvas-header">
        <div className="canvas-title">
          🎨 Canvas{' '}
          <span style={{ fontSize: '12px', color: '#636366' }}>({visibleBlocks.length})</span>
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
            className="canvas-tool-btn"
            onClick={() => areAllCollapsed ? onExpandAll?.() : onCollapseAll?.()}
            title={areAllCollapsed ? 'Expand all' : 'Collapse all'}
            style={{ fontSize: '18px' }}
          >
            {areAllCollapsed ? '⊞' : '⊟'}
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
        onWheel={handleWheel}
      >
        <div 
          ref={canvasContentRef}
          className="canvas-transform-layer"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          <svg className="connections-svg" style={{ overflow: 'visible' }}>
            {visibleConnections.map((conn, i) => (
              <path
                key={i}
                className={`connection-line ${conn.color}`}
                d={renderConnectionPath(conn)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {isConnecting && connectingFrom && (
              <line
                className="temp-connection"
                x1={tempLineFrom.x}
                y1={tempLineFrom.y}
                x2={tempLineEnd.x}
                y2={tempLineEnd.y}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          <div className="canvas-content">
            {visibleBlocks.length === 0 && currentTool === 'text' && !newBlockPos && (
              <div 
                className="click-hint" 
                style={{
                    // Counter-scale the hint if we want it to stay readable, or just let it scale. Let's let it scale for now.
                }}
              >
                👆 Click anywhere to add a note
                <br />
                <span style={{ fontSize: '12px', opacity: 0.7 }}>or select text from chat</span>
              </div>
            )}
            
            {visibleBlocks.map(block => (
              <CanvasBlock
                key={block.id}
                block={block}
                isSelected={selectedBlock === block.id}
                onMouseDown={(e) => handleBlockMouseDown(block.id, e)}
                onDelete={() => onDeleteBlock(block.id)}
                onEdit={(newText) => onUpdateBlock(block.id, { text: newText })}
                onConnectionPointMouseDown={handleConnectionPointMouseDown}
                onNavigateSource={() => {
                  if (onBlockClick) {
                    onBlockClick(block.id, block.chatId, block.messageId, block.startOffset, block.endOffset);
                  }
                }}
                onToggle={() => onToggleCollapse ? onToggleCollapse(block.id) : onUpdateBlock(block.id, { isCollapsed: !block.isCollapsed })}
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
          {visibleBlocks.length} blocks • {visibleConnections.length} connections
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

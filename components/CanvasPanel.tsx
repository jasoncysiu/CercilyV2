'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Block, Connection, BlockColor, ToolType, ConnectionPosition } from '@/lib/types';
import CanvasBlock from './CanvasBlock';
import NewBlockInput from './NewBlockInput';
import OutlineView from './OutlineView';
// No lucide-react icons needed for the simplified menu



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
  onDeleteBlocks?: (ids: string[]) => void;
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
  onDeleteConnection?: (fromId: string, toId: string) => void;
  onMergeBlocks?: (sourceId: string, targetId: string) => void;
  onRearrange?: (optimizeConnections?: boolean) => void;
  showOutline?: boolean;

  onToggleOutline?: () => void;
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
  onDeleteBlocks,
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
  onDeleteConnection,
  onMergeBlocks,
  onRearrange,
  showOutline,
  onToggleOutline,
}: CanvasPanelProps) {

  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null); // This will now be the transformed wrapper
  const [newBlockPos, setNewBlockPos] = useState<{ x: number; y: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // In Model Coordinates
  
  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  
  // Connecting state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<{ blockId: string; pos: ConnectionPosition } | null>(null);
  const [tempLineEnd, setTempLineEnd] = useState({ x: 0, y: 0 });
  const [justCompletedConnection, setJustCompletedConnection] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Ref to suppress click after drag/connection
  const skipNextClickRef = useRef(false);
  const [tick, setTick] = useState(0);
  
  // Force a re-render when blocks or zoom change to refresh connection coordinates 
  // (which rely on getBoundingClientRect)
  useEffect(() => {
    // A small delay ensures the DOM has finished its layout update
    const timer = setTimeout(() => {
      setTick(t => t + 1);
    }, 50);
    return () => clearTimeout(timer);
  }, [blocks, zoom]);

  // Drag-to-drop states
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [dropMenu, setDropMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sourceId: string;
    targetId: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    modelX: number;
    modelY: number;
  } | null>(null);

  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });

  const [blockContextMenu, setBlockContextMenu] = useState<{
    x: number;
    y: number;
    blockId: string;
  } | null>(null);

  const dragStartPosRef = useRef({ x: 0, y: 0 });


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
    if (skipNextClickRef.current) {
      skipNextClickRef.current = false;
      return;
    }
    if (justCompletedConnection) {
      setJustCompletedConnection(false);
      return;
    }
    if (currentTool !== 'text') {
      if (currentTool === 'select' && !(e.target as HTMLElement).closest('.canvas-block')) {
        // This was a background click in select mode - handled by mousedown for pan
      }
      return;
    }
    if ((e.target as HTMLElement).closest('.canvas-block')) return;

    if ((e.target as HTMLElement).closest('.new-block-input')) return;

    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Calculate model coordinates from screen click
    // ModelX = (ScreenX - ContainerScreenLeft - PanX) / Zoom
    const modelX = (e.clientX - rect.left - pan.x) / zoom - 100; // Center roughly
    const modelY = (e.clientY - rect.top - pan.y) / zoom - 20;

    // Position of the menu in screen coordinates
    setContextMenu({
      x: e.clientX,
      y: e.clientY - 60, // Position above the click
      modelX,
      modelY
    });
  };


  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (currentTool !== 'select') return;
    if ((e.target as HTMLElement).closest('.canvas-block')) return;
    
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };


  const handleBlockMouseDown = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Important to prevent canvas drag
    const el = e.currentTarget as HTMLElement;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    // IF in Connect mode, clicking anywhere on the card starts a connection
    if (currentTool === 'connect') {
      const bRect = el.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      
      // Find nearest connection point to start the line from
      const points: { pos: ConnectionPosition; x: number; y: number }[] = [
        { pos: 'top', x: bRect.left + bRect.width / 2, y: bRect.top },
        { pos: 'bottom', x: bRect.left + bRect.width / 2, y: bRect.bottom },
        { pos: 'left', x: bRect.left, y: bRect.top + bRect.height / 2 },
        { pos: 'right', x: bRect.right, y: bRect.top + bRect.height / 2 }
      ];
      
      let startPos: ConnectionPosition = 'right';
      let minDist = Infinity;
      points.forEach(p => {
        const dist = Math.pow(p.x - mouseX, 2) + Math.pow(p.y - mouseY, 2);
        if (dist < minDist) {
          minDist = dist;
          startPos = p.pos;
        }
      });

      setIsConnecting(true);
      setConnectingFrom({ blockId, pos: startPos });
      
      const pt = getConnPoint(blockId, startPos);
      setTempLineEnd(pt);
      return;
    }

    onSelectBlock(blockId);
    setIsDragging(true);
    if (contextMenu) setContextMenu(null);
    if (blockContextMenu) setBlockContextMenu(null);

    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

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

  const handleResizeMouseDown = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    setIsResizing(true);
    setResizingBlockId(blockId);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setResizeStartSize({ 
      width: block.width || 260, 
      height: block.height || (document.getElementById(blockId)?.offsetHeight || 100) / zoom 
    });
  };

  const renderConnectionPath = useCallback((conn: { from: string; fromPos: ConnectionPosition; to: string; toPos: ConnectionPosition; color: BlockColor }) => {
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
  }, [getConnPoint]);

  // Use refs for values needed in event listeners to avoid frequent re-binding
  const dragInfoRef = useRef({
    isDragging: false,
    selectedBlock: null as string | null,
    dragOffset: { x: 0, y: 0 },
    isConnecting: false,
    connectingFrom: null as { blockId: string; pos: ConnectionPosition } | null,
    hoveredBlockId: null as string | null,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    isResizing: false,
    resizingBlockId: null as string | null,
    resizeStartPos: { x: 0, y: 0 },
    resizeStartSize: { width: 0, height: 0 }
  });

  // Keep refs in sync with state for any values needed inside listeners
  useEffect(() => {
    dragInfoRef.current = {
      isDragging,
      selectedBlock,
      dragOffset,
      isConnecting,
      connectingFrom,
      hoveredBlockId,
      isPanning,
      panStart,
      isResizing,
      resizingBlockId,
      resizeStartPos,
      resizeStartSize
    };
  }, [isDragging, selectedBlock, dragOffset, isConnecting, connectingFrom, hoveredBlockId, isPanning, panStart, isResizing, resizingBlockId, resizeStartPos, resizeStartSize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { isDragging, selectedBlock, dragOffset, isConnecting, connectingFrom, isPanning, panStart, isResizing, resizingBlockId, resizeStartPos, resizeStartSize } = dragInfoRef.current;
      
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        });
        return;
      }

      if (isDragging && selectedBlock) {
        const canvasArea = canvasAreaRef.current;
        if (!canvasArea) return;
        
        const cRect = canvasArea.getBoundingClientRect();
        const mouseModelX = (e.clientX - cRect.left - pan.x) / zoom;
        const mouseModelY = (e.clientY - cRect.top - pan.y) / zoom;

        const newX = mouseModelX - dragOffset.x;
        const newY = mouseModelY - dragOffset.y;
        
        onUpdateBlock(selectedBlock, { x: newX, y: newY });

        // Collision detection
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        let foundHover: string | null = null;
        const blockEls = document.querySelectorAll('.canvas-block');
        blockEls.forEach(el => {
            if (el.id === selectedBlock) return;
            const rect = el.getBoundingClientRect();
            if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
                foundHover = el.id;
            }
        });
        setHoveredBlockId(foundHover);
      }
      
      if (isConnecting && connectingFrom) {
        const canvasContent = canvasContentRef.current;
        if (!canvasContent) return;
        
        const cRect = canvasContent.getBoundingClientRect();
        const relativeX = e.clientX - cRect.left;
        const relativeY = e.clientY - cRect.top;
        
        setTempLineEnd({
          x: relativeX / zoom,
          y: relativeY / zoom,
        });
        return;
      }

      if (isResizing && resizingBlockId) {
        const deltaX = (e.clientX - resizeStartPos.x) / zoom;
        const deltaY = (e.clientY - resizeStartPos.y) / zoom;

        onUpdateBlock(resizingBlockId, {
          width: Math.max(120, resizeStartSize.width + deltaX),
          height: Math.max(40, resizeStartSize.height + deltaY)
        });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const { isDragging, selectedBlock, isConnecting, connectingFrom, hoveredBlockId, isPanning } = dragInfoRef.current;

      if (isPanning) {
        setIsPanning(false);
        return;
      }

      if (isDragging) {
        setIsDragging(false);
        skipNextClickRef.current = true;
        
        const dist = Math.sqrt(Math.pow(e.clientX - dragStartPosRef.current.x, 2) + Math.pow(e.clientY - dragStartPosRef.current.y, 2));
        if (dist < 5 && selectedBlock) {
          // Detected a click on the block - show the bar
          setBlockContextMenu({
            x: e.clientX,
            y: e.clientY - 60,
            blockId: selectedBlock
          });
        }
        
        if (hoveredBlockId && selectedBlock && hoveredBlockId !== selectedBlock) {
          setDropMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            sourceId: selectedBlock,
            targetId: hoveredBlockId
          });
        }
        setHoveredBlockId(null);
      }
      
      if (isConnecting && connectingFrom) {
        // More robust way to find what's under the mouse on release
        const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        const toEl = elementUnderMouse?.closest('.canvas-block') as HTMLElement;
        
        if (toEl && toEl.id !== connectingFrom.blockId) {
            let toPos: ConnectionPosition | null = null;
            
            // If we dropped specifically on a connection point
            if (elementUnderMouse?.classList.contains('connection-point')) {
                toPos = (elementUnderMouse as HTMLElement).dataset.pos as ConnectionPosition;
            } else {
                // If we dropped on the card body, find the nearest edge
                const rect = toEl.getBoundingClientRect();
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                const points: { pos: ConnectionPosition; x: number; y: number }[] = [
                    { pos: 'top', x: rect.left + rect.width / 2, y: rect.top },
                    { pos: 'bottom', x: rect.left + rect.width / 2, y: rect.bottom },
                    { pos: 'left', x: rect.left, y: rect.top + rect.height / 2 },
                    { pos: 'right', x: rect.right, y: rect.top + rect.height / 2 }
                ];
                let minDist = Infinity;
                points.forEach(p => {
                    const dist = Math.pow(p.x - mouseX, 2) + Math.pow(p.y - mouseY, 2);
                    if (dist < minDist) {
                        minDist = dist;
                        toPos = p.pos;
                    }
                });
            }

            if (toPos) {
                onAddConnection(connectingFrom.blockId, connectingFrom.pos, toEl.id, toPos);
                setJustCompletedConnection(true);
            }
        }
        setIsConnecting(false);
        setConnectingFrom(null);
        skipNextClickRef.current = true;
      }

      if (isResizing) {
        setIsResizing(false);
        setResizingBlockId(null);
        skipNextClickRef.current = true;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onUpdateBlock, onAddConnection, zoom, pan]);


  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        if (onZoomChange) {
            const newZoom = Math.min(2, Math.max(0.1, zoom - e.deltaY * 0.005));
            onZoomChange(newZoom);
        }
    } else {
        setPan(p => ({
            x: p.x - e.deltaX,
            y: p.y - e.deltaY
        }));
    }
  };

  const tempLineFrom = connectingFrom ? getConnPoint(connectingFrom.blockId, connectingFrom.pos) : { x: 0, y: 0 };
  const visibleBlocks = blocks.filter(b => !b.isHidden);
  const visibleBlockIds = new Set(visibleBlocks.map(b => b.id));
  const visibleConnections = connections.filter(c => visibleBlockIds.has(c.from) && visibleBlockIds.has(c.to));
  const areAllCollapsed = visibleBlocks.length > 0 && visibleBlocks.every(b => b.isCollapsed);

  return (
    <div className="canvas-panel">
      <div className="canvas-header">
        <div className="canvas-title">Canva <span style={{ fontSize: '12px', color: '#636366' }}>({visibleBlocks.length})</span></div>
        <div className="canvas-tools">
          <button className={`canvas-tool-btn ${currentTool === 'text' ? 'active' : ''}`} onClick={() => onSetTool('text')} title="Text Tool (Click to add cards)">T</button>
          <button className={`canvas-tool-btn ${currentTool === 'select' ? 'active' : ''}`} onClick={() => onSetTool(currentTool === 'select' ? 'text' : 'select')} title="Select & Move">↖</button>
          <button className={`canvas-tool-btn ${currentTool === 'connect' ? 'active' : ''}`} onClick={() => onSetTool(currentTool === 'connect' ? 'text' : 'connect')} title="Connect blocks">🔗</button>
          <button className="canvas-tool-btn" onClick={() => { if (areAllCollapsed) onExpandAll?.(); else onCollapseAll?.(); onSetTool('select'); }} title={areAllCollapsed ? 'Expand all' : 'Collapse all'} style={{ fontSize: '18px' }}>{areAllCollapsed ? '⊞' : '⊟'}</button>
          <button 
            className="canvas-tool-btn" 
            onClick={() => onRearrange?.(false)} 
            onDoubleClick={() => onRearrange?.(true)}
            title="Single click: Tidy | Double click: Tidy + Auto-flip dots" 
            style={{ fontSize: '18px' }}
          >🪄</button>
          <button className={`canvas-tool-btn ${showOutline ? 'active' : ''}`} onClick={onToggleOutline} title="Show Outline" style={{ fontSize: '18px' }}>📋</button>

          <button className="canvas-tool-btn" onClick={onClearCanvas} title="Clear canvas">🗑</button>
        </div>
      </div>

      <div ref={canvasAreaRef} className={`canvas-area ${currentTool === 'select' ? 'select-mode' : ''}`} 
        onClick={(e) => {
          if (contextMenu) setContextMenu(null);
          handleCanvasClick(e);
        }} 
        onWheel={handleWheel} 
        onMouseDown={(e) => {
          if (contextMenu) setContextMenu(null);
          handleCanvasMouseDown(e);
        }}>

        <div ref={canvasContentRef} className="canvas-transform-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>

          <svg className="connections-svg" style={{ overflow: 'visible' }}>
            {visibleConnections.map((conn, i) => (
              <path key={i} className={`connection-line ${conn.color}`} d={renderConnectionPath(conn)} vectorEffect="non-scaling-stroke" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this connection?')) onDeleteConnection?.(conn.from, conn.to); }} style={{ cursor: 'pointer', pointerEvents: 'auto' }} />
            ))}
            {isConnecting && connectingFrom && (
              <line className="temp-connection" x1={tempLineFrom.x} y1={tempLineFrom.y} x2={tempLineEnd.x} y2={tempLineEnd.y} vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          <div className="canvas-content">
            {visibleBlocks.length === 0 && currentTool === 'text' && !newBlockPos && (
              <div className="click-hint">👆 Click anywhere to add a note<br /><span style={{ fontSize: '12px', opacity: 0.7 }}>or select text from chat</span></div>
            )}
            {visibleBlocks.map(block => (
              <CanvasBlock key={block.id} block={block} isSelected={selectedBlock === block.id} isDragging={isDragging && selectedBlock === block.id} onMouseDown={(e) => handleBlockMouseDown(block.id, e)} onDelete={() => onDeleteBlock(block.id)} onEdit={(newText) => onUpdateBlock(block.id, { text: newText })} onConnectionPointMouseDown={handleConnectionPointMouseDown} onNavigateSource={() => onBlockClick?.(block.id, block.chatId, block.messageId, block.startOffset, block.endOffset)} onToggle={() => { if (onToggleCollapse) onToggleCollapse(block.id); else onUpdateBlock(block.id, { isCollapsed: !block.isCollapsed }); onSetTool('select'); }} isDropTarget={hoveredBlockId === block.id} onResizeMouseDown={handleResizeMouseDown} />
            ))}
            {(isDragging && hoveredBlockId && selectedBlock) && (
                <svg className="connections-svg" style={{ overflow: 'visible', pointerEvents: 'none', opacity: 0.6 }}>
                    <path className="connection-line blue" d={renderConnectionPath({ from: hoveredBlockId, fromPos: 'bottom', to: selectedBlock, toPos: 'top', color: 'blue' })} strokeDasharray="5,5" vectorEffect="non-scaling-stroke" />
                </svg>
            )}
            {dropMenu && (
              <div className="drop-action-menu" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: dropMenu.x, top: dropMenu.y, zIndex: 2000 }}>
                <div className="drop-menu-title">Create relationship?</div>
                <div className="drop-menu-options">
                  <button className="drop-menu-btn link" onClick={(e) => { e.stopPropagation(); onAddConnection(dropMenu.targetId, 'bottom', dropMenu.sourceId, 'top'); setDropMenu(null); setJustCompletedConnection(true); }}>
                    <span className="icon">🔗</span>
                    <div className="label"><strong>Link as Child</strong><span>Establish a hierarchy connection</span></div>
                  </button>
                  <button className="drop-menu-btn cancel" onClick={(e) => { e.stopPropagation(); setDropMenu(null); }}>Cancel</button>
                </div>
              </div>
            )}
            {newBlockPos && <NewBlockInput x={newBlockPos.x} y={newBlockPos.y} onCancel={() => setNewBlockPos(null)} onCreate={(text, color) => { onAddBlock(text, color, newBlockPos.x, newBlockPos.y); setNewBlockPos(null); }} />}
          </div>
        </div>

        {contextMenu && (
          <div 
            className="canva-context-menu" 
            style={{ 
              left: contextMenu.x, 
              top: contextMenu.y, 
              position: 'fixed', 
              transform: 'translateX(-50%)' 
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="context-menu-btn" onClick={() => {
              setNewBlockPos({ x: contextMenu.modelX, y: contextMenu.modelY });
              setContextMenu(null);
            }}>
              New Card
            </button>
            <div className="context-menu-divider" />
            <button className="context-menu-btn" onClick={() => {
              onRearrange?.(false);
              setContextMenu(null);
            }}>
              Rearrange
            </button>
          </div>

        )}

        {blockContextMenu && (
          <div 
            className="canva-context-menu" 
            style={{ 
              left: blockContextMenu.x, 
              top: blockContextMenu.y, 
              position: 'fixed', 
              transform: 'translateX(-50%)' 
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="context-menu-btn" onClick={() => {
              const block = blocks.find(b => b.id === blockContextMenu.blockId);
              if (block) {
                if (onToggleCollapse) onToggleCollapse(block.id);
                else onUpdateBlock(block.id, { isCollapsed: !block.isCollapsed });
              }
              setBlockContextMenu(null);
            }}>
              {blocks.find(b => b.id === blockContextMenu.blockId)?.isCollapsed ? 'Expand' : 'Collapse'}
            </button>
            <div className="context-menu-divider" />
            <button className="context-menu-btn" onClick={() => {
              // Transition to connect tool starting from this block
              onSetTool('connect');
              // We'd ideally start the connection immediately, but for now we'll switch tools
              setBlockContextMenu(null);
            }}>
              Link
            </button>
            <div className="context-menu-divider" />
            <button className="context-menu-btn" onClick={() => {
              const block = blocks.find(b => b.id === blockContextMenu.blockId);
              if (block) {
                const newText = prompt('Edit:', block.text);
                if (newText) onUpdateBlock(block.id, { text: newText });
              }
              setBlockContextMenu(null);
            }}>
              Edit
            </button>
            <div className="context-menu-divider" />
            <button className="context-menu-btn delete" onClick={() => {
              onDeleteBlock(blockContextMenu.blockId);
              setBlockContextMenu(null);
            }} style={{ color: '#ff453a' }}>
              Delete
            </button>
          </div>
        )}
      </div>


      <div className="canvas-footer">
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={onZoomOut}>−</button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={onZoomIn}>+</button>
        </div>
        <div className="canvas-stats">{visibleBlocks.length} blocks • {visibleConnections.length} connections</div>
        <div className="export-btns"><button className="export-btn" onClick={onExport}>💾 Save</button></div>
      </div>
      {showOutline && (
        <OutlineView 
          blocks={blocks} 
          connections={connections} 
          onSelectBlock={(id) => {
            onSelectBlock(id);
            // Optional: Center on block
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          }} 
          onDeleteBlocks={(ids) => {
            if (onDeleteBlocks) onDeleteBlocks(ids);
            else ids.forEach(id => onDeleteBlock(id));
          }}
          onClose={() => onToggleOutline?.()} 
        />

      )}
    </div>

  );
}

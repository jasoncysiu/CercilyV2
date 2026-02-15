'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { register } from '@antv/x6-react-shape';
import { getProvider } from '@antv/x6-react-shape';
import { Node } from '@antv/x6';
import { Block, Connection, BlockColor, ToolType, ConnectionPosition } from '@/lib/types';
import X6CanvasBlock from './X6CanvasBlock';
import OutlineView from './OutlineView';
import { useX6Graph } from '@/hooks/useX6Graph';
import {
  Maximize2,
  Minimize2,
  LayoutList,
  Trash2,
  Minus,
  Plus,
  Save,
  Lightbulb,
  Undo2,
  Redo2,
  Rows3,
  Columns3,
  GitBranchPlus,
  AlignLeft,
  Waypoints,
  Pencil,
  X,
  ChevronsUpDown,
  Target,
  MessageSquare,
  Scan,
} from 'lucide-react';

// Register the React shape for our blocks
let shapeRegistered = false;
function ensureShapeRegistered() {
  if (shapeRegistered) return;
  const hiddenPort = { circle: { r: 0, magnet: false, stroke: 'none', fill: 'none' } };
  register({
    shape: 'cercily-block',
    component: X6CanvasBlock,
    effect: ['data'],
    width: 260,
    height: 100,
    ports: {
      groups: {
        top: { position: 'top', attrs: hiddenPort },
        bottom: { position: 'bottom', attrs: hiddenPort },
        left: { position: 'left', attrs: hiddenPort },
        right: { position: 'right', attrs: hiddenPort },
      },
      items: [
        { id: 'top', group: 'top' },
        { id: 'bottom', group: 'bottom' },
        { id: 'left', group: 'left' },
        { id: 'right', group: 'right' },
      ],
    },
  });
  shapeRegistered = true;
}

// Get the Portal provider for React shapes
const Portal = getProvider();

interface CanvasPanelProps {
  blocks: Block[];
  connections: Connection[];
  selectedBlock: string | null;
  currentTool: ToolType;
  zoom: number;
  onSetTool: (tool: ToolType) => void;
  onAddBlock: (text: string, color: BlockColor, x?: number, y?: number, isEditing?: boolean) => void;
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
  onRearrange?: (direction?: 'horizontal' | 'vertical') => void;
  showOutline?: boolean;
  onToggleOutline?: () => void;
  onSynthesizeDecision?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onPushSnapshot?: () => void;
  onAddBranch?: (parentId: string) => void;
}

export default function X6CanvasPanel({
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
  onSynthesizeDecision,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onPushSnapshot,
  onAddBranch,
}: CanvasPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    modelX: number;
    modelY: number;
  } | null>(null);

  const [blockContextMenu, setBlockContextMenu] = useState<{
    x: number;
    y: number;
    blockId: string;
  } | null>(null);

  // Floating toolbar drag state
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [toolbarDragging, setToolbarDragging] = useState(false);
  const toolbarDragStart = useRef({ x: 0, y: 0 });
  const toolbarInitialPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!toolbarDragging) return;
    const onMove = (e: MouseEvent) => {
      setToolbarPos({
        x: toolbarInitialPos.current.x + (e.clientX - toolbarDragStart.current.x),
        y: toolbarInitialPos.current.y + (e.clientY - toolbarDragStart.current.y),
      });
    };
    const onUp = () => setToolbarDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [toolbarDragging]);

  const handleToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    // Only initiate drag from the toolbar background, not from buttons
    if ((e.target as HTMLElement).closest('button')) return;
    setToolbarDragging(true);
    toolbarDragStart.current = { x: e.clientX, y: e.clientY };
    toolbarInitialPos.current = { x: toolbarPos.x, y: toolbarPos.y };
  }, [toolbarPos]);

  // Ensure the shape is registered before graph init
  useEffect(() => {
    ensureShapeRegistered();
    setMounted(true);
  }, []);

  const { getGraph, screenToGraphPosition, zoomIn: graphZoomIn, zoomOut: graphZoomOut, fitToScreen } = useX6Graph({
    containerRef,
    mounted,
    blocks,
    connections,
    currentTool,
    zoom,
    onUpdateBlock,
    onDeleteBlock,
    onDeleteBlocks,
    onSelectBlock,
    onAddConnection,
    onDeleteConnection,
    onBlockClick,
    onZoomChange,
    onPushSnapshot,
    onUndo,
    onRedo,
    onAddBlock,
    onMergeBlocks,
  });

  // Listen for custom events from X6CanvasBlock
  useEffect(() => {
    const handleBlockEdit = (e: Event) => {
      const { blockId, text } = (e as CustomEvent).detail;
      onPushSnapshot?.();
      if (text.trim() === '') {
        onDeleteBlock(blockId);
      } else {
        onUpdateBlock(blockId, { text, isEditing: false });
      }
    };

    const handleBlockNavigate = (e: Event) => {
      const { blockId, chatId, messageId, startOffset, endOffset } = (e as CustomEvent).detail;
      onBlockClick?.(blockId, chatId, messageId, startOffset, endOffset);
    };

    const handleToggleConnected = (e: Event) => {
      const { blockId, pos } = (e as CustomEvent).detail;
      // Get all descendants from this position and toggle their visibility
      const allDescendants = getAllDescendants(blockId, pos);
      if (allDescendants.length === 0) return;

      const areAllHidden = allDescendants.every(id => {
        const block = blocks.find(b => b.id === id);
        return block?.isHidden;
      });

      allDescendants.forEach(id => {
        onUpdateBlock(id, { isHidden: !areAllHidden });
      });
    };

    const handleToggleCollapse = (e: Event) => {
      const { blockId } = (e as CustomEvent).detail;
      onToggleCollapse?.(blockId);
    };

    const handleAddBranch = (e: Event) => {
      const { parentId } = (e as CustomEvent).detail;
      onAddBranch?.(parentId);
    };

    window.addEventListener('x6-block-edit', handleBlockEdit);
    window.addEventListener('x6-block-navigate', handleBlockNavigate);
    window.addEventListener('x6-toggle-connected', handleToggleConnected);
    window.addEventListener('x6-toggle-collapse', handleToggleCollapse);
    window.addEventListener('x6-add-branch', handleAddBranch);

    return () => {
      window.removeEventListener('x6-block-edit', handleBlockEdit);
      window.removeEventListener('x6-block-navigate', handleBlockNavigate);
      window.removeEventListener('x6-toggle-connected', handleToggleConnected);
      window.removeEventListener('x6-toggle-collapse', handleToggleCollapse);
      window.removeEventListener('x6-add-branch', handleAddBranch);
    };
  }, [blocks, connections, onUpdateBlock, onDeleteBlock, onBlockClick, onPushSnapshot, onToggleCollapse, onAddBranch]);

  // Get all descendants of a block from a specific connection position
  const getAllDescendants = useCallback((startBlockId: string, startPos: ConnectionPosition): string[] => {
    const descendants: string[] = [];
    const visited = new Set<string>();

    // Find immediate children from the starting position
    const immediateChildren: string[] = [];
    connections.forEach(conn => {
      if (conn.from === startBlockId && conn.fromPos === startPos) {
        immediateChildren.push(conn.to);
      }
    });

    const queue = [...immediateChildren];
    immediateChildren.forEach(id => visited.add(id));

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      descendants.push(currentId);

      connections.forEach(conn => {
        if (conn.from === currentId && !visited.has(conn.to)) {
          visited.add(conn.to);
          queue.push(conn.to);
        }
      });
    }

    return descendants;
  }, [connections]);

  // Ref to track if X6 already handled this click (prevent double-handling)
  const x6HandledClickRef = useRef(false);

  // Handle graph container clicks for context menu
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // If X6 already handled this click event, skip
    if (x6HandledClickRef.current) {
      x6HandledClickRef.current = false;
      return;
    }
    // Dismiss menus on any click
    if (contextMenu) setContextMenu(null);
    if (blockContextMenu) setBlockContextMenu(null);
  }, [contextMenu, blockContextMenu]);

  const handleContainerContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    const graph = getGraph();
    if (!graph) return;

    // Check if right-clicked on a node by walking up to find foreignObject → g[data-cell-id]
    const target = e.target as HTMLElement;
    // Try HTML data-cell-id first (won't cross SVG boundary from inside foreignObject)
    let cellId: string | null = null;
    const nodeEl = target.closest('[data-cell-id]');
    if (nodeEl) {
      cellId = nodeEl.getAttribute('data-cell-id');
    }

    // If not found, check if we're inside a foreignObject (React node inside X6)
    if (!cellId) {
      let el: Element | null = target;
      while (el && el !== document.documentElement) {
        if (el.tagName === 'foreignObject') {
          // Found the foreignObject — get the parent g[data-cell-id]
          const gEl = el.closest('g[data-cell-id]') || el.parentElement?.closest('g[data-cell-id]');
          if (gEl) {
            cellId = gEl.getAttribute('data-cell-id');
          }
          break;
        }
        el = el.parentElement;
      }
    }

    if (cellId) {
      setBlockContextMenu({
        x: e.clientX,
        y: e.clientY,
        blockId: cellId,
      });
      return;
    }

    // Right-clicked on empty canvas — always show context menu
    const pos = screenToGraphPosition(e.clientX, e.clientY);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      modelX: pos.x - 130, // Center the block
      modelY: pos.y - 20,
    });
  }, [getGraph, screenToGraphPosition]);

  // Handle double-click on empty canvas to create new block (works in any mode)
  const handleContainerDoubleClick = useCallback((e: React.MouseEvent) => {
    // Don't create blocks when double-clicking on existing nodes
    const target = e.target as HTMLElement;
    if (target.closest('[data-cell-id]')) return;

    const pos = screenToGraphPosition(e.clientX, e.clientY);
    onAddBlock('', 'blue', pos.x - 130, pos.y - 20, true);
  }, [screenToGraphPosition, onAddBlock]);

  // Handle edge clicks for deletion
  useEffect(() => {
    const graph = getGraph();
    if (!graph) return;

    const handleEdgeClick = ({ edge, e }: any) => {
      x6HandledClickRef.current = true;
      setBlockContextMenu(null);
      setContextMenu(null);
      // Select the edge so Delete/Backspace can remove it
      graph.cleanSelection();
      graph.select(edge);
    };

    const handleEdgeContextMenu = ({ edge, e }: any) => {
      e.stopPropagation();
      if (onDeleteConnection) {
        const source = edge.getSource();
        const target = edge.getTarget();
        if (source?.cell && target?.cell) {
          if (confirm('Delete this connection?')) {
            onDeleteConnection(source.cell, target.cell);
          }
        }
      }
    };

    const handleNodeClick = ({ node, e }: any) => {
      x6HandledClickRef.current = true;
      setContextMenu(null);
      setBlockContextMenu(null);
      onSelectBlock(node.id);
      graph.select(node);

      // Navigate to source text in chat if this block was created from a highlight
      const data = node.getData() as { block?: { id: string; chatId?: string; messageId?: string; startOffset?: number; endOffset?: number } };
      const block = data?.block;
      if (block?.messageId && onBlockClick) {
        onBlockClick(block.id, block.chatId, block.messageId, block.startOffset, block.endOffset);
      }
    };

    const handleNodeDblClick = ({ node, e }: any) => {
      x6HandledClickRef.current = true;
      setContextMenu(null);
      setBlockContextMenu(null);
      // Double-click a node to start editing its text
      onUpdateBlock(node.id, { isEditing: true });
    };

    const handleBlankClick = ({ e }: any) => {
      x6HandledClickRef.current = true;
      setBlockContextMenu(null);
      setContextMenu(null);
      onSelectBlock(null);
    };

    // Handle right-click on nodes via X6's own event system
    // This is more reliable than DOM traversal because X6 handles
    // foreignObject event routing internally
    const handleNodeContextMenu = ({ node, e: evt }: any) => {
      // X6 wraps events — extract the native mouse event
      const nativeEvt = evt?.originalEvent ?? evt;
      if (nativeEvt?.preventDefault) nativeEvt.preventDefault();
      if (nativeEvt?.stopPropagation) nativeEvt.stopPropagation();
      x6HandledClickRef.current = true;
      setContextMenu(null);

      const clientX = nativeEvt?.clientX ?? evt?.clientX ?? 0;
      const clientY = nativeEvt?.clientY ?? evt?.clientY ?? 0;

      setBlockContextMenu({
        x: clientX,
        y: clientY,
        blockId: node.id,
      });
    };

    graph.on('edge:click', handleEdgeClick);
    graph.on('edge:contextmenu', handleEdgeContextMenu);
    graph.on('node:click', handleNodeClick);
    graph.on('node:dblclick', handleNodeDblClick);
    graph.on('node:contextmenu', handleNodeContextMenu);
    graph.on('blank:click', handleBlankClick);

    return () => {
      graph.off('edge:click', handleEdgeClick);
      graph.off('edge:contextmenu', handleEdgeContextMenu);
      graph.off('node:click', handleNodeClick);
      graph.off('node:dblclick', handleNodeDblClick);
      graph.off('node:contextmenu', handleNodeContextMenu);
      graph.off('blank:click', handleBlankClick);
    };
  }, [getGraph, onDeleteConnection, onSelectBlock, onUpdateBlock, currentTool, screenToGraphPosition, contextMenu, blockContextMenu]);

  // --- Custom minimap ---
  const minimapRafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    const graph = getGraph();
    if (!canvas || !graph) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const colorMap: Record<string, string> = {
      orange: '#FF7F0F', cyan: '#00BFBF', pink: '#FF4081',
      purple: '#CE5BFF', green: '#32CD35', gold: '#FFBF00',
      blue: '#03A9F4', teal: '#00B7A5',
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      const nodes = graph.getNodes();
      if (nodes.length === 0) {
        minimapRafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Compute bounding box of all nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of nodes) {
        const pos = node.getPosition();
        const size = node.getSize();
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + size.width);
        maxY = Math.max(maxY, pos.y + size.height);
      }

      // Add padding
      const pad = 100;
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;
      const worldW = maxX - minX;
      const worldH = maxY - minY;
      const scale = Math.min(W / worldW, H / worldH);
      const offX = (W - worldW * scale) / 2;
      const offY = (H - worldH * scale) / 2;

      // Draw nodes
      for (const node of nodes) {
        const pos = node.getPosition();
        const size = node.getSize();
        const data = node.getData() as { block?: { color?: string } } | undefined;
        const color = colorMap[data?.block?.color || ''] || '#64748b';

        const x = (pos.x - minX) * scale + offX;
        const y = (pos.y - minY) * scale + offY;
        const w = size.width * scale;
        const h = size.height * scale;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(w, 2), Math.max(h, 2), 2);
        ctx.fill();
      }

      // Draw edges
      const edges = graph.getEdges();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const src = edge.getSourceCell();
        const tgt = edge.getTargetCell();
        if (src && tgt && src.isNode() && tgt.isNode()) {
          const sp = (src as Node).getPosition();
          const ss = (src as Node).getSize();
          const tp = (tgt as Node).getPosition();
          const ts = (tgt as Node).getSize();
          const x1 = (sp.x + ss.width / 2 - minX) * scale + offX;
          const y1 = (sp.y + ss.height / 2 - minY) * scale + offY;
          const x2 = (tp.x + ts.width / 2 - minX) * scale + offX;
          const y2 = (tp.y + ts.height / 2 - minY) * scale + offY;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // Draw viewport rectangle
      const graphArea = graph.getGraphArea();
      const gScale = graph.zoom();
      const scrollX = graphArea.x;
      const scrollY = graphArea.y;
      const containerEl = containerRef.current;
      if (containerEl) {
        const vw = containerEl.clientWidth / gScale;
        const vh = containerEl.clientHeight / gScale;
        const vx = (scrollX - minX) * scale + offX;
        const vy = (scrollY - minY) * scale + offY;
        const vWidth = vw * scale;
        const vHeight = vh * scale;

        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.strokeRect(vx, vy, vWidth, vHeight);
        ctx.fillStyle = '#8b5cf6';
        ctx.globalAlpha = 0.08;
        ctx.fillRect(vx, vy, vWidth, vHeight);
      }

      ctx.globalAlpha = 1;
      minimapRafRef.current = requestAnimationFrame(draw);
    };

    minimapRafRef.current = requestAnimationFrame(draw);

    // Click/drag on minimap to navigate
    let isDragging = false;

    const navigate = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const nodes = graph.getNodes();
      if (nodes.length === 0) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of nodes) {
        const pos = node.getPosition();
        const size = node.getSize();
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + size.width);
        maxY = Math.max(maxY, pos.y + size.height);
      }
      const pad = 100;
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;
      const worldW = maxX - minX;
      const worldH = maxY - minY;
      const scl = Math.min(W / worldW, H / worldH);
      const oX = (W - worldW * scl) / 2;
      const oY = (H - worldH * scl) / 2;

      // Convert minimap coords to graph coords
      const graphX = (mx - oX) / scl + minX;
      const graphY = (my - oY) / scl + minY;

      graph.centerPoint(graphX, graphY);
    };

    const onDown = (e: MouseEvent) => { isDragging = true; navigate(e); };
    const onMove = (e: MouseEvent) => { if (isDragging) navigate(e); };
    const onUp = () => { isDragging = false; };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      cancelAnimationFrame(minimapRafRef.current);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [getGraph, blocks, connections, zoom]);

  const visibleBlocks = blocks.filter(b => !b.isHidden);
  const visibleBlockIds = new Set(visibleBlocks.map(b => b.id));
  const visibleConnections = connections.filter(c => visibleBlockIds.has(c.from) && visibleBlockIds.has(c.to));
  const areAllCollapsed = visibleBlocks.length > 0 && visibleBlocks.every(b => b.isCollapsed);

  return (
    <div className="canvas-panel">
      <Portal />

      {/* Floating canvas tools — bottom center, draggable */}
      <div
        className={`canvas-floating-tools ${toolbarDragging ? 'dragging' : ''}`}
        style={{
          transform: `translate(calc(-50% + ${toolbarPos.x}px), ${toolbarPos.y}px)`,
          transition: toolbarDragging ? 'none' : 'transform 0.1s ease-out',
          cursor: toolbarDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleToolbarMouseDown}>
        <button
          className="canvas-tool-btn"
          onClick={() => {
            if (areAllCollapsed) onExpandAll?.();
            else onCollapseAll?.();
          }}
          title={areAllCollapsed ? 'Expand all' : 'Collapse all'}
        >
          {areAllCollapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        </button>
        <button className="canvas-tool-btn" onClick={() => onRearrange?.('horizontal')} title="Horizontal layout">
          <Columns3 size={16} />
        </button>
        <button className="canvas-tool-btn" onClick={() => onRearrange?.('vertical')} title="Vertical layout">
          <Rows3 size={16} />
        </button>
        <button
          className="canvas-tool-btn synthesize-btn"
          onClick={onSynthesizeDecision}
          disabled={visibleBlocks.length < 3}
          title={visibleBlocks.length < 3 ? 'Add at least 3 blocks to synthesize' : 'Synthesize Decision'}
          style={{ opacity: visibleBlocks.length < 3 ? 0.4 : 1, cursor: visibleBlocks.length < 3 ? 'not-allowed' : 'pointer' }}
        >
          <Lightbulb size={16} />
        </button>
        <button className={`canvas-tool-btn ${showOutline ? 'active' : ''}`} onClick={onToggleOutline} title="Outline">
          <LayoutList size={16} />
        </button>
        <button className="canvas-tool-btn" onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo2 size={16} />
        </button>
        <button className="canvas-tool-btn" onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo2 size={16} />
        </button>
        <button className="canvas-tool-btn" onClick={fitToScreen} title="Fit to Screen (F)">
          <Scan size={16} />
        </button>
        <button className="canvas-tool-btn" onClick={onClearCanvas} title="Clear canvas">
          <Trash2 size={16} />
        </button>
        <div className="canvas-tool-divider" />
        <button className="canvas-tool-btn" onClick={onExport} title="Save">
          <Save size={16} />
        </button>
      </div>

      <div
        className="canvas-area x6-canvas-area"
        onClick={handleContainerClick}
        onContextMenu={handleContainerContextMenu}
        onDoubleClick={handleContainerDoubleClick}
      >
        <div ref={containerRef} className="x6-graph-container" />
        <canvas ref={minimapCanvasRef} className="x6-minimap" width={180} height={120} />

        {/* Empty state hint */}
        {visibleBlocks.length === 0 && (
          <div className="click-hint" style={{ pointerEvents: 'none' }}>
            Double-click to add a note
            <br />
            <span style={{ fontSize: '12px', opacity: 0.7 }}>or select text from chat</span>
          </div>
        )}
      </div>

      {/* Canvas context menu */}
      {contextMenu && (
        <div
          className="canva-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            position: 'fixed',
            transform: 'translateX(-50%)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-btn"
            onClick={() => {
              onAddBlock('', 'blue', contextMenu.modelX, contextMenu.modelY, true);
              setContextMenu(null);
            }}
          >
            New Card
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-menu-btn"
            onClick={() => {
              onRearrange?.('horizontal');
              setContextMenu(null);
            }}
          >
            Rearrange
          </button>
        </div>
      )}

      {/* Block context menu — vertical MMW style */}
      {blockContextMenu && (() => {
        const ctxBlock = blocks.find(b => b.id === blockContextMenu.blockId);
        const blockHasChildren = connections.some(c => c.from === blockContextMenu.blockId);
        const colorOptions: BlockColor[] = ['orange', 'cyan', 'pink', 'purple', 'green', 'gold', 'blue', 'teal'];

        // Keep menu within viewport bounds
        const menuW = 200;
        const menuH = blockHasChildren ? 340 : 300;
        let menuX = blockContextMenu.x;
        let menuY = blockContextMenu.y;
        if (menuX + menuW / 2 > window.innerWidth) menuX = window.innerWidth - menuW / 2 - 8;
        if (menuX - menuW / 2 < 0) menuX = menuW / 2 + 8;
        if (menuY + menuH > window.innerHeight) menuY = window.innerHeight - menuH - 8;
        if (menuY < 8) menuY = 8;

        return (
          <div
            className="block-context-menu"
            style={{
              left: menuX,
              top: menuY,
              position: 'fixed',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Color picker dots */}
            <div className="bcm-colors">
              {colorOptions.map(c => (
                <button
                  key={c}
                  className={`bcm-color-dot ${c} ${ctxBlock?.color === c ? 'active' : ''}`}
                  onClick={() => {
                    onUpdateBlock(blockContextMenu.blockId, { color: c });
                    setBlockContextMenu(null);
                  }}
                />
              ))}
            </div>

            <div className="bcm-divider" />

            {/* Add Branch */}
            <button
              className="bcm-item"
              onClick={() => {
                onAddBranch?.(blockContextMenu.blockId);
                setBlockContextMenu(null);
              }}
            >
              <GitBranchPlus size={15} strokeWidth={1.5} /> Add Branch
            </button>

            {/* Add Notes */}
            <button
              className="bcm-item"
              onClick={() => {
                onUpdateBlock(blockContextMenu.blockId, { isEditing: true });
                setBlockContextMenu(null);
              }}
            >
              <AlignLeft size={15} strokeWidth={1.5} /> Add Notes
            </button>

            {/* AI Expand */}
            <button
              className="bcm-item"
              onClick={() => {
                onSynthesizeDecision?.();
                setBlockContextMenu(null);
              }}
            >
              <Waypoints size={15} strokeWidth={1.5} /> AI Expand
            </button>

            {/* Edit Node */}
            <button
              className="bcm-item"
              onClick={() => {
                onUpdateBlock(blockContextMenu.blockId, { isEditing: true });
                setBlockContextMenu(null);
              }}
            >
              <Pencil size={15} strokeWidth={1.5} /> Edit Node
            </button>

            {/* Collapse / Expand Children */}
            {blockHasChildren && (
              <button
                className="bcm-item"
                onClick={() => {
                  onToggleCollapse?.(blockContextMenu.blockId);
                  setBlockContextMenu(null);
                }}
              >
                {ctxBlock?.isCollapsed
                  ? <><ChevronsUpDown size={15} strokeWidth={1.5} /> Expand Children</>
                  : <><X size={15} strokeWidth={1.5} /> Collapse Children</>
                }
              </button>
            )}

            <div className="bcm-divider" />

            {/* Delete Node */}
            <button
              className="bcm-item delete"
              onClick={() => {
                onDeleteBlock(blockContextMenu.blockId);
                setBlockContextMenu(null);
              }}
            >
              <Trash2 size={15} strokeWidth={1.5} /> Delete Node
            </button>
          </div>
        );
      })()}

      <div className="canvas-footer">
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={onZoomOut}>
            <Minus size={16} />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={onZoomIn}>
            <Plus size={16} />
          </button>
        </div>
        <div className="canvas-stats">
          {visibleBlocks.length} blocks &bull; {visibleConnections.length} connections
        </div>
      </div>

      {showOutline && (
        <OutlineView
          blocks={blocks}
          connections={connections}
          onSelectBlock={(id) => {
            onSelectBlock(id);
          }}
          onBlockClick={onBlockClick}
          onDeleteBlocks={(ids) => {
            if (onDeleteBlocks) onDeleteBlocks(ids);
            else ids.forEach((id) => onDeleteBlock(id));
          }}
          onClose={() => onToggleOutline?.()}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Graph, Node, Edge, Selection, Snapline, Keyboard } from '@antv/x6';
import { Block, Connection, BlockColor, ConnectionPosition, ToolType } from '@/lib/types';
import {
  blockToX6Node,
  connectionToX6Edge,
  connectionEdgeId,
  calculateNodeSize,
  portGroups,
  defaultPorts,
  ensureConnectorRegistered,
} from '@/lib/x6-helpers';

interface UseX6GraphOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  mounted?: boolean;
  blocks: Block[];
  connections: Connection[];
  currentTool: ToolType;
  zoom: number;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onDeleteBlock: (id: string) => void;
  onDeleteBlocks?: (ids: string[]) => void;
  onSelectBlock: (id: string | null) => void;
  onAddConnection: (fromId: string, fromPos: ConnectionPosition, toId: string, toPos: ConnectionPosition) => void;
  onDeleteConnection?: (fromId: string, toId: string) => void;
  onBlockClick?: (blockId: string, chatId?: string, messageId?: string, startOffset?: number, endOffset?: number) => void;
  onZoomChange?: (zoom: number) => void;
  onPushSnapshot?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onAddBlock: (text: string, color: BlockColor, x?: number, y?: number, isEditing?: boolean) => void;
  onMergeBlocks?: (sourceId: string, targetId: string) => void;
}

export function useX6Graph(options: UseX6GraphOptions) {
  const graphRef = useRef<Graph | null>(null);
  const isSyncingRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Track which node is being moved (for snapshot before move)
  const hasMovedRef = useRef(false);
  const snapshotPushedRef = useRef(false);

  // Initialize graph
  useEffect(() => {
    const container = options.containerRef.current;
    if (!container || graphRef.current) return;

    // Register the adaptive bezier connector before creating the graph
    ensureConnectorRegistered();

    const graph = new Graph({
      container,
      autoResize: true,
      background: { color: 'transparent' },
      grid: { visible: false },
      panning: {
        enabled: true,
        eventTypes: ['leftMouseDown', 'rightMouseDown'],
      },
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
        zoomAtMousePosition: true,
        minScale: 0.1,
        maxScale: 2,
        factor: 1.04,
      },
      connecting: {
        connector: { name: 'adaptive-bezier' },
        router: { name: 'normal' },
        allowBlank: false,
        allowLoop: false,
        allowMulti: false,
        allowNode: false,
        allowPort: false,
      },
      interacting: () => {
        return {
          nodeMovable: true,
        };
      },
    });

    // Plugins
    graph.use(new Selection({
      enabled: true,
      multiple: true,
      rubberband: true,
      modifiers: ['shift'],
      movable: true,
      showNodeSelectionBox: false,
    }));

    graph.use(new Snapline({ enabled: true }));

    graph.use(new Keyboard({ enabled: true, global: true }));

    // --- Event Handlers ---

    // Drag-to-connect: highlight drop target during drag
    let highlightedNodeId: string | null = null;
    let isDraggingNode = false;

    graph.on('node:moving', ({ node }) => {
      if (isSyncingRef.current) return;
      // Add dragging class to disable CSS transitions during drag
      if (!isDraggingNode) {
        isDraggingNode = true;
        container.classList.add('x6-nodes-dragging');
      }
      // Skip highlight when multiple nodes selected
      const selectedNodes = graph.getSelectedCells().filter(c => c.isNode());
      if (selectedNodes.length > 1) return;

      const bbox = node.getBBox();
      const nodes = graph.getNodes().filter(n => n.id !== node.id);

      let targetId: string | null = null;
      for (const other of nodes) {
        if (bbox.isIntersectWithRect(other.getBBox())) {
          targetId = other.id;
          break;
        }
      }

      if (targetId !== highlightedNodeId) {
        if (highlightedNodeId) {
          const prev = graph.getCellById(highlightedNodeId) as Node;
          if (prev) {
            const prevData = prev.getData();
            prev.setData({ ...prevData, isDropTarget: false }, { overwrite: true });
          }
        }
        if (targetId) {
          const target = graph.getCellById(targetId) as Node;
          if (target) {
            const targetData = target.getData();
            target.setData({ ...targetData, isDropTarget: true }, { overwrite: true });
          }
        }
        highlightedNodeId = targetId;
      }
    });

    // Node moved — drag-to-connect on drop + position persistence
    graph.on('node:moved', ({ node }) => {
      if (isSyncingRef.current) return;

      // Remove dragging class to re-enable CSS transitions
      if (isDraggingNode) {
        isDraggingNode = false;
        container.classList.remove('x6-nodes-dragging');
      }

      // Clear any remaining highlight
      if (highlightedNodeId) {
        const prev = graph.getCellById(highlightedNodeId) as Node;
        if (prev) {
          const prevData = prev.getData();
          prev.setData({ ...prevData, isDropTarget: false }, { overwrite: true });
        }
        highlightedNodeId = null;
      }

      const pos = node.getPosition();

      // If multiple nodes selected, just persist positions (no drag-to-connect)
      const selectedCells = graph.getSelectedCells();
      const selectedNodes = selectedCells.filter(c => c.isNode()) as Node[];
      if (selectedNodes.length > 1) {
        optionsRef.current.onPushSnapshot?.();
        optionsRef.current.onUpdateBlock(node.id, { x: pos.x, y: pos.y });
        selectedNodes.forEach(n => {
          if (n.id !== node.id) {
            const npos = n.getPosition();
            optionsRef.current.onUpdateBlock(n.id, { x: npos.x, y: npos.y });
          }
        });
        return;
      }

      // Check for overlap with another node
      const bbox = node.getBBox();
      const nodes = graph.getNodes().filter(n => n.id !== node.id);
      let targetNode: Node | null = null;
      for (const other of nodes) {
        if (bbox.isIntersectWithRect(other.getBBox())) {
          targetNode = other;
          break;
        }
      }

      if (targetNode) {
        // Check if already connected (either direction)
        const edges = graph.getEdges();
        const alreadyConnected = edges.some(e => {
          const src = e.getSource() as { cell?: string };
          const tgt = e.getTarget() as { cell?: string };
          return (src.cell === targetNode!.id && tgt.cell === node.id) ||
                 (src.cell === node.id && tgt.cell === targetNode!.id);
        });

        if (!alreadyConnected) {
          // Compute connection positions by relative position
          // from = parent (target), to = child (dragged)
          const parentPos = targetNode.getPosition();
          const parentSize = targetNode.getSize();
          const movedSize = node.getSize();
          const parentCenterX = parentPos.x + parentSize.width / 2;
          const parentCenterY = parentPos.y + parentSize.height / 2;
          const childCenterX = pos.x + movedSize.width / 2;
          const childCenterY = pos.y + movedSize.height / 2;

          const dx = childCenterX - parentCenterX;
          const dy = childCenterY - parentCenterY;

          let fromPos: ConnectionPosition;
          let toPos: ConnectionPosition;
          if (Math.abs(dx) > Math.abs(dy)) {
            fromPos = dx > 0 ? 'right' : 'left';
            toPos = dx > 0 ? 'left' : 'right';
          } else {
            fromPos = dy > 0 ? 'bottom' : 'top';
            toPos = dy > 0 ? 'top' : 'bottom';
          }

          // Reposition child to a clear spot on the parent's connection side
          const gap = 40;
          let newX = parentPos.x;
          let newY = parentPos.y;
          if (fromPos === 'right') {
            newX = parentPos.x + parentSize.width + gap;
            newY = parentPos.y + parentSize.height / 2 - movedSize.height / 2;
          } else if (fromPos === 'left') {
            newX = parentPos.x - movedSize.width - gap;
            newY = parentPos.y + parentSize.height / 2 - movedSize.height / 2;
          } else if (fromPos === 'bottom') {
            newX = parentPos.x + parentSize.width / 2 - movedSize.width / 2;
            newY = parentPos.y + parentSize.height + gap;
          } else {
            newX = parentPos.x + parentSize.width / 2 - movedSize.width / 2;
            newY = parentPos.y - movedSize.height - gap;
          }

          optionsRef.current.onPushSnapshot?.();
          optionsRef.current.onAddConnection(targetNode.id, fromPos, node.id, toPos);
          optionsRef.current.onUpdateBlock(node.id, { x: newX, y: newY });
        } else {
          // Already connected, just persist position
          optionsRef.current.onPushSnapshot?.();
          optionsRef.current.onUpdateBlock(node.id, { x: pos.x, y: pos.y });
        }
      } else {
        // No overlap, just persist position
        optionsRef.current.onPushSnapshot?.();
        optionsRef.current.onUpdateBlock(node.id, { x: pos.x, y: pos.y });
      }
    });

    // Node resized
    graph.on('node:resized', ({ node }) => {
      if (isSyncingRef.current) return;
      const size = node.getSize();
      optionsRef.current.onPushSnapshot?.();
      optionsRef.current.onUpdateBlock(node.id, { width: size.width, height: size.height });
    });

    // Selection changed
    graph.on('selection:changed', ({ selected }) => {
      if (isSyncingRef.current) return;
      const nodeIds = (selected || []).filter(c => c.isNode()).map(c => c.id);
      if (nodeIds.length > 0) {
        optionsRef.current.onSelectBlock(nodeIds[0]);
      } else {
        optionsRef.current.onSelectBlock(null);
      }
    });

    // Blank click (for text tool - add new block)
    graph.on('blank:click', ({ e }) => {
      if (isSyncingRef.current) return;
      // Context menu and new block handled by the component via onCanvasClick callback
    });

    // Zoom changed
    graph.on('scale', ({ sx }) => {
      if (isSyncingRef.current) return;
      optionsRef.current.onZoomChange?.(sx);
    });

    // Guard: skip shortcuts when user is typing in an input/textarea
    const isEditing = () => {
      const el = document.activeElement;
      return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
    };

    // Keyboard shortcuts
    graph.bindKey(['backspace', 'delete'], () => {
      if (isEditing()) return;

      const selected = graph.getSelectedCells();
      const nodeIds = selected.filter(c => c.isNode()).map(c => c.id);
      const selectedEdges = selected.filter(c => c.isEdge()) as Edge[];

      if (nodeIds.length > 0) {
        optionsRef.current.onPushSnapshot?.();
        if (optionsRef.current.onDeleteBlocks && nodeIds.length > 1) {
          optionsRef.current.onDeleteBlocks(nodeIds);
        } else {
          nodeIds.forEach(id => optionsRef.current.onDeleteBlock(id));
        }
      }

      if (selectedEdges.length > 0 && optionsRef.current.onDeleteConnection) {
        optionsRef.current.onPushSnapshot?.();
        selectedEdges.forEach(edge => {
          const source = edge.getSource() as { cell?: string };
          const target = edge.getTarget() as { cell?: string };
          if (source?.cell && target?.cell) {
            optionsRef.current.onDeleteConnection!(source.cell, target.cell);
          }
        });
      }
    });

    graph.bindKey(['meta+z', 'ctrl+z'], () => {
      if (isEditing()) return;
      optionsRef.current.onUndo?.();
    });

    graph.bindKey(['meta+shift+z', 'ctrl+shift+z', 'ctrl+y'], () => {
      if (isEditing()) return;
      optionsRef.current.onRedo?.();
    });

    graph.bindKey('escape', () => {
      graph.cleanSelection();
      optionsRef.current.onSelectBlock(null);
    });

    graph.bindKey('f', () => {
      if (isEditing()) return;
      // Dispatch a custom event so the fitToScreen callback handles it
      window.dispatchEvent(new CustomEvent('x6-fit-to-screen'));
    });

    graphRef.current = graph;

    // Trackpad two-finger scroll → pan (without ctrl/meta, which trigger zoom)
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // let X6 mousewheel handle zoom
      e.preventDefault();
      const tx = graph.translate();
      graph.translate(tx.tx - e.deltaX, tx.ty - e.deltaY);
    };
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      graph.dispose();
      graphRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.mounted]); // Re-run when mounted changes (container becomes available)

  // Listen for external focus requests (e.g. chat highlight → canvas block)
  useEffect(() => {
    const handleFocusBlock = (e: Event) => {
      const graph = graphRef.current;
      if (!graph) return;
      const { blockId } = (e as CustomEvent).detail;
      const cell = graph.getCellById(blockId);
      if (cell && cell.isNode()) {
        graph.cleanSelection();
        graph.select(cell);
        graph.centerCell(cell, { padding: { left: 100, right: 100, top: 100, bottom: 100 } });
      }
    };

    window.addEventListener('x6-focus-block', handleFocusBlock);
    return () => window.removeEventListener('x6-focus-block', handleFocusBlock);
  }, []);

  // Listen for fit-to-screen requests (triggered by keyboard shortcut F)
  const fitToScreenRef = useRef<() => void>(() => {});
  useEffect(() => {
    const handler = () => fitToScreenRef.current();
    window.addEventListener('x6-fit-to-screen', handler);
    return () => window.removeEventListener('x6-fit-to-screen', handler);
  }, []);

  // Resize all nodes when text size changes
  useEffect(() => {
    const handleTextSizeChange = () => {
      const graph = graphRef.current;
      if (!graph) return;
      for (const node of graph.getNodes()) {
        const data = node.getData();
        if (data?.block) {
          const block = data.block as Block;
          const dynamicSize = calculateNodeSize(block.text, !!block.isCollapsed);
          node.setSize(dynamicSize.width, dynamicSize.height);
        }
      }
    };
    window.addEventListener('cercily-text-size-change', handleTextSizeChange);
    return () => window.removeEventListener('cercily-text-size-change', handleTextSizeChange);
  }, []);

  // Sync blocks and connections from React state to X6 graph
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    isSyncingRef.current = true;

    try {
      const visibleBlocks = options.blocks.filter(b => !b.isHidden);
      const visibleBlockIds = new Set(visibleBlocks.map(b => b.id));

      // Build set of blocks that have outgoing connections (children)
      const blocksWithChildren = new Set<string>();
      for (const conn of options.connections) {
        blocksWithChildren.add(conn.from);
      }

      // --- Sync Nodes ---
      const currentNodes = graph.getNodes();
      const currentNodeIds = new Set(currentNodes.map(n => n.id));

      // Remove nodes that are gone or hidden
      for (const node of currentNodes) {
        if (!visibleBlockIds.has(node.id)) {
          try { node.remove(); } catch (_) {}
        }
      }

      // Add or update nodes
      for (const block of visibleBlocks) {
        const hasChildren = blocksWithChildren.has(block.id);
        if (currentNodeIds.has(block.id)) {
          const node = graph.getCellById(block.id) as Node;
          if (node) {
            const pos = node.getPosition();
            const size = node.getSize();
            const dynamicSize = calculateNodeSize(block.text, !!block.isCollapsed);
            const targetW = block.width || dynamicSize.width;
            const targetH = block.height || dynamicSize.height;

            if (pos.x !== block.x || pos.y !== block.y) {
              node.setPosition(block.x, block.y);
            }
            if (size.width !== targetW || size.height !== targetH) {
              node.setSize(targetW, targetH);
            }
            node.setData({ block, hasChildren }, { overwrite: true });
          }
        } else {
          // Add new node
          graph.addNode(blockToX6Node(block, hasChildren));
        }
      }

      // --- Sync Edges ---
      const currentEdges = graph.getEdges();
      const currentEdgeMap = new Map(currentEdges.map(e => [e.id, e]));

      // Build target edge set from visible connections
      const visibleConnections = options.connections.filter(
        c => visibleBlockIds.has(c.from) && visibleBlockIds.has(c.to)
      );
      const targetEdgeIds = new Set(visibleConnections.map(c => connectionEdgeId(c)));

      // Remove edges that are gone
      for (const edge of currentEdges) {
        if (!targetEdgeIds.has(edge.id)) {
          try { edge.remove(); } catch (_) {}
        }
      }

      // Add or update edges
      for (const conn of visibleConnections) {
        const edgeId = connectionEdgeId(conn);
        const existing = currentEdgeMap.get(edgeId);
        if (existing) {
          const targetStroke = connectionToX6Edge(conn).attrs.line.stroke;
          const currentStroke = existing.attr('line/stroke');
          if (currentStroke !== targetStroke) {
            existing.attr('line/stroke', targetStroke, { silent: true });
          }
        } else {
          graph.addEdge(connectionToX6Edge(conn));
        }
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [options.blocks, options.connections]);

  // Sync zoom
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const currentZoom = graph.zoom();
    if (Math.abs(currentZoom - options.zoom) > 0.01) {
      isSyncingRef.current = true;
      graph.zoom(options.zoom / currentZoom - 1);
      isSyncingRef.current = false;
    }
  }, [options.zoom]);

  // Panning is always enabled (via leftMouseDown + rightMouseDown configured in graph init)

  // Helper: get graph position from screen coordinates
  const screenToGraphPosition = useCallback((screenX: number, screenY: number) => {
    const graph = graphRef.current;
    if (!graph) return { x: 0, y: 0 };
    const point = graph.clientToLocal(screenX, screenY);
    return { x: point.x, y: point.y };
  }, []);

  const zoomIn = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.zoom(0.1);
    optionsRef.current.onZoomChange?.(graph.zoom());
  }, []);

  const zoomOut = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.zoom(-0.1);
    optionsRef.current.onZoomChange?.(graph.zoom());
  }, []);

  const fitToScreen = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const nodes = graph.getNodes();
    if (nodes.length === 0) return;

    // Capture current state
    const startZoom = graph.zoom();
    const startTranslate = graph.translate();

    // Apply zoomToFit instantly to capture target values
    isSyncingRef.current = true;
    graph.zoomToFit({ padding: 60, maxScale: 1.5 });
    const targetZoom = graph.zoom();
    const targetTranslate = graph.translate();

    // Restore original state before animating
    // Use relative zoom: graph.zoom(factor) multiplies current zoom by (1 + factor)
    // To set absolute zoom, we compute relative factor from current
    graph.zoom(startZoom / targetZoom - 1);
    graph.translate(startTranslate.tx, startTranslate.ty);
    isSyncingRef.current = false;

    // Animate over 300ms with ease-in-out
    const duration = 300;
    const startTime = performance.now();
    let prevZoom = startZoom;

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease in-out quad
      const eased = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

      const desiredZoom = startZoom + (targetZoom - startZoom) * eased;
      const currentTx = startTranslate.tx + (targetTranslate.tx - startTranslate.tx) * eased;
      const currentTy = startTranslate.ty + (targetTranslate.ty - startTranslate.ty) * eased;

      isSyncingRef.current = true;
      // Apply relative zoom change from previous frame's zoom
      const relFactor = desiredZoom / prevZoom - 1;
      graph.zoom(relFactor);
      prevZoom = graph.zoom();
      graph.translate(currentTx, currentTy);
      isSyncingRef.current = false;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        optionsRef.current.onZoomChange?.(graph.zoom());
      }
    };

    requestAnimationFrame(step);
  }, []);

  // Keep the ref in sync so the keyboard shortcut event listener can call it
  fitToScreenRef.current = fitToScreen;

  const getGraph = useCallback(() => graphRef.current, []);

  return {
    graph: graphRef.current,
    getGraph,
    screenToGraphPosition,
    zoomIn,
    zoomOut,
    fitToScreen,
  };
}

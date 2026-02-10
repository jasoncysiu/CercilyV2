'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Graph, Node, Edge, Selection, Snapline, Keyboard } from '@antv/x6';
import { Block, Connection, BlockColor, ConnectionPosition, ToolType } from '@/lib/types';
import {
  blockToX6Node,
  connectionToX6Edge,
  connectionEdgeId,
  portIdToPosition,
  portGroups,
  defaultPorts,
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
        connector: { name: 'smooth' },
        router: { name: 'normal' },
        allowBlank: false,
        allowLoop: false,
        allowMulti: false,
        snap: { radius: 30 },
        allowNode: false,
        allowPort: true,
        createEdge() {
          return this.createEdge({
            connector: { name: 'smooth' },
            attrs: {
              line: {
                stroke: '#94a3b8',
                strokeWidth: 2,
                targetMarker: null,
              },
            },
          });
        },
        validateConnection({ sourcePort, targetPort, sourceCell, targetCell }) {
          if (!sourcePort || !targetPort) return false;
          if (sourceCell && targetCell && sourceCell.id === targetCell.id) return false;
          return true;
        },
      },
      interacting: () => {
        return {
          nodeMovable: true,
          magnetConnectable: true,
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

    // Node moved
    graph.on('node:moved', ({ node }) => {
      if (isSyncingRef.current) return;
      const pos = node.getPosition();
      optionsRef.current.onPushSnapshot?.();
      optionsRef.current.onUpdateBlock(node.id, { x: pos.x, y: pos.y });

      // If multiple nodes selected, update all of them
      const selectedCells = graph.getSelectedCells();
      const selectedNodes = selectedCells.filter(c => c.isNode()) as Node[];
      if (selectedNodes.length > 1) {
        selectedNodes.forEach(n => {
          if (n.id !== node.id) {
            const npos = n.getPosition();
            optionsRef.current.onUpdateBlock(n.id, { x: npos.x, y: npos.y });
          }
        });
      }
    });

    // Node resized
    graph.on('node:resized', ({ node }) => {
      if (isSyncingRef.current) return;
      const size = node.getSize();
      optionsRef.current.onPushSnapshot?.();
      optionsRef.current.onUpdateBlock(node.id, { width: size.width, height: size.height });
    });

    // Edge connected (new edge created by user dragging)
    graph.on('edge:connected', ({ edge }) => {
      if (isSyncingRef.current) return;
      const source = edge.getSource() as { cell?: string; port?: string };
      const target = edge.getTarget() as { cell?: string; port?: string };
      if (source.cell && target.cell && source.port && target.port) {
        optionsRef.current.onPushSnapshot?.();
        optionsRef.current.onAddConnection(
          source.cell as string,
          portIdToPosition(source.port),
          target.cell as string,
          portIdToPosition(target.port),
        );
      }
      // Always remove the X6-created edge — the sync will re-add from React state
      // Use direct remove (not silent) so the SVG element is fully cleaned up
      isSyncingRef.current = true;
      try {
        edge.remove();
      } catch (_) {
        // Edge may already be gone
      }
      isSyncingRef.current = false;
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

    graphRef.current = graph;

    return () => {
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

  // Sync blocks and connections from React state to X6 graph
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    isSyncingRef.current = true;

    try {
      const visibleBlocks = options.blocks.filter(b => !b.isHidden);
      const visibleBlockIds = new Set(visibleBlocks.map(b => b.id));

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
        if (currentNodeIds.has(block.id)) {
          const node = graph.getCellById(block.id) as Node;
          if (node) {
            const pos = node.getPosition();
            const size = node.getSize();
            const targetW = block.width || (block.isCollapsed ? 160 : 260);
            const targetH = block.height || (block.isCollapsed ? 50 : 100);

            if (pos.x !== block.x || pos.y !== block.y) {
              node.setPosition(block.x, block.y, { silent: true });
            }
            if (size.width !== targetW || size.height !== targetH) {
              node.setSize(targetW, targetH, { silent: true });
            }
            // Update data WITHOUT silent so the React shape re-renders
            // (effect: ['data'] in the shape registration listens for change events)
            node.setData({ block }, { overwrite: true });
          }
        } else {
          // Add new node
          graph.addNode(blockToX6Node(block));
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

      // Remove edges that are gone (don't use { silent: true } — it can leave ghost SVG)
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
          // Update color/attrs if they changed
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
      graph.zoom(options.zoom / currentZoom);
      isSyncingRef.current = false;
    }
  }, [options.zoom]);

  // Panning is always enabled (via rightMouseDown configured in graph init)

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

  const getGraph = useCallback(() => graphRef.current, []);

  return {
    graph: graphRef.current,
    getGraph,
    screenToGraphPosition,
    zoomIn,
    zoomOut,
  };
}

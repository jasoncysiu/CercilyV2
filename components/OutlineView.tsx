'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Block, Connection, BlockColor } from '@/lib/types';
import { Search, ChevronDown, ChevronRight, X, Maximize2, Minimize2, Filter, MousePointer2, LayoutList, Type, Edit3, GripVertical } from 'lucide-react';

interface OutlineViewProps {
  blocks: Block[];
  connections: Connection[];
  onSelectBlock: (id: string) => void;
  onBlockClick?: (blockId: string, chatId?: string, messageId?: string, startOffset?: number, endOffset?: number) => void;
  onDeleteBlocks: (ids: string[]) => void;
  onClose: () => void;
}


interface TreeNode {
  id: string;
  block: Block;
  children: TreeNode[];
}

export default function OutlineView({ blocks, connections, onSelectBlock, onBlockClick, onDeleteBlocks, onClose }: OutlineViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTickIds, setSelectedTickIds] = useState<Set<string>>(new Set());

  
  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  // Build the hierarchical tree
  const tree = useMemo(() => {
    const blockMap = new Map<string, Block>(blocks.map(b => [b.id, b]));
    const childrenMap = new Map<string, string[]>();
    const hasParent = new Set<string>();

    connections.forEach(conn => {
      if (!childrenMap.has(conn.from)) childrenMap.set(conn.from, []);
      childrenMap.get(conn.from)!.push(conn.to);
      hasParent.add(conn.to);
    });

    const buildTree = (nodeId: string): TreeNode | null => {
      const block = blockMap.get(nodeId);
      if (!block) return null;
      
      const childrenIds = childrenMap.get(nodeId) || [];
      return {
        id: nodeId,
        block,
        children: childrenIds.map(buildTree).filter((n): n is TreeNode => n !== null)
      };
    };

    // Roots are blocks that don't have a parent in the connections
    return blocks
      .filter(b => !hasParent.has(b.id))
      .map(b => buildTree(b.id))
      .filter((n): n is TreeNode => n !== null);
  }, [blocks, connections]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      setPosition({
        x: initialPosRef.current.x + dx,
        y: initialPosRef.current.y + dy
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from the header, but not from buttons or inputs
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { x: position.x, y: position.y };
  };

  const allExpandableIds = useMemo(() => {
    const ids = new Set<string>();
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          ids.add(node.id);
          traverse(node.children);
        }
      });
    };
    traverse(tree);
    return ids;
  }, [tree]);

  // Compute which node IDs match the search (including their ancestors for visibility)
  const { matchingIds, ancestorIds } = useMemo(() => {
    const matching = new Set<string>();
    const ancestors = new Set<string>();
    if (!searchQuery) return { matchingIds: matching, ancestorIds: ancestors };
    const q = searchQuery.toLowerCase();

    // First pass: find all nodes whose text matches
    const findMatches = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.block.text.toLowerCase().includes(q)) {
          matching.add(node.id);
        }
        findMatches(node.children);
      }
    };
    findMatches(tree);

    // Second pass: mark ancestors of matching nodes so they stay visible and expanded
    const markAncestors = (nodes: TreeNode[]): boolean => {
      let hasMatchBelow = false;
      for (const node of nodes) {
        const childHasMatch = markAncestors(node.children);
        if (childHasMatch || matching.has(node.id)) {
          ancestors.add(node.id);
          hasMatchBelow = true;
        }
      }
      return hasMatchBelow;
    };
    markAncestors(tree);

    return { matchingIds: matching, ancestorIds: ancestors };
  }, [searchQuery, tree]);

  const areAllExpanded = expandedNodes.size === allExpandableIds.size && allExpandableIds.size > 0;

  const toggleAll = () => {
    if (areAllExpanded) {
      setExpandedNodes(new Set());
    } else {
      setExpandedNodes(new Set(allExpandableIds));
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const toggleTick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedTickIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTickIds(newSelected);
  };

  const handleDelete = () => {
    if (selectedTickIds.size === 0) return;
    if (confirm(`Delete ${selectedTickIds.size} cards?`)) {
      onDeleteBlocks(Array.from(selectedTickIds));
      setSelectedTickIds(new Set());
      setIsEditMode(false);
    }
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isSelected = selectedTickIds.has(node.id);
    const hasChildren = node.children.length > 0;

    // When searching, hide nodes that neither match nor are ancestors of matches
    if (searchQuery && !matchingIds.has(node.id) && !ancestorIds.has(node.id)) return null;

    // Auto-expand ancestor nodes during search; use manual expand state otherwise
    const isExpanded = searchQuery ? ancestorIds.has(node.id) : expandedNodes.has(node.id);

    return (
      <div key={node.id} className="outline-node-wrapper">
        <div 
          className={`outline-node depth-${depth} ${hasChildren ? 'has-children' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => {
            if (isEditMode) {
              toggleTick(node.id, { stopPropagation: () => {} } as any);
            } else {
              onSelectBlock(node.id);
              // Focus the canvas on this node
              window.dispatchEvent(new CustomEvent('x6-focus-block', { detail: { blockId: node.id } }));
              // Navigate to source text in chat if available
              const b = node.block;
              if (b.messageId && onBlockClick) {
                onBlockClick(b.id, b.chatId, b.messageId, b.startOffset, b.endOffset);
              }
            }
          }}
        >
          {isEditMode && (
            <div className="node-checkbox" onClick={(e) => toggleTick(node.id, e)}>
              <div className={`checkbox-inner ${isSelected ? 'checked' : ''}`} />
            </div>
          )}
          <div className="node-content">
            <div className="node-prefix">

              {hasChildren ? (
                <button className="expand-btn" onClick={(e) => toggleExpand(node.id, e)}>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <div className="node-dot" style={{ backgroundColor: getColorCode(node.block.color) }} />
              )}
            </div>
            <span className="node-text">{node.block.text}</span>
            {hasChildren && <ChevronRight size={14} className="node-arrow" />}
          </div>
          <div className="node-indicator" style={{ backgroundColor: getColorCode(node.block.color) }} />
        </div>
        {hasChildren && isExpanded && (
          <div className="node-children">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`outline-view ${isDragging ? 'dragging' : ''}`}
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)`,
        // We set transition to none during drag for smoothness
        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
      }}
    >
      <div className="outline-header" onMouseDown={handleMouseDown}>
        <div className="header-actions">
          <button className="header-btn" onClick={toggleAll} title={areAllExpanded ? "Collapse All" : "Expand All"}>
            {areAllExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <div style={{ width: '8px' }} />
          <button className="header-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="search-container">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search outline..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()} // Prevent drag start when clicking input
            />
            {searchQuery ? (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')} onMouseDown={(e) => e.stopPropagation()}>
                <X size={14} />
              </button>
            ) : (
              <Filter size={16} className="filter-icon" />
            )}
          </div>
          {searchQuery && (
            <div className="search-match-count">{matchingIds.size} match{matchingIds.size !== 1 ? 'es' : ''}</div>
          )}
        </div>
      </div>

      <div className="outline-body scrollbar-hide">
        {tree.length === 0 ? (
          <div className="empty-state">No cards to display</div>
        ) : (
          tree.map(node => renderNode(node))
        )}
      </div>

      <div className="outline-footer">
        <div className="footer-tools">
          {isEditMode ? (
            <>
              <button className="footer-tool-btn delete" onClick={handleDelete} disabled={selectedTickIds.size === 0}>
                <X size={14} /> <span>Delete ({selectedTickIds.size})</span>
              </button>
              <button className="footer-btn-edit active" onClick={() => { setIsEditMode(false); setSelectedTickIds(new Set()); }}>Done</button>
            </>
          ) : (
            <>
              <button className="footer-tool-btn"><MousePointer2 size={14} /> <span>Select</span></button>
              <button className="footer-tool-btn"><GripVertical size={14} /></button>
              <button className="footer-tool-btn"><LayoutList size={14} /></button>
              <button className="footer-tool-btn"><Type size={14} /></button>
              <button className="footer-btn-edit" onClick={() => setIsEditMode(true)}>Edit</button>
            </>
          )}
        </div>
      </div>

    </div>
  );
}


function getColorCode(color: BlockColor): string {
  switch (color) {
    case 'orange': return '#FF7F0F';
    case 'cyan': return '#00BFBF';
    case 'pink': return '#FF4081';
    case 'purple': return '#CE5BFF';
    case 'green': return '#32CD35';
    case 'gold': return '#FFBF00';
    case 'blue': return '#03A9F4';
    case 'teal': return '#00B7A5';
    default: return '#03A9F4';
  }
}

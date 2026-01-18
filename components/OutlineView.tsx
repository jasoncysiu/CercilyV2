'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Block, Connection, BlockColor } from '@/lib/types';
import { Search, ChevronDown, ChevronRight, X, Maximize2, Filter, MousePointer2, LayoutList, Type, Edit3, GripVertical } from 'lucide-react';

interface OutlineViewProps {
  blocks: Block[];
  connections: Connection[];
  onSelectBlock: (id: string) => void;
  onDeleteBlocks: (ids: string[]) => void;
  onConvertToTable: (ids: string[]) => void;
  onClose: () => void;
}


interface TreeNode {
  id: string;
  block: Block;
  children: TreeNode[];
}

export default function OutlineView({ blocks, connections, onSelectBlock, onDeleteBlocks, onConvertToTable, onClose }: OutlineViewProps) {
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
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedTickIds.has(node.id);
    const hasChildren = node.children.length > 0;

    const isHidden = searchQuery && !node.block.text.toLowerCase().includes(searchQuery.toLowerCase()) && 
                    !node.children.some(child => child.block.text.toLowerCase().includes(searchQuery.toLowerCase()));

    if (isHidden && searchQuery) return null;

    return (
      <div key={node.id} className="outline-node-wrapper">
        <div 
          className={`outline-node depth-${depth} ${hasChildren ? 'has-children' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => isEditMode ? toggleTick(node.id, { stopPropagation: () => {} } as any) : onSelectBlock(node.id)}
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
            {areAllExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
            <Filter size={16} className="filter-icon" />
          </div>
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
              <button 
                className="footer-tool-btn" 
                style={{ color: '#0a84ff' }} 
                onClick={() => { onConvertToTable(Array.from(selectedTickIds)); setSelectedTickIds(new Set()); setIsEditMode(false); }} 
                disabled={selectedTickIds.size < 2}
              >
                <LayoutList size={14} /> <span>Convert to Table</span>
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
    case 'yellow': return '#ffd60a';
    case 'blue': return '#0a84ff';
    case 'pink': return '#ff375f';
    case 'green': return '#30d158';
    case 'orange': return '#ff9f0a';
    default: return '#8e8e93';
  }
}

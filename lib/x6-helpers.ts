import { Block, Connection, BlockColor, ConnectionPosition } from './types';

// Port group configuration for X6 nodes
export const portGroups = {
  top: {
    position: 'top',
    attrs: {
      circle: {
        r: 5,
        magnet: true,
        stroke: 'var(--border-primary)',
        strokeWidth: 1.5,
        fill: 'var(--bg-secondary)',
      },
    },
  },
  bottom: {
    position: 'bottom',
    attrs: {
      circle: {
        r: 5,
        magnet: true,
        stroke: 'var(--border-primary)',
        strokeWidth: 1.5,
        fill: 'var(--bg-secondary)',
      },
    },
  },
  left: {
    position: 'left',
    attrs: {
      circle: {
        r: 5,
        magnet: true,
        stroke: 'var(--border-primary)',
        strokeWidth: 1.5,
        fill: 'var(--bg-secondary)',
      },
    },
  },
  right: {
    position: 'right',
    attrs: {
      circle: {
        r: 5,
        magnet: true,
        stroke: 'var(--border-primary)',
        strokeWidth: 1.5,
        fill: 'var(--bg-secondary)',
      },
    },
  },
};

// Default port items for each node
export const defaultPorts = [
  { id: 'top', group: 'top' },
  { id: 'bottom', group: 'bottom' },
  { id: 'left', group: 'left' },
  { id: 'right', group: 'right' },
];

// Color map for edge strokes
const edgeColorMap: Record<BlockColor, string> = {
  yellow: '#EAB308',
  blue: '#3B82F6',
  pink: '#EC4899',
  green: '#22C55E',
  orange: '#F97316',
};

export function getEdgeStrokeColor(color: BlockColor): string {
  return edgeColorMap[color] || '#94a3b8';
}

// Convert a Block to X6 node metadata
export function blockToX6Node(block: Block) {
  return {
    id: block.id,
    shape: 'cercily-block',
    x: block.x,
    y: block.y,
    width: block.width || (block.isCollapsed ? 160 : 260),
    height: block.height || (block.isCollapsed ? 50 : 100),
    data: { block },
    ports: {
      groups: portGroups,
      items: defaultPorts,
    },
  };
}

// Generate a stable edge ID from a Connection
export function connectionEdgeId(conn: Connection): string {
  return `edge-${conn.from}-${conn.fromPos}-${conn.to}-${conn.toPos}`;
}

// Convert a Connection to X6 edge metadata
export function connectionToX6Edge(conn: Connection) {
  return {
    id: connectionEdgeId(conn),
    source: { cell: conn.from, port: conn.fromPos },
    target: { cell: conn.to, port: conn.toPos },
    connector: { name: 'smooth' },
    attrs: {
      line: {
        stroke: getEdgeStrokeColor(conn.color),
        strokeWidth: 2,
        targetMarker: null,
      },
    },
    data: { connection: conn },
  };
}

// Extract ConnectionPosition from an X6 port ID
export function portIdToPosition(portId: string): ConnectionPosition {
  if (['top', 'bottom', 'left', 'right'].includes(portId)) {
    return portId as ConnectionPosition;
  }
  return 'bottom'; // fallback
}

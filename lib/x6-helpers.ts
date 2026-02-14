import { Block, Connection, BlockColor, ConnectionPosition } from './types';

// Port group configuration for X6 nodes (invisible — used only for edge routing)
const hiddenPortAttrs = {
  circle: { r: 0, magnet: false, stroke: 'none', fill: 'none' },
};

export const portGroups = {
  top: { position: 'top', attrs: hiddenPortAttrs },
  bottom: { position: 'bottom', attrs: hiddenPortAttrs },
  left: { position: 'left', attrs: hiddenPortAttrs },
  right: { position: 'right', attrs: hiddenPortAttrs },
};

// Default port items for each node
export const defaultPorts = [
  { id: 'top', group: 'top' },
  { id: 'bottom', group: 'bottom' },
  { id: 'left', group: 'left' },
  { id: 'right', group: 'right' },
];

// MMW 8-color branch palette
const edgeColorMap: Record<BlockColor, string> = {
  orange: '#FF7F0F',
  cyan: '#00BFBF',
  pink: '#FF4081',
  purple: '#CE5BFF',
  green: '#32CD35',
  gold: '#FFBF00',
  blue: '#03A9F4',
  teal: '#00B7A5',
};

export function getEdgeStrokeColor(color: BlockColor): string {
  return edgeColorMap[color] || '#03A9F4';
}

// Shared color map for use by other components
export { edgeColorMap as branchColorMap };

// Calculate dynamic node size based on text content
export function calculateNodeSize(text: string, isCollapsed: boolean): { width: number; height: number } {
  if (isCollapsed) {
    return { width: 160, height: 50 };
  }

  const charCount = text.length;
  const lineBreaks = (text.match(/\n/g) || []).length;

  // Estimate chars per line based on a target width
  // ~7px per char at 14px font, with 44px horizontal padding
  const charsPerLine = 30;

  // Calculate how many visual lines (word-wrap estimate + explicit line breaks)
  const wrappedLines = Math.ceil(charCount / charsPerLine) + lineBreaks;

  // Width: scale with text but clamp between 180 and 420
  let width: number;
  if (charCount <= 40) {
    width = 180;
  } else if (charCount <= 80) {
    width = 220;
  } else if (charCount <= 150) {
    width = 280;
  } else if (charCount <= 300) {
    width = 340;
  } else {
    width = 400;
  }

  // Height: base 50px + ~22px per line, clamped between 60 and 400
  const lineHeight = 22;
  const verticalPadding = 28;
  let height = verticalPadding + wrappedLines * lineHeight;
  height = Math.max(60, Math.min(400, height));

  return { width, height };
}

// Convert a Block to X6 node metadata
export function blockToX6Node(block: Block, hasChildren = false) {
  const dynamicSize = calculateNodeSize(block.text, !!block.isCollapsed);
  return {
    id: block.id,
    shape: 'cercily-block',
    x: block.x,
    y: block.y,
    width: block.width || dynamicSize.width,
    height: block.height || dynamicSize.height,
    data: { block, hasChildren },
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

// Convert a Connection to X6 edge metadata (MMW-style thick Bezier curves)
export function connectionToX6Edge(conn: Connection) {
  return {
    id: connectionEdgeId(conn),
    source: { cell: conn.from, port: conn.fromPos },
    target: { cell: conn.to, port: conn.toPos },
    connector: { name: 'smooth' },
    attrs: {
      line: {
        stroke: getEdgeStrokeColor(conn.color),
        strokeWidth: 4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
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

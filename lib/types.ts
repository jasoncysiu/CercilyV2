export type BlockColor = 'yellow' | 'blue' | 'pink' | 'green' | 'orange';

export interface Block {
  id: string;
  text: string;
  color: BlockColor;
  x: number;
  y: number;
}

export interface Connection {
  from: string;
  fromPos: ConnectionPosition;
  to: string;
  toPos: ConnectionPosition;
  color: BlockColor;
}

export type ConnectionPosition = 'top' | 'bottom' | 'left' | 'right';

export type ToolType = 'select' | 'connect' | 'text';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatItem {
  id: string;
  title: string;
  preview: string;
  active?: boolean;
}

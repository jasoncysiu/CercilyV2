export type BlockColor = 'yellow' | 'blue' | 'pink' | 'green' | 'orange';

export interface Block {
  id: string;
  text: string;
  color: BlockColor;
  x: number;
  y: number;
  // Optional metadata
  chatId?: string;
  messageId?: string;
  startOffset?: number;
  endOffset?: number;
  parentId?: string;
  isCollapsed?: boolean;
  isHidden?: boolean;
  type?: 'regular' | 'table';
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

export interface Highlight {
  id: string;
  messageId: string;
  text: string;
  color: BlockColor;
  startOffset: number;
  endOffset: number;
}

// New interface to store all data for a single chat
export interface ChatData {
  title: string;
  preview: string;
  messages: Message[];
  blocks: Block[];
  connections: Connection[];
  highlights: Highlight[];
}

export interface ChatItem {
  id: string;
  title: string;
  preview: string;
  active?: boolean;
}

export interface Project {
  id: string;
  title: string;
  chatIds: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  chats: ChatItem[];
}
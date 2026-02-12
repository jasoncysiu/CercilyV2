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
  width?: number;
  height?: number;
  isEditing?: boolean;
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
  updatedAt?: string;
}

export interface ChatItem {
  id: string;
  title: string;
  preview: string;
  active?: boolean;
  updatedAt?: string;
}

// ============================================
// DECISION MODE TYPES
// ============================================

export interface DecisionData {
  question: string;           // "Should I quit my job?"
  context: string;            // Situation description
  worstCase: string;          // What's the worst that could happen?
  prevention: string;         // How to prevent/mitigate?
  bestCase: string;           // What's the upside?
  costOfInaction: string;     // What if you do nothing?
  choice: string;             // What they decided to do
  confidence: number;         // 1-10 how confident
  createdAt: string;          // ISO timestamp
  reviewDate: string;         // ISO timestamp - when to follow up
  reviewedAt?: string;        // When they actually reviewed
  actualOutcome?: string;     // What happened
  learnings?: string;         // What they learned
}

// ============================================
// PROJECT TYPES
// ============================================

export interface Project {
  id: string;
  title: string;
  chatIds: string[];
  context?: string; // Project-level context to be included in chats
  isDecision?: boolean;
  decisionData?: DecisionData;
}

export interface ProjectItem {
  id: string;
  title: string;
  chats: ChatItem[];
  context?: string;
  isDecision?: boolean;
}

export interface ProjectWithDecision extends Project {
  isDecision?: boolean;
  decisionData?: DecisionData;
}

// ============================================
// SYNTHESIZED DECISION TYPES (Canvas → Decision)
// ============================================

export interface SynthesisOption {
  name: string;
  pros: string[];
  cons: string[];
}

export interface ReasoningPoint {
  point: string;
  nodeId: string;
  nodeColor?: BlockColor;
}

export interface SynthesisResult {
  question: string;
  options: SynthesisOption[];
  leaning: string;
  keyReasoning: ReasoningPoint[];
  unresolved: string[];
}

export interface SynthesizedDecision {
  id: string;
  projectId: string;
  userId?: string;

  // AI-generated summary (user can edit)
  question: string;
  options: SynthesisOption[];
  leaning: string;
  keyReasoning: ReasoningPoint[];
  unresolved: string[];

  // User commitment
  choice: string;
  reasoningSummary?: string;
  reasoningNodeIds: string[];

  // Review loop
  reviewDate: string;           // ISO timestamp
  reviewedAt?: string;          // When they actually reviewed
  actualOutcome?: string;       // What happened
  learnings?: string;           // What they learned
  outcomeRating?: 'good' | 'neutral' | 'bad';

  // Metadata
  createdAt: string;
  updatedAt: string;
}
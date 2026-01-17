'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import StatusBar from '@/components/StatusBar';
import MainToolbar from '@/components/MainToolbar';
import LeftSidebar from '@/components/LeftSidebar';
import ChatView from '@/components/ChatView';
import CanvasPanel from '@/components/CanvasPanel';
import SelectionPopup from '@/components/SelectionPopup';
import Toast from '@/components/Toast';
import { Block, Connection, BlockColor, ToolType, ConnectionPosition, Message, ChatItem, Highlight } from '@/lib/types';

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: 'What are the key parameters for improving fuel efficiency in an internal combustion engine?',
  },
  {
    id: '2',
    role: 'assistant',
    content: `Key parameters for fuel efficiency:

1. Air-Fuel Ratio (AFR) - Stoichiometric ratio is 14.7:1. Lean burn can reach 20:1.

2. Compression Ratio - Higher ratios (12:1+) increase efficiency but need premium fuel.

3. Ignition Timing - Optimal spark advance varies with RPM and load.

4. Variable Valve Timing (VVT) - Optimizes across RPM range.

5. Friction Reduction - Can reduce losses by 5-10%.`,
  },
  {
    id: '3',
    role: 'user',
    content: 'What about turbocharging vs supercharging?',
  },
  {
    id: '4',
    role: 'assistant',
    content: `Turbocharger: Uses exhaust energy (free power), better cruise efficiency, but has turbo lag.

Supercharger: Instant response but parasitic belt-driven loss.

For efficiency: Turbo wins - Modern twin-scroll turbos minimize lag with 15-25% efficiency gains.`,
  },
];

const initialChats: ChatItem[] = [
  { id: '1', title: 'Engine Optimization', preview: 'Fuel efficiency parameters...', active: true },
  { id: '2', title: 'Wedding Planning', preview: 'Venue options...' },
];

export default function Home() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('text');
  const [zoom, setZoom] = useState(1);
  const [messages] = useState<Message[]>(initialMessages);
  const [chats] = useState<ChatItem[]>(initialChats);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  
  // Selection popup state
  const [selectionPopup, setSelectionPopup] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
    messageId: string;
    startOffset: number;
    endOffset: number;
  }>({ visible: false, x: 0, y: 0, text: '', messageId: '', startOffset: 0, endOffset: 0 });

  const blockIdRef = useRef(0);
  const highlightIdRef = useRef(0);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  }, []);

  const addBlock = useCallback((text: string, color: BlockColor, x?: number, y?: number) => {
    const id = `block-${++blockIdRef.current}`;
    let posX = x;
    let posY = y;
    
    if (posX === undefined || posY === undefined) {
      const col = blocks.length % 3;
      const row = Math.floor(blocks.length / 3);
      posX = 30 + col * 210;
      posY = 30 + row * 130;
    }
    
    const newBlock: Block = { id, text, color, x: posX, y: posY };
    setBlocks(prev => [...prev, newBlock]);
    showToast('Added to canvas!');
  }, [blocks.length, showToast]);

  const addHighlight = useCallback((
    messageId: string,
    text: string,
    color: BlockColor,
    startOffset: number,
    endOffset: number
  ) => {
    const id = `highlight-${++highlightIdRef.current}`;
    const newHighlight: Highlight = {
      id,
      messageId,
      text,
      color,
      startOffset,
      endOffset,
    };
    setHighlights(prev => [...prev, newHighlight]);
  }, []);

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const addConnection = useCallback((
    fromId: string,
    fromPos: ConnectionPosition,
    toId: string,
    toPos: ConnectionPosition
  ) => {
    const exists = connections.some(
      c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
    );
    if (!exists) {
      const fromBlock = blocks.find(b => b.id === fromId);
      const newConnection: Connection = {
        from: fromId,
        fromPos,
        to: toId,
        toPos,
        color: fromBlock?.color || 'blue',
      };
      setConnections(prev => [...prev, newConnection]);
      showToast('Connected!');
    }
  }, [blocks, connections, showToast]);

  const clearCanvas = useCallback(() => {
    if (confirm('Clear canvas?')) {
      setBlocks([]);
      setConnections([]);
      setHighlights([]);
    }
  }, []);

  const handleTextSelection = useCallback((
    text: string,
    rect: DOMRect,
    messageId: string,
    startOffset: number,
    endOffset: number
  ) => {
    if (text.length > 0 && text.length < 500) {
      setSelectionPopup({
        visible: true,
        x: Math.max(10, rect.left + rect.width / 2 - 120),
        y: rect.top - 50,
        text,
        messageId,
        startOffset,
        endOffset,
      });
    }
  }, []);

  const handleSelectionPopupColorClick = useCallback((color: BlockColor) => {
    if (selectionPopup.text) {
      // Add block to canvas
      addBlock(selectionPopup.text, color);
      
      // Add highlight to the chat message
      if (selectionPopup.messageId) {
        addHighlight(
          selectionPopup.messageId,
          selectionPopup.text,
          color,
          selectionPopup.startOffset,
          selectionPopup.endOffset
        );
      }
      
      setSelectionPopup(prev => ({ ...prev, visible: false }));
    }
  }, [selectionPopup, addBlock, addHighlight]);

  const handleCopyClick = useCallback(() => {
    navigator.clipboard.writeText(selectionPopup.text);
    showToast('Copied!');
    setSelectionPopup(prev => ({ ...prev, visible: false }));
  }, [selectionPopup.text, showToast]);

  const exportJson = useCallback(() => {
    const data = { blocks, connections, highlights };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'canvas.json';
    a.click();
    showToast('Saved!');
  }, [blocks, connections, highlights, showToast]);

  // Hide selection popup on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const popup = document.getElementById('selection-popup');
      if (popup && !popup.contains(e.target as Node)) {
        setSelectionPopup(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  return (
    <>
      <StatusBar />
      <MainToolbar
        onToggleSidebar={() => setSidebarVisible(prev => !prev)}
      />
      <div className="main-content">
        {sidebarVisible && <LeftSidebar chats={chats} />}
        <ChatView
          messages={messages}
          highlights={highlights}
          onTextSelection={handleTextSelection}
        />
        <CanvasPanel
          blocks={blocks}
          connections={connections}
          selectedBlock={selectedBlock}
          currentTool={currentTool}
          zoom={zoom}
          onSetTool={setCurrentTool}
          onAddBlock={addBlock}
          onUpdateBlock={updateBlock}
          onDeleteBlock={deleteBlock}
          onSelectBlock={setSelectedBlock}
          onAddConnection={addConnection}
          onClearCanvas={clearCanvas}
          onZoomIn={() => setZoom(z => Math.min(2, z + 0.1))}
          onZoomOut={() => setZoom(z => Math.max(0.5, z - 0.1))}
          onExport={exportJson}
        />
      </div>
      <SelectionPopup
        visible={selectionPopup.visible}
        x={selectionPopup.x}
        y={selectionPopup.y}
        onColorClick={handleSelectionPopupColorClick}
        onCopyClick={handleCopyClick}
      />
      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
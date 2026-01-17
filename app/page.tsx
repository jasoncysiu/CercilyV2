'use client';

import { useState, useRef, useCallback } from 'react';
import StatusBar from '@/components/StatusBar';
import MainToolbar from '@/components/MainToolbar';
import CanvasPanel from '@/components/CanvasPanel';
import Toast from '@/components/Toast';
import { Block, Connection, BlockColor, ToolType, ConnectionPosition } from '@/lib/types';

export default function Home() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('text');
  const [zoom, setZoom] = useState(1);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  
  const blockIdRef = useRef(0);

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
    setBlocks(prevBlocks => [...prevBlocks, newBlock]);
    showToast('Added to canvas!');
  }, [blocks, showToast]);

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    setBlocks(prevBlocks => prevBlocks.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setConnections(prevConnections => prevConnections.filter(c => c.from !== id && c.to !== id));
    setBlocks(prevBlocks => prevBlocks.filter(b => b.id !== id));
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
      setConnections(prevConnections => [...prevConnections, newConnection]);
      showToast('Connected!');
    }
  }, [blocks, connections, showToast]);

  const clearCanvas = useCallback(() => {
    if (confirm('Clear canvas?')) {
      setBlocks([]);
      setConnections([]);
    }
  }, []);

  const exportJson = useCallback(() => {
    const data = { blocks, connections };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `canvas_brainstorm.json`;
    a.click();
    showToast('Saved!');
  }, [blocks, connections, showToast]);

  return (
    <>
      <StatusBar />
      <MainToolbar
        chatTitle="Canvas Brainstorm"
      />
      <div className="main-content">
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
      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
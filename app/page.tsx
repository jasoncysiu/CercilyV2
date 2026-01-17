'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import StatusBar from '@/components/StatusBar';
import MainToolbar from '@/components/MainToolbar';
import LeftSidebar from '@/components/LeftSidebar';
import ChatView from '@/components/ChatView';
import CanvasPanel from '@/components/CanvasPanel';
import SelectionPopup from '@/components/SelectionPopup';
import Toast from '@/components/Toast';
import RemoveHighlightPopup from '@/components/RemoveHighlightPopup';
import SettingsPanel from '@/components/SettingsPanel'; // Import the new SettingsPanel
import { Block, Connection, BlockColor, ToolType, ConnectionPosition, Message, ChatItem, Highlight, ChatData } from '@/lib/types';

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

export default function Home() {
  const [currentChatId, setCurrentChatId] = useState<string>('chat-1');
  const [chatsData, setChatsData] = useState<Record<string, ChatData>>({
    'chat-1': {
      title: 'Engine Optimization',
      preview: 'Fuel efficiency parameters...',
      messages: initialMessages,
      blocks: [],
      connections: [],
      highlights: [],
    },
    'chat-2': {
      title: 'Wedding Planning',
      preview: 'Venue options...',
      messages: [{ id: '5', role: 'user', content: 'What are some good wedding venues?' }],
      blocks: [],
      connections: [],
      highlights: [],
    },
  });

  // Derived state for the currently active chat
  const currentChat = chatsData[currentChatId];
  const messages = currentChat.messages;
  const blocks = currentChat.blocks;
  const connections = currentChat.connections;
  const highlights = currentChat.highlights;

  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('text');
  const [zoom, setZoom] = useState(1);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Model selection states
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>(['gemini-2.5-pro']); // Default to gemini-2.5-pro
  const [activeChatModel, setActiveChatModel] = useState<string>('gemini-2.5-pro'); // The model currently used for chat

  // Ensure activeChatModel is always one of the available models
  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.includes(activeChatModel)) {
      setActiveChatModel(availableModels[0]);
    } else if (availableModels.length === 0) {
      setActiveChatModel(''); // No model available
    }
  }, [availableModels, activeChatModel]);

  // Selection popup state (for adding new blocks/highlights)
  const [selectionPopup, setSelectionPopup] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
    messageId: string;
    startOffset: number;
    endOffset: number;
  }>({ visible: false, x: 0, y: 0, text: '', messageId: '', startOffset: 0, endOffset: 0 });

  // Remove highlight popup state
  const [removeHighlightPopup, setRemoveHighlightPopup] = useState<{
    visible: boolean;
    x: number;
    y: number;
    highlightId: string | null;
  }>({ visible: false, x: 0, y: 0, highlightId: null });

  const blockIdRef = useRef(0);
  const highlightIdRef = useRef(0);
  const messageIdRef = useRef(initialMessages.length); // To generate unique message IDs

  // Helper to update the current chat's data
  const updateCurrentChatData = useCallback((updates: Partial<ChatData>) => {
    setChatsData(prev => ({
      ...prev,
      [currentChatId]: {
        ...prev[currentChatId],
        ...updates,
      },
    }));
  }, [currentChatId]);

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
    updateCurrentChatData({ blocks: [...blocks, newBlock] });
    showToast('Added to canvas!');
  }, [blocks, showToast, updateCurrentChatData]);

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
    updateCurrentChatData({ highlights: [...highlights, newHighlight] });
  }, [highlights, updateCurrentChatData]);

  const removeHighlight = useCallback((id: string) => {
    updateCurrentChatData({ highlights: highlights.filter(h => h.id !== id) });
    showToast('Highlight removed!');
  }, [highlights, showToast, updateCurrentChatData]);

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    updateCurrentChatData({ blocks: blocks.map(b => b.id === id ? { ...b, ...updates } : b) });
  }, [blocks, updateCurrentChatData]);

  const deleteBlock = useCallback((id: string) => {
    updateCurrentChatData({
      connections: connections.filter(c => c.from !== id && c.to !== id),
      blocks: blocks.filter(b => b.id !== id),
    });
  }, [blocks, connections, updateCurrentChatData]);

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
      updateCurrentChatData({ connections: [...connections, newConnection] });
      showToast('Connected!');
    }
  }, [blocks, connections, showToast, updateCurrentChatData]);

  const clearCanvas = useCallback(() => {
    if (confirm('Clear canvas?')) {
      updateCurrentChatData({ blocks: [], connections: [], highlights: [] });
    }
  }, [updateCurrentChatData]);

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
      setRemoveHighlightPopup(prev => ({ ...prev, visible: false })); // Hide remove popup
    }
  }, []);

  const handleHighlightClick = useCallback((highlightId: string, rect: DOMRect) => {
    setRemoveHighlightPopup({
      visible: true,
      x: Math.max(10, rect.left + rect.width / 2 - 20), // Position near the clicked highlight
      y: rect.top - 40,
      highlightId,
    });
    setSelectionPopup(prev => ({ ...prev, visible: false })); // Hide selection popup
  }, []);

  const handleSelectionPopupColorClick = useCallback((color: BlockColor) => {
    if (selectionPopup.text) {
      addBlock(selectionPopup.text, color);
      
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
    a.download = `${currentChat.title.replace(/\s/g, '_')}_canvas.json`;
    a.click();
    showToast('Saved!');
  }, [blocks, connections, highlights, showToast, currentChat.title]);

  // Function to send a new message to the AI
  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSendingMessage || !activeChatModel) return;

    setIsSendingMessage(true);
    const newUserMessage: Message = {
      id: `msg-${++messageIdRef.current}`,
      role: 'user',
      content: content.trim(),
    };

    // Add user message immediately
    setChatsData(prevChats => ({
      ...prevChats,
      [currentChatId]: {
        ...prevChats[currentChatId],
        messages: [...prevChats[currentChatId].messages, newUserMessage],
      },
    }));

    // Update chat preview
    updateCurrentChatData({ preview: content.trim().slice(0, 50) + '...' });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send full history including the newly added user message for context
        body: JSON.stringify({
          messages: [...chatsData[currentChatId].messages, newUserMessage],
          modelName: activeChatModel, // Send the active model name
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('AI Response Content:', data.content); // Log the AI response content
      const aiResponse: Message = {
        id: `msg-${++messageIdRef.current}`,
        role: 'assistant',
        content: data.content,
      };
      
      // Add AI message using a functional update to ensure latest messages state
      setChatsData(prevChats => ({
        ...prevChats,
        [currentChatId]: {
          ...prevChats[currentChatId],
          messages: [...prevChats[currentChatId].messages, aiResponse],
        },
      }));

    } catch (error) {
      console.error('Error sending message to AI:', error);
      showToast('Failed to get AI response. Please try again.');
      // If AI failed to respond, remove the user message that was already added.
      setChatsData(prevChats => ({
        ...prevChats,
        [currentChatId]: {
          ...prevChats[currentChatId],
          messages: prevChats[currentChatId].messages.filter(msg => msg.id !== newUserMessage.id),
        },
      }));
    } finally {
      setIsSendingMessage(false);
    }
  }, [currentChatId, isSendingMessage, showToast, updateCurrentChatData, chatsData, activeChatModel]);

  const handleNewChat = useCallback(() => {
    const newChatId = `chat-${Object.keys(chatsData).length + 1}`;
    setChatsData(prev => ({
      ...prev,
      [newChatId]: {
        title: `New Chat ${Object.keys(chatsData).length + 1}`,
        preview: 'Empty chat...',
        messages: [],
        blocks: [],
        connections: [],
        highlights: [],
      },
    }));
    setCurrentChatId(newChatId);
    setSelectedBlock(null); // Clear selected block when switching chats
    setCurrentTool('text'); // Reset tool
    setZoom(1); // Reset zoom
    showToast('New chat created!');
  }, [chatsData, showToast]);

  const handleSelectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
    setSelectedBlock(null); // Clear selected block when switching chats
    setCurrentTool('text'); // Reset tool
    setZoom(1); // Reset zoom
  }, []);

  // Hide popups on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const selectionPopupEl = document.getElementById('selection-popup');
      const removeHighlightPopupEl = document.getElementById('remove-highlight-popup');

      if (selectionPopupEl && !selectionPopupEl.contains(e.target as Node)) {
        setSelectionPopup(prev => ({ ...prev, visible: false }));
      }
      if (removeHighlightPopupEl && !removeHighlightPopupEl.contains(e.target as Node)) {
        setRemoveHighlightPopup(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Prepare chat items for LeftSidebar
  const chatItems: ChatItem[] = Object.entries(chatsData).map(([id, data]) => ({
    id,
    title: data.title,
    preview: data.preview,
    active: id === currentChatId,
  }));

  return (
    <>
      <StatusBar />
      <MainToolbar
        onToggleSidebar={() => setSidebarVisible(prev => !prev)}
        onNewChat={handleNewChat}
        chatTitle={currentChat.title}
        availableModels={availableModels}
        activeChatModel={activeChatModel}
        onSetActiveChatModel={setActiveChatModel}
        onOpenSettings={() => setShowSettingsPanel(true)}
      />
      <div className="main-content">
        {sidebarVisible && (
          <LeftSidebar
            chats={chatItems}
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
          />
        )}
        <ChatView
          key={currentChatId}
          messages={messages}
          highlights={highlights}
          onTextSelection={handleTextSelection}
          onHighlightClick={handleHighlightClick}
          onSendMessage={handleSendMessage}
          isSendingMessage={isSendingMessage}
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
      <RemoveHighlightPopup
        visible={removeHighlightPopup.visible}
        x={removeHighlightPopup.x}
        y={removeHighlightPopup.y}
        onRemove={() => {
          if (removeHighlightPopup.highlightId) {
            removeHighlight(removeHighlightPopup.highlightId);
            setRemoveHighlightPopup(prev => ({ ...prev, visible: false }));
          }
        }}
        onClose={() => setRemoveHighlightPopup(prev => ({ ...prev, visible: false }))}
      />
      <Toast message={toastMessage} visible={toastVisible} />
      <SettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        availableModels={availableModels}
        onSelectAvailableModels={setAvailableModels}
      />
    </>
  );
}
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import MainToolbar from '@/components/MainToolbar';
import LeftSidebar from '@/components/LeftSidebar';
import ChatView from '@/components/ChatView';
import CanvasPanel from '@/components/CanvasPanel';
import SelectionPopup from '@/components/SelectionPopup';
import Toast from '@/components/Toast';
import RemoveHighlightPopup from '@/components/RemoveHighlightPopup';
import SettingsPanel from '@/components/SettingsPanel';
import ResizeHandle from '@/components/ResizeHandle';
import ProjectContextModal from '@/components/ProjectContextModal';
import { Block, Connection, BlockColor, ToolType, ConnectionPosition, Message, ChatItem, Highlight, ChatData, Project, ProjectItem } from '@/lib/types';

// Cache keys for localStorage
const CACHE_KEY_PROJECTS = 'cercily-cache-projects';
const CACHE_KEY_CHATS = 'cercily-cache-chats';
const CACHE_KEY_TIMESTAMP = 'cercily-cache-timestamp';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache validity

const sleepProblemMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: "I'm always tired. I go to bed at like 1 AM and then I can't wake up for my 8 AM meeting. Is something wrong with me?",
  },
  {
    id: '2',
    role: 'assistant',
    content: "It sounds like your body's clock is just a bit confused! Here are the most common reasons why people struggle with sleep in daily life:\n\n1. Late-night scrolling: Blue light from your phone tricks your brain into thinking it is daytime.\n2. Social Jetlag: Staying up late and sleeping in on weekends messes with your internal rhythm.\n3. Caffeine: Drinking coffee or energy drinks too late in the afternoon.\n4. Stress: Thinking about work or your to-do list right before you close your eyes.\n5. Inconsistent schedule: Going to bed at a different time every single night.",
  },
];

const sleepSolutionMessages: Message[] = [
  {
    id: 's1',
    role: 'user',
    content: "How can I actually get better sleep without buying expensive sleep trackers or blackout curtains?",
  },
  {
    id: 's2',
    role: 'assistant',
    content: "You can reach 'Super Sleep' with simple daily habits!\n\n1. The 3-2-1 Rule: Stop eating 3 hours before bed, stop working 2 hours before, and stop looking at screens 1 hour before.\n2. Morning Light: Get 5-10 minutes of sunlight right after you wake up. It 'resets' your internal clock.\n3. Cool Room: Your body needs to drop its temperature to fall asleep, so crack a window or turn down the heat.\n4. Consistency: Try to wake up at the same time every day, even on weekends.",
  },
];

export default function Home() {
  const [currentChatId, setCurrentChatId] = useState<string>('');
  const [currentProjectId, setCurrentProjectId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [chatsData, setChatsData] = useState<Record<string, ChatData>>({});

  // Projects map project id -> Project
  const [projects, setProjects] = useState<Record<string, Project>>({});

  // Track pending saves for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<{ chatId: string; data: ChatData } | null>(null);

  // Helper to save data to cache
  const saveToCache = useCallback((projectsData: Record<string, Project>, chatsDataToCache: Record<string, ChatData>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CACHE_KEY_PROJECTS, JSON.stringify(projectsData));
      localStorage.setItem(CACHE_KEY_CHATS, JSON.stringify(chatsDataToCache));
      localStorage.setItem(CACHE_KEY_TIMESTAMP, Date.now().toString());
    } catch (e) {
      console.warn('Failed to save to cache:', e);
    }
  }, []);

  // Helper to load data from cache
  const loadFromCache = useCallback((): { projects: Record<string, Project>; chats: Record<string, ChatData>; isValid: boolean } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const projectsStr = localStorage.getItem(CACHE_KEY_PROJECTS);
      const chatsStr = localStorage.getItem(CACHE_KEY_CHATS);
      const timestampStr = localStorage.getItem(CACHE_KEY_TIMESTAMP);

      if (!projectsStr || !chatsStr || !timestampStr) return null;

      const timestamp = parseInt(timestampStr, 10);
      const isValid = Date.now() - timestamp < CACHE_TTL_MS;

      return {
        projects: JSON.parse(projectsStr),
        chats: JSON.parse(chatsStr),
        isValid,
      };
    } catch (e) {
      console.warn('Failed to load from cache:', e);
      return null;
    }
  }, []);

  // Fetch data from Notion on mount (with cache)
  useEffect(() => {
    const fetchData = async () => {
      // Try loading from cache first
      const cached = loadFromCache();
      if (cached && Object.keys(cached.projects).length > 0) {
        // Use cached data immediately
        setProjects(cached.projects);
        setChatsData(cached.chats);

        const firstProjectId = Object.keys(cached.projects)[0];
        const firstChatId = cached.projects[firstProjectId]?.chatIds?.[0];
        setCurrentProjectId(firstProjectId);
        if (firstChatId) {
          setCurrentChatId(firstChatId);
        }
        setIsLoading(false);

        // If cache is still valid, skip Notion fetch
        if (cached.isValid) {
          console.log('Using valid cache, skipping Notion fetch');
          return;
        }

        // Cache is stale, fetch from Notion in background
        console.log('Cache stale, refreshing from Notion in background...');
      }

      try {
        if (!cached) setIsLoading(true);

        const [projectsRes, chatsRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/chats'),
        ]);

        if (!projectsRes.ok || !chatsRes.ok) {
          throw new Error('Failed to fetch data from Notion');
        }

        const projectsData = await projectsRes.json();
        const chatsDataFromApi = await chatsRes.json();

        // If no projects exist, create a default one
        if (Object.keys(projectsData).length === 0) {
          const newProjectRes = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Default Project' }),
          });
          const newProject = await newProjectRes.json();

          // Create a default chat in the new project
          const newChatRes = await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: newProject.id, title: 'New Chat' }),
          });
          const newChat = await newChatRes.json();

          const newProjects = {
            [newProject.id]: {
              ...newProject,
              chatIds: [newChat.id],
            },
          };
          const newChats = {
            [newChat.id]: newChat.chatData,
          };

          setProjects(newProjects);
          setChatsData(newChats);
          setCurrentProjectId(newProject.id);
          setCurrentChatId(newChat.id);

          // Save to cache
          saveToCache(newProjects, newChats);
        } else {
          // Transform chats data to remove the extra fields
          const transformedChats: Record<string, ChatData> = {};
          Object.entries(chatsDataFromApi).forEach(([id, chat]: [string, any]) => {
            transformedChats[id] = {
              title: chat.title,
              preview: chat.preview,
              messages: chat.messages,
              blocks: chat.blocks,
              connections: chat.connections,
              highlights: chat.highlights,
            };
          });

          setProjects(projectsData);
          setChatsData(transformedChats);

          // Save to cache
          saveToCache(projectsData, transformedChats);

          // Set current project and chat to first available (only if not already set from cache)
          if (!cached) {
            const firstProjectId = Object.keys(projectsData)[0];
            const firstChatId = projectsData[firstProjectId]?.chatIds?.[0];
            setCurrentProjectId(firstProjectId);
            if (firstChatId) {
              setCurrentChatId(firstChatId);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data from Notion:', error);
        // Only show fallback if we don't have cached data
        if (!cached) {
          setChatsData({
            'demo-chat-1': {
              title: 'Demo Chat',
              preview: 'Notion connection failed...',
              messages: sleepProblemMessages,
              blocks: [],
              connections: [],
              highlights: [],
            },
          });
          setProjects({
            'demo-project-1': {
              id: 'demo-project-1',
              title: 'Demo Project',
              chatIds: ['demo-chat-1'],
            },
          });
          setCurrentProjectId('demo-project-1');
          setCurrentChatId('demo-chat-1');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [loadFromCache, saveToCache]);

  // Auto-save chat data to Notion (debounced)
  const saveToNotion = useCallback(async (chatId: string, data: ChatData) => {
    if (chatId.startsWith('demo-')) return; // Skip demo data

    try {
      setIsSaving(true);
      await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Error saving to Notion:', error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Keep cache in sync with state changes (debounced)
  const cacheUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (Object.keys(projects).length === 0) return;

    // Debounce cache updates to avoid excessive writes
    if (cacheUpdateTimeoutRef.current) {
      clearTimeout(cacheUpdateTimeoutRef.current);
    }
    cacheUpdateTimeoutRef.current = setTimeout(() => {
      saveToCache(projects, chatsData);
    }, 500);

    return () => {
      if (cacheUpdateTimeoutRef.current) {
        clearTimeout(cacheUpdateTimeoutRef.current);
      }
    };
  }, [projects, chatsData, isLoading, saveToCache]);

  // Debounced save effect
  useEffect(() => {
    if (!currentChatId || !chatsData[currentChatId] || isLoading) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveToNotion(currentChatId, chatsData[currentChatId]);
    }, 1000); // Save 1 second after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentChatId, chatsData, isLoading, saveToNotion]);

  // Derived state for the currently active chat
  const currentChat = chatsData[currentChatId] || { title: '', preview: '', messages: [], blocks: [], connections: [], highlights: [] };
  const messages = currentChat.messages || [];
  const blocks = currentChat.blocks || [];
  const connections = currentChat.connections || [];
  const highlights = currentChat.highlights || [];

  // For the canvas we show all blocks/connections/highlights within the current project
  const projectChatIds = projects[currentProjectId]?.chatIds || [];
  const displayedBlocks = projectChatIds.flatMap(id => (chatsData[id]?.blocks || []).map(b => ({ ...b, chatId: id })));
  const displayedConnections = projectChatIds.flatMap(id => (chatsData[id]?.connections || []));

  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('text');
  const [zoom, setZoom] = useState(1);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [highlightColor, setHighlightColor] = useState<BlockColor>('yellow');
  const [chatPaneWidth, setChatPaneWidth] = useState(50); // Percentage width
  
  // Model selection states
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]); // Initialize as empty
  const [activeChatModel, setActiveChatModel] = useState<string>(''); // Initialize as empty
  const [showOutline, setShowOutline] = useState(false);

  // Project context modal state
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [contextModalProjectId, setContextModalProjectId] = useState<string>('');

  // Toggle for including project context in chat
  const [includeContext, setIncludeContext] = useState(true);


  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  }, []);

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const generativeModelNames = data
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name);
        
        setAvailableModels(generativeModelNames);
        if (generativeModelNames.length > 0) {
          // Prioritize 'models/gemini-2.5-pro', then 'models/gemini-3-pro-preview', otherwise pick the first one
          const preferredModel = generativeModelNames.find((name: string) => name === 'models/gemini-2.5-pro');
          const fallbackModel = generativeModelNames.find((name: string) => name === 'models/gemini-3-pro-preview');
          setActiveChatModel(preferredModel || fallbackModel || generativeModelNames[0] || '');
        } else {
          showToast('No generative AI models found. Check your API key and server logs.');
          setActiveChatModel(''); // Explicitly set to empty if no models found
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
        showToast('Failed to load models. Check API key and server logs.');
        setActiveChatModel(''); // Ensure activeChatModel is cleared on error
      }
    };
    fetchModels();
  }, [showToast]);

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
  const messageIdRef = useRef(100); // To generate unique message IDs

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

  const addBlock = useCallback((
    text: string,
    color: BlockColor,
    x?: number,
    y?: number,
    isEditing?: boolean,
    messageId?: string,
    startOffset?: number,
    endOffset?: number
  ) => {
    const id = `block-${++blockIdRef.current}`;
    let posX = x;
    let posY = y;
    
    if (posX === undefined || posY === undefined) {
      const col = blocks.length % 3;
      const row = Math.floor(blocks.length / 3);
      posX = 30 + col * 210;
      posY = 30 + row * 130;
    }
    
    const newBlock: Block = {
      id,
      text,
      color,
      x: posX,
      y: posY,
      chatId: currentChatId,
      messageId,
      startOffset,
      endOffset,
      isEditing: isEditing || false,
    };
    updateCurrentChatData({ blocks: [...blocks, newBlock] });
    showToast('Added to canvas!');
  }, [blocks, showToast, updateCurrentChatData, currentChatId]);

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
    setChatsData(prev => {
      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        const block = chat.blocks.find(b => b.id === id);
        if (!block) {
          updated[chatId] = chat;
          return;
        }

        const newBlock = { ...block, ...updates };
        const updatedBlocks = chat.blocks.map(b => b.id === id ? newBlock : b);
        
        // If movement is detected, auto-snap connection points
        let updatedConnections = chat.connections;
        if (updates.x !== undefined || updates.y !== undefined) {
          const blockMap = new Map(updatedBlocks.map(b => [b.id, b]));
          updatedConnections = chat.connections.map(conn => {
            if (conn.from === id || conn.to === id) {
              const b1 = blockMap.get(conn.from);
              const b2 = blockMap.get(conn.to);
              if (b1 && b2) {
                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                let fromPos = conn.fromPos;
                let toPos = conn.toPos;
                
                // Determine best side based on vector between blocks
                if (Math.abs(dx) > Math.abs(dy)) {
                  fromPos = dx > 0 ? 'right' : 'left';
                  toPos = dx > 0 ? 'left' : 'right';
                } else {
                  fromPos = dy > 0 ? 'bottom' : 'top';
                  toPos = dy > 0 ? 'top' : 'bottom';
                }
                return { ...conn, fromPos, toPos };
              }
            }
            return conn;
          });
        }

        updated[chatId] = {
          ...chat,
          blocks: updatedBlocks,
          connections: updatedConnections,
        };
      });
      return updated;
    });
  }, []);


  const deleteBlock = useCallback((id: string) => {
    // Find which chat this block belongs to and delete it from there
    setChatsData(prev => {
      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        updated[chatId] = {
          ...chat,
          blocks: chat.blocks.filter(b => b.id !== id),
          connections: chat.connections.filter(c => c.from !== id && c.to !== id),
        };
      });
      return updated;
    });
  }, []);

  const deleteBlocks = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setChatsData(prev => {
      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        updated[chatId] = {
          ...chat,
          blocks: chat.blocks.filter(b => !idSet.has(b.id)),
          connections: chat.connections.filter(c => !idSet.has(c.from) && !idSet.has(c.to)),
        };
      });
      return updated;
    });
    showToast(`Deleted ${ids.length} blocks`);
  }, [showToast]);


  const toggleCollapse = useCallback((id: string) => {
    setChatsData(prev => {
      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        // Find the block in this chat
        const blockIndex = chat.blocks.findIndex(b => b.id === id);
        if (blockIndex === -1) {
          updated[chatId] = chat;
          return;
        }

        // Deep copy blocks to safely mutate
        const newBlocks = chat.blocks.map(b => ({ ...b }));
        const blocksMap = new Map(newBlocks.map(b => [b.id, b]));
        const currentBlock = blocksMap.get(id)!;
        
        const isNowCollapsed = !currentBlock.isCollapsed;
        currentBlock.isCollapsed = isNowCollapsed;

        const connections = chat.connections;
        const getChildrenIds = (pid: string) => connections.filter(c => c.from === pid).map(c => c.to);

        // Visited set to prevent infinite loops in cyclic graphs
        const visited = new Set<string>();

        const updateVisibility = (parentId: string, shouldHide: boolean) => {
           if (visited.has(parentId)) return;
           visited.add(parentId);

           const childrenIds = getChildrenIds(parentId);
           childrenIds.forEach(childId => {
             const child = blocksMap.get(childId);
             if (child) {
               if (shouldHide) {
                 // Hiding: Hide child and recursively hide its descendants
                 child.isHidden = true;
                 updateVisibility(childId, true);
               } else {
                 // Showing: Unhide child
                 child.isHidden = false;
                 // Only verify/show descendants if this child is NOT collapsed
                 if (!child.isCollapsed) {
                   updateVisibility(childId, false);
                 }
               }
             }
           });
        };

        // Start recursion from the toggled block
        updateVisibility(id, isNowCollapsed);

        updated[chatId] = {
          ...chat,
          blocks: newBlocks,
        };
      });
      return updated;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setChatsData(prev => {
      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        // Find all blocks that are destinations of a connection
        const childIds = new Set(chat.connections.map(c => c.to));
        
        updated[chatId] = {
          ...chat,
          blocks: chat.blocks.map(b => ({
            ...b,
            isCollapsed: true, // Collapse the node itself (show small preview)
            isHidden: childIds.has(b.id) // Hide if it is a child
          })),
        };
      });
      return updated;
    });
    setCurrentTool('select');
  }, [setCurrentTool]);

  const expandAll = useCallback(() => {
    setChatsData(prev => {
      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        updated[chatId] = {
          ...chat,
          blocks: chat.blocks.map(b => 
            ({ ...b, isCollapsed: false, isHidden: false })
          ),
        };
      });
      return updated;
    });
    setCurrentTool('select');
  }, [setCurrentTool]);

  const addConnection = useCallback((
    fromId: string,
    fromPos: ConnectionPosition,
    toId: string,
    toPos: ConnectionPosition
  ) => {
    const exists = connections.some(
      c => c.from === fromId && c.to === toId
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

  const deleteConnection = useCallback((fromId: string, toId: string) => {
    updateCurrentChatData({
      connections: connections.filter(c => !(c.from === fromId && c.to === toId))
    });
    showToast('Connection removed');
  }, [connections, updateCurrentChatData, showToast]);

  const mergeBlocks = useCallback((sourceId: string, targetId: string) => {
    // We need to look in displayedBlocks which combines all chats in project
    const sourceBlock = displayedBlocks.find(b => b.id === sourceId);
    const targetBlock = displayedBlocks.find(b => b.id === targetId);
    
    if (sourceBlock && targetBlock && sourceId !== targetId) {
      const mergedText = `${targetBlock.text}\n\n---\n\n${sourceBlock.text}`;
      
      // Update the target block and delete the source block
      updateBlock(targetId, { text: mergedText });
      deleteBlock(sourceId);
      
      showToast('Nodes merged successfully!');
    }
  }, [displayedBlocks, updateBlock, deleteBlock, showToast]);

  const clearCanvas = useCallback(() => {
    if (confirm('Clear canvas?')) {
      updateCurrentChatData({ blocks: [], connections: [], highlights: [] });
    }
  }, [updateCurrentChatData]);

  const rearrangeBlocks = useCallback((optimizeConnections = false) => {
    const projectChatIds = projects[currentProjectId]?.chatIds || [];
    const allBlocks = projectChatIds.flatMap(id => (chatsData[id]?.blocks || [])).filter(b => !b.isHidden);
    const allConnections = projectChatIds.flatMap(id => (chatsData[id]?.connections || []));

    if (allBlocks.length === 0) return;

    // Map parent -> children
    const childrenMap = new Map<string, string[]>();
    const parentOfMap = new Map<string, string[]>();
    
    allConnections.forEach(conn => {
      if (!childrenMap.has(conn.from)) childrenMap.set(conn.from, []);
      childrenMap.get(conn.from)!.push(conn.to);
      
      if (!parentOfMap.has(conn.to)) parentOfMap.set(conn.to, []);
      parentOfMap.get(conn.to)!.push(conn.from);
    });

    // Find roots (blocks that aren't children of any other visible block)
    const roots = allBlocks.filter(b => !parentOfMap.has(b.id));
    
    const newPositions = new Map<string, { x: number, y: number }>();
    const levelSpacing = 350; // Increased spacing for better readability
    const nodeSpacing = 160; 

    // 1. Calculate subtree heights
    const subtreeHeight = new Map<string, number>();
    const visited = new Set<string>();

    const calculateHeight = (nodeId: string): number => {
      // Prevent infinite loops in case of cycles
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) {
        subtreeHeight.set(nodeId, nodeSpacing);
        return nodeSpacing;
      }

      let h = 0;
      children.forEach(childId => {
        h += calculateHeight(childId);
      });
      
      // Ensure parent height is at least nodeSpacing
      const result = Math.max(h, nodeSpacing);
      subtreeHeight.set(nodeId, result);
      return result;
    };

    roots.forEach(root => {
      visited.clear();
      calculateHeight(root.id);
    });

    // 2. Position nodes
    let currentRootY = 100;
    const positionedCount = new Set<string>();

    const layoutNode = (nodeId: string, x: number, startY: number) => {
      if (positionedCount.has(nodeId)) return;
      positionedCount.add(nodeId);

      const h = subtreeHeight.get(nodeId) || nodeSpacing;
      const centerY = startY + h / 2 - 40; // Adjust for card height
      
      newPositions.set(nodeId, { x, y: centerY });

      let currentChildY = startY;
      const children = childrenMap.get(nodeId) || [];
      children.forEach(childId => {
        layoutNode(childId, x + levelSpacing, currentChildY);
        currentChildY += subtreeHeight.get(childId) || nodeSpacing;
      });
    };

    roots.forEach(root => {
      layoutNode(root.id, 100, currentRootY);
      currentRootY += (subtreeHeight.get(root.id) || nodeSpacing) + 100;
    });

    setChatsData(prev => {
      const updated = { ...prev };
      projectChatIds.forEach(cid => {
        if (updated[cid]) {
          const chat = updated[cid];
          const blocksWithNewPos = chat.blocks.map(b => {
            const pos = newPositions.get(b.id);
            return pos ? { ...b, x: pos.x, y: pos.y } : b;
          });
          
          const blockMap = new Map(blocksWithNewPos.map(b => [b.id, b]));

          updated[cid] = {
            ...chat,
            blocks: blocksWithNewPos,
            connections: chat.connections.map(conn => {
              if (!optimizeConnections) return conn;

              const b1 = blockMap.get(conn.from);
              const b2 = blockMap.get(conn.to);
              if (b1 && b2) {
                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                let fromPos = conn.fromPos;
                let toPos = conn.toPos;
                
                if (Math.abs(dx) > Math.abs(dy)) {
                  fromPos = dx > 0 ? 'right' : 'left';
                  toPos = dx > 0 ? 'left' : 'right';
                } else {
                  fromPos = dy > 0 ? 'bottom' : 'top';
                  toPos = dy > 0 ? 'top' : 'bottom';
                }
                return { ...conn, fromPos, toPos };
              }
              return conn;
            })
          };
        }
      });
      return updated;
    });

    setCurrentTool('select');
    showToast(optimizeConnections ? 'Rearranged with auto-flipped dots!' : 'Rearranged with parents on the left!');
  }, [currentProjectId, projects, chatsData, setCurrentTool, showToast]);



  const handleTextSelection = useCallback((
    text: string,
    rect: DOMRect,
    messageId: string,
    startOffset: number,
    endOffset: number
  ) => {
    if (text.length > 0 && text.length < 500) {
      // Check if this exact text is already highlighted
      const existingHighlight = highlights.find(
        h => h.messageId === messageId && h.startOffset === startOffset && h.endOffset === endOffset
      );

      if (existingHighlight) {
        // Remove the highlight if it already exists
        removeHighlight(existingHighlight.id);
      } else {
        // Add highlight with the current highlight color
        addHighlight(messageId, text, highlightColor, startOffset, endOffset);
        showToast(`Highlighted in ${highlightColor}!`);
      }

      // Show the popup to allow color change
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
  }, [highlights, highlightColor, addHighlight, removeHighlight, showToast]);

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
      addBlock(
        selectionPopup.text,
        color,
        undefined,
        undefined,
        false,
        selectionPopup.messageId,
        selectionPopup.startOffset,
        selectionPopup.endOffset
      );
      
      // Set the new highlight color for future selections
      setHighlightColor(color);
      
      // Update the existing highlight color if one exists
      if (selectionPopup.messageId) {
        const existingHighlight = highlights.find(
          h => h.messageId === selectionPopup.messageId && 
               h.startOffset === selectionPopup.startOffset && 
               h.endOffset === selectionPopup.endOffset
        );
        if (existingHighlight) {
          const updatedHighlights = highlights.map(h =>
            h.id === existingHighlight.id ? { ...h, color } : h
          );
          updateCurrentChatData({ highlights: updatedHighlights });
          showToast(`Highlight changed to ${color}!`);
        }
      }
      
      setSelectionPopup(prev => ({ ...prev, visible: false }));
    }
  }, [selectionPopup, highlights, addBlock, updateCurrentChatData, showToast]);

  const handleCopyClick = useCallback(() => {
    navigator.clipboard.writeText(selectionPopup.text);
    showToast('Copied!');
    setSelectionPopup(prev => ({ ...prev, visible: false }));
  }, [selectionPopup.text, showToast]);

  const exportJson = useCallback(() => {
    if (typeof document === 'undefined') return;
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
    if (!content.trim() || isSendingMessage || !activeChatModel) {
      if (!activeChatModel) {
        showToast('No active AI model selected. Please check settings.');
      }
      return;
    }

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
      // Get API key from localStorage
      const geminiApiKey = typeof window !== 'undefined'
        ? localStorage.getItem('cercily-gemini-api-key')
        : null;

      // Get project context if toggle is on
      const projectContext = includeContext
        ? projects[currentProjectId]?.context
        : undefined;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send full history including the newly added user message for context
        body: JSON.stringify({
          messages: [...chatsData[currentChatId].messages, newUserMessage],
          modelName: activeChatModel,
          apiKey: geminiApiKey,
          projectContext,
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
  }, [currentChatId, currentProjectId, isSendingMessage, showToast, updateCurrentChatData, chatsData, activeChatModel, includeContext, projects]);

  const handleNewChat = useCallback(async () => {
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProjectId,
          title: `New Chat ${Object.keys(chatsData).length + 1}`,
        }),
      });

      if (!response.ok) throw new Error('Failed to create chat');

      const { id: newChatId, chatData } = await response.json();

      setChatsData(prev => ({
        ...prev,
        [newChatId]: chatData,
      }));
      setCurrentChatId(newChatId);
      // Add new chat to the current project
      setProjects(prev => ({
        ...prev,
        [currentProjectId]: {
          ...prev[currentProjectId],
          chatIds: [...prev[currentProjectId].chatIds, newChatId],
        },
      }));
      setSelectedBlock(null);
      setCurrentTool('text');
      setZoom(1);
      showToast('New chat created!');
    } catch (error) {
      console.error('Error creating chat:', error);
      showToast('Failed to create chat');
    }
  }, [chatsData, showToast, currentProjectId]);

  const handleNewChatInProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: `New Chat ${Object.keys(chatsData).length + 1}`,
        }),
      });

      if (!response.ok) throw new Error('Failed to create chat');

      const { id: newChatId, chatData } = await response.json();

      setChatsData(prev => ({
        ...prev,
        [newChatId]: chatData,
      }));

      // Add new chat to the specified project
      setProjects(prev => ({
        ...prev,
        [projectId]: {
          ...prev[projectId],
          chatIds: [...prev[projectId].chatIds, newChatId],
        },
      }));

      // Switch to the new chat
      setCurrentChatId(newChatId);
      setSelectedBlock(null);
      setCurrentTool('text');
      setZoom(1);
      showToast('New chat created!');
    } catch (error) {
      console.error('Error creating chat:', error);
      showToast('Failed to create chat');
    }
  }, [chatsData, showToast]);

  const handleNewProject = useCallback(async () => {
    try {
      // Create new project
      const projectRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `New Project ${Object.keys(projects).length + 1}` }),
      });

      if (!projectRes.ok) throw new Error('Failed to create project');
      const newProject = await projectRes.json();

      // Create new chat for the project
      const chatRes = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: newProject.id, title: 'New Chat 1' }),
      });

      if (!chatRes.ok) throw new Error('Failed to create chat');
      const { id: newChatId, chatData } = await chatRes.json();

      setChatsData(prev => ({
        ...prev,
        [newChatId]: chatData,
      }));

      // Create new project with the chat
      setProjects(prev => ({
        ...prev,
        [newProject.id]: {
          ...newProject,
          chatIds: [newChatId],
        },
      }));

      // Switch to the new project and chat
      setCurrentProjectId(newProject.id);
      setCurrentChatId(newChatId);
      setSelectedBlock(null);
      setCurrentTool('text');
      setZoom(1);
      showToast('New project created!');
    } catch (error) {
      console.error('Error creating project:', error);
      showToast('Failed to create project');
    }
  }, [projects, showToast]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    try {
      // Delete from Notion
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });

      setProjects(prev => {
        const { [projectId]: removed, ...rest } = prev;

        // Remove chats belonging to this project from chatsData
        if (removed) {
          setChatsData(prevChats => {
            const updated = { ...prevChats };
            removed.chatIds.forEach(chatId => {
              delete updated[chatId];
            });
            return updated;
          });
        }

        // If no projects remain, create a default one
        if (Object.keys(rest).length === 0) {
          // This will trigger a re-fetch which will create a new default project
          window.location.reload();
          return rest;
        }

        // If the deleted project was active, switch to the first remaining project
        if (projectId === currentProjectId) {
          const firstProjectId = Object.keys(rest)[0];
          const firstChatId = rest[firstProjectId]?.chatIds[0];
          setCurrentProjectId(firstProjectId);
          if (firstChatId) {
            setCurrentChatId(firstChatId);
          }
        }

        return rest;
      });

      showToast('Project deleted');
    } catch (error) {
      console.error('Error deleting project:', error);
      showToast('Failed to delete project');
    }
  }, [currentProjectId, showToast]);

  const handleSelectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
    setSelectedBlock(null); // Clear selected block when switching chats
    setCurrentTool('text'); // Reset tool
    setZoom(1); // Reset zoom
  }, []);

  const handleBlockClickFromCanvas = useCallback((
    blockId: string,
    chatId?: string,
    messageId?: string,
    startOffset?: number,
    endOffset?: number
  ) => {
    // If a chatId is provided, switch to that chat
    if (chatId && chatId !== currentChatId) {
      handleSelectChat(chatId);
    }
    // Highlight the block
    setSelectedBlock(blockId);
    
    // If we have message location data, scroll to that text in the chat
    if (messageId && startOffset !== undefined && endOffset !== undefined) {
      // Use setTimeout to ensure DOM is ready after chat switch
      setTimeout(() => {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
          // Scroll message into view
          messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Highlight the specific text range
          const messageContent = messageEl.querySelector('.message-bubble');
          if (messageContent) {
            // Find all text nodes and reconstruct the text with selection
            const range = document.createRange();
            const selection = window.getSelection();
            
            // Walk through text nodes to find the exact position
            let charCount = 0;
            let startNode: Node | null = null;
            let endNode: Node | null = null;
            let startOffset2 = 0;
            let endOffset2 = 0;
            
            const walker = document.createTreeWalker(
              messageContent,
              NodeFilter.SHOW_TEXT,
              null
            );
            
            let node: Node | null = walker.nextNode();
            while (node) {
              const nodeLength = node.textContent?.length || 0;
              
              if (startNode === null && charCount + nodeLength > startOffset) {
                startNode = node;
                startOffset2 = startOffset - charCount;
              }
              
              if (charCount + nodeLength >= endOffset && endNode === null) {
                endNode = node;
                endOffset2 = endOffset - charCount;
                break;
              }
              
              charCount += nodeLength;
              node = walker.nextNode();
            }
            
            if (startNode && endNode && selection) {
              try {
                range.setStart(startNode, Math.min(startOffset2, startNode.textContent?.length || 0));
                range.setEnd(endNode, Math.min(endOffset2, endNode.textContent?.length || 0));
                selection.removeAllRanges();
                selection.addRange(range);
              } catch (e) {
                console.error('Failed to set text selection:', e);
              }
            }
          }
        }
      }, 100);
      
      showToast('Navigated to source location');
    } else {
      showToast('Click on the chat thread to highlight the source message');
    }
  }, [currentChatId, handleSelectChat, showToast]);

  const handleSelectProject = useCallback((projectId: string) => {
    // Switch to the project and its first chat
    const firstChatId = projects[projectId]?.chatIds[0];
    if (firstChatId) {
      setCurrentProjectId(projectId);
      setCurrentChatId(firstChatId);
      setSelectedBlock(null); // Clear selected block when switching projects
      setCurrentTool('text'); // Reset tool
      setZoom(1); // Reset zoom
    }
  }, [projects]);

  const handleRenameProject = useCallback(async (projectId: string, newTitle: string) => {
    if (newTitle.trim()) {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle.trim() }),
        });

        setProjects(prev => ({
          ...prev,
          [projectId]: {
            ...prev[projectId],
            title: newTitle.trim(),
          },
        }));
        showToast('Project renamed!');
      } catch (error) {
        console.error('Error renaming project:', error);
        showToast('Failed to rename project');
      }
    }
  }, [showToast]);

  const handleRenameChat = useCallback(async (chatId: string, newTitle: string) => {
    if (newTitle.trim()) {
      try {
        await fetch(`/api/chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle.trim() }),
        });

        setChatsData(prev => ({
          ...prev,
          [chatId]: {
            ...prev[chatId],
            title: newTitle.trim(),
          },
        }));
        showToast('Chat renamed!');
      } catch (error) {
        console.error('Error renaming chat:', error);
        showToast('Failed to rename chat');
      }
    }
  }, [showToast]);

  const handleOpenProjectContext = useCallback((projectId: string) => {
    setContextModalProjectId(projectId);
    setContextModalOpen(true);
  }, []);

  const handleSaveProjectContext = useCallback(async (projectId: string, context: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });

      setProjects(prev => ({
        ...prev,
        [projectId]: {
          ...prev[projectId],
          context,
        },
      }));
      showToast('Project context saved!');
    } catch (error) {
      console.error('Error saving project context:', error);
      showToast('Failed to save context');
    }
  }, [showToast]);

  const handleDeleteChat = useCallback(async (chatId: string) => {
    try {
      // Delete from Notion
      await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });

      setChatsData(prev => {
        const { [chatId]: _removed, ...rest } = prev;

        // If no chats remain in the project, create a fresh one
        const currentProjectChatIds = projects[currentProjectId]?.chatIds.filter(id => id !== chatId) || [];
        if (currentProjectChatIds.length === 0) {
          // Will need to create a new chat - handled below
        }

        // If the deleted chat was active, switch to the first remaining chat
        if (chatId === currentChatId) {
          const firstId = Object.keys(rest)[0];
          if (firstId) {
            setCurrentChatId(firstId);
          }
        }

        return rest;
      });

      // Also remove the chat from any project that contains it
      setProjects(prev => {
        const updated: Record<string, Project> = {};
        Object.entries(prev).forEach(([pid, p]) => {
          updated[pid] = { ...p, chatIds: p.chatIds.filter(id => id !== chatId) };
        });

        return updated;
      });

      showToast('Chat deleted');
    } catch (error) {
      console.error('Error deleting chat:', error);
      showToast('Failed to delete chat');
    }
  }, [currentChatId, currentProjectId, projects, showToast]);

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
  const projectItems: ProjectItem[] = Object.values(projects).map(p => ({
    id: p.id,
    title: p.title,
    context: p.context,
    chats: p.chatIds.map(id => ({
      id,
      title: chatsData[id]?.title || 'Untitled',
      preview: chatsData[id]?.preview || '',
      active: id === currentChatId,
    })),
  }));

  // Show loading screen while fetching data
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        color: 'var(--text-secondary)',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p>Loading from Notion...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <MainToolbar
        onToggleSidebar={() => setSidebarVisible(prev => !prev)}
        chatTitle={currentChat.title}
        availableModels={availableModels}
        activeChatModel={activeChatModel}
        onSetActiveChatModel={setActiveChatModel}
        onOpenSettings={() => setShowSettingsPanel(true)}
      />
      <div className="main-content">
        {sidebarVisible && (
          <LeftSidebar
            projects={projectItems}
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
            onSelectProject={handleSelectProject}
            onDeleteChat={handleDeleteChat}
            onNewProject={handleNewProject}
            onNewChat={handleNewChat}
            onDeleteProject={handleDeleteProject}
            onNewChatInProject={handleNewChatInProject}
            onRenameProject={handleRenameProject}
            onRenameChat={handleRenameChat}
            onOpenProjectContext={handleOpenProjectContext}
          />
        )}
        <div className="panes-container">
          <div className="chat-pane" style={{ width: `calc(${chatPaneWidth}% - 4px)` }}>
            <ChatView
              key={currentChatId}
              messages={messages}
              highlights={highlights}
              onTextSelection={handleTextSelection}
              onHighlightClick={handleHighlightClick}
              onSendMessage={handleSendMessage}
              isSendingMessage={isSendingMessage}
              includeContext={includeContext}
              onToggleContext={() => setIncludeContext(prev => !prev)}
              hasContext={!!projects[currentProjectId]?.context}
            />
          </div>
          <ResizeHandle
            onResize={(newLeftWidth) => {
              const container = document.querySelector('.main-content');
              if (container) {
                const containerWidth = container.clientWidth;
                const newPercentage = (newLeftWidth / containerWidth) * 100;
                setChatPaneWidth(newPercentage);
              }
            }}
            minLeftWidth={250}
            minRightWidth={250}
          />
          <div className="canvas-pane" style={{ width: `calc(${100 - chatPaneWidth}% - 4px)` }}>
            <CanvasPanel
              blocks={displayedBlocks}
              connections={displayedConnections}
              selectedBlock={selectedBlock}
              currentTool={currentTool}
              zoom={zoom}
              onSetTool={setCurrentTool}
              onAddBlock={addBlock}
              onUpdateBlock={updateBlock}
              onDeleteBlock={deleteBlock}
              onDeleteBlocks={deleteBlocks}
              onSelectBlock={setSelectedBlock}

              onBlockClick={handleBlockClickFromCanvas}
              onAddConnection={addConnection}
              onDeleteConnection={deleteConnection}
              onClearCanvas={clearCanvas}
              onZoomIn={() => setZoom(z => Math.min(2, z + 0.1))}
              onZoomOut={() => setZoom(z => Math.max(0.5, z - 0.1))}
              onExport={exportJson}
              onToggleCollapse={toggleCollapse}
              onCollapseAll={collapseAll}
              onExpandAll={expandAll}
              onZoomChange={setZoom}
              onMergeBlocks={mergeBlocks}
              onRearrange={rearrangeBlocks}
              showOutline={showOutline}
              onToggleOutline={() => setShowOutline(prev => !prev)}
            />
          </div>
        </div>
      </div>
      <SelectionPopup
        visible={selectionPopup.visible}
        x={selectionPopup.x}
        y={selectionPopup.y}
        onColorClick={handleSelectionPopupColorClick}
        onCopyClick={handleCopyClick}
        currentColor={highlightColor}
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
        onClose={() => setRemoveHighlightPopup(prev => ({ ...prev, visible: false }))} />
      <SettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        availableModels={availableModels}
        onSelectAvailableModels={setAvailableModels}
      />
      <ProjectContextModal
        isOpen={contextModalOpen}
        onClose={() => setContextModalOpen(false)}
        projectId={contextModalProjectId}
        projectTitle={projects[contextModalProjectId]?.title || ''}
        initialContext={projects[contextModalProjectId]?.context || ''}
        onSave={handleSaveProjectContext}
      />
    </>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import MainToolbar from '@/components/MainToolbar';
import LeftSidebar from '@/components/LeftSidebar';
import ChatView from '@/components/ChatView';
import CanvasPanel from '@/components/X6CanvasWrapper';
import SelectionPopup from '@/components/SelectionPopup';
import Toast from '@/components/Toast';
import RemoveHighlightPopup from '@/components/RemoveHighlightPopup';
import SettingsPanel from '@/components/SettingsPanel';
import ResizeHandle from '@/components/ResizeHandle';
import ProjectContextModal from '@/components/ProjectContextModal';
import CircularProgress from '@/components/CircularProgress';
import DecisionFlow from '@/components/DecisionFlow';
import SynthesisModal from '@/components/SynthesisModal';
import DecisionJournalView from '@/components/DecisionJournalView';
import ReviewModal from '@/components/ReviewModal';
import { Block, Connection, BlockColor, ToolType, ConnectionPosition, Message, ChatItem, Highlight, ChatData, Project, ProjectItem, DecisionData, ProjectWithDecision, SynthesisResult, SynthesizedDecision } from '@/lib/types';
import { generateId } from '@/lib/decisionStore';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';

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
  // Collect raw connections, then enforce single-parent constraint (first edge wins)
  const rawDisplayedConnections = projectChatIds.flatMap(id => (chatsData[id]?.connections || []));
  const displayedConnections = useMemo(() => {
    const parentSeen = new Set<string>();
    return rawDisplayedConnections.filter(conn => {
      if (parentSeen.has(conn.to)) return false; // child already has a parent — skip
      parentSeen.add(conn.to);
      return true;
    });
  }, [rawDisplayedConnections]);

  const { pushSnapshot, undo: canvasUndo, redo: canvasRedo, canUndo, canRedo } = useCanvasHistory(
    chatsData, setChatsData, projectChatIds, currentProjectId
  );

  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('text');
  const [zoom, setZoom] = useState(1);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [highlightColor, setHighlightColor] = useState<BlockColor>('blue');
  const [chatPaneWidth, setChatPaneWidth] = useState(50); // Percentage width
  const [isResizing, setIsResizing] = useState(false);
  
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

  // Custom decision prompt
  const [customDecisionPrompt, setCustomDecisionPrompt] = useState('');

  // Load custom decision prompt from localStorage on mount
  useEffect(() => {
    const savedPrompt = localStorage.getItem('cercily-decision-prompt');
    if (savedPrompt) setCustomDecisionPrompt(savedPrompt);
  }, []);

  // Decision mode state
  const [isDecisionMode, setIsDecisionMode] = useState(false);
  const [decisionNodeIds, setDecisionNodeIds] = useState<string[]>([]);

  // Synthesis modal state
  const [showSynthesisModal, setShowSynthesisModal] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Synthesized decisions stored locally (will persist to localStorage)
  const [synthesizedDecisions, setSynthesizedDecisions] = useState<SynthesizedDecision[]>([]);

  // Decision journal and review modal state
  const [showDecisionJournal, setShowDecisionJournal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingDecision, setReviewingDecision] = useState<SynthesizedDecision | null>(null);

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

  // Sync ID counters with existing data to avoid ID collisions
  useEffect(() => {
    let maxBlockId = 0;
    let maxHighlightId = 0;
    Object.values(chatsData).forEach(chat => {
      chat.blocks?.forEach(b => {
        const match = b.id.match(/^block-(\d+)$/);
        if (match) maxBlockId = Math.max(maxBlockId, parseInt(match[1], 10));
      });
      chat.highlights?.forEach(h => {
        const match = h.id.match(/^highlight-(\d+)$/);
        if (match) maxHighlightId = Math.max(maxHighlightId, parseInt(match[1], 10));
      });
    });
    if (maxBlockId > blockIdRef.current) blockIdRef.current = maxBlockId;
    if (maxHighlightId > highlightIdRef.current) highlightIdRef.current = maxHighlightId;
  }, [chatsData]);

  // Ref to skip snapshot in internal calls (e.g. mergeBlocks calls updateBlock + deleteBlock)
  const skipSnapshotRef = useRef(false);

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
    pushSnapshot();
    const id = `block-${++blockIdRef.current}`;
    let posX = x;
    let posY = y;

    if (posX === undefined || posY === undefined) {
      // Gather all visible blocks across the project to avoid overlaps
      const allBlocks = projectChatIds.flatMap(cid => chatsData[cid]?.blocks || []).filter(b => !b.isHidden);
      const blockW = 220;
      const blockH = 80;
      const gap = 40;

      if (allBlocks.length === 0) {
        posX = 30;
        posY = 30;
      } else {
        // Find the bottommost extent of all blocks
        let maxBottom = 0;
        let leftmostX = Infinity;
        for (const b of allBlocks) {
          const bh = b.height || (b.isCollapsed ? 50 : blockH);
          const bottom = b.y + bh;
          if (bottom > maxBottom) maxBottom = bottom;
          if (b.x < leftmostX) leftmostX = b.x;
        }
        // Place new block below all existing blocks, aligned to the leftmost column
        posX = leftmostX < Infinity ? leftmostX : 30;
        posY = maxBottom + gap;
      }
    }

    const newBlock: Block = {
      id,
      text,
      color,
      x: posX!,
      y: posY!,
      chatId: currentChatId,
      messageId,
      startOffset,
      endOffset,
      isEditing: isEditing || false,
    };
    updateCurrentChatData({ blocks: [...blocks, newBlock] });
    showToast('Added to canvas!');
  }, [blocks, showToast, updateCurrentChatData, currentChatId, pushSnapshot, projectChatIds, chatsData]);

  // Add a child branch: creates a new block + connection in one operation
  const addBranch = useCallback((parentId: string) => {
    const parentBlock = displayedBlocks.find(b => b.id === parentId);
    if (!parentBlock) return;
    pushSnapshot();

    const childId = `block-${++blockIdRef.current}`;
    const childX = (parentBlock.x || 0) + (parentBlock.width || 220) + 60;
    const childY = parentBlock.y || 0;

    const newBlock: Block = {
      id: childId,
      text: '',
      color: parentBlock.color,
      x: childX,
      y: childY,
      chatId: currentChatId,
      isEditing: true,
    };

    const newConnection: Connection = {
      from: parentId,
      fromPos: 'right',
      to: childId,
      toPos: 'left',
      color: parentBlock.color,
    };

    updateCurrentChatData({
      blocks: [...blocks, newBlock],
      connections: [...connections, newConnection],
    });
  }, [displayedBlocks, blocks, connections, currentChatId, pushSnapshot, updateCurrentChatData]);

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
    pushSnapshot();
    // Find the highlight to get its linkage, then remove both highlight and linked block
    setChatsData(prev => {
      // First find the highlight across all chats
      let targetHighlight: Highlight | null = null;
      for (const chat of Object.values(prev)) {
        const found = chat.highlights.find(h => h.id === id);
        if (found) { targetHighlight = found; break; }
      }

      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        let filteredBlocks = chat.blocks;
        if (targetHighlight) {
          filteredBlocks = chat.blocks.filter(b =>
            !(b.messageId === targetHighlight!.messageId &&
              b.startOffset === targetHighlight!.startOffset &&
              b.endOffset === targetHighlight!.endOffset)
          );
        }
        // Remove connections to deleted blocks
        const deletedBlockIds = new Set(chat.blocks.filter(b => !filteredBlocks.includes(b)).map(b => b.id));
        updated[chatId] = {
          ...chat,
          highlights: chat.highlights.filter(h => h.id !== id),
          blocks: filteredBlocks,
          connections: deletedBlockIds.size > 0
            ? chat.connections.filter(c => !deletedBlockIds.has(c.from) && !deletedBlockIds.has(c.to))
            : chat.connections,
        };
      });
      return updated;
    });
    showToast('Highlight & block removed!');
  }, [showToast, pushSnapshot]);

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
    if (!skipSnapshotRef.current) pushSnapshot();

    // Collect all descendants to cascade-delete the entire branch
    const pChatIds = projects[currentProjectId]?.chatIds || [];
    setChatsData(prev => {
      // Gather all connections across project chats
      const allConnections: Connection[] = [];
      pChatIds.forEach(cid => {
        const chat = prev[cid];
        if (chat) allConnections.push(...chat.connections);
      });

      // BFS to find all descendant IDs
      const toDelete = new Set<string>([id]);
      const queue = [id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        allConnections.forEach(c => {
          if (c.from === current && !toDelete.has(c.to)) {
            toDelete.add(c.to);
            queue.push(c.to);
          }
        });
      }

      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        // Collect highlight linkage keys for all blocks being deleted
        const deletedLinkKeys = new Set<string>();
        chat.blocks.forEach(b => {
          if (toDelete.has(b.id) && b.messageId && b.startOffset !== undefined && b.endOffset !== undefined) {
            deletedLinkKeys.add(`${b.messageId}:${b.startOffset}:${b.endOffset}`);
          }
        });
        updated[chatId] = {
          ...chat,
          blocks: chat.blocks.filter(b => !toDelete.has(b.id)),
          connections: chat.connections.filter(c => !toDelete.has(c.from) && !toDelete.has(c.to)),
          highlights: deletedLinkKeys.size > 0
            ? chat.highlights.filter(h => !deletedLinkKeys.has(`${h.messageId}:${h.startOffset}:${h.endOffset}`))
            : chat.highlights,
        };
      });
      return updated;
    });
    showToast('Branch deleted');
  }, [showToast, pushSnapshot, currentProjectId, projects]);

  const deleteBlocks = useCallback((ids: string[]) => {
    pushSnapshot();
    const idSet = new Set(ids);
    setChatsData(prev => {
      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        // Collect linkage keys for blocks being deleted
        const deletedLinkKeys = new Set<string>();
        chat.blocks.forEach(b => {
          if (idSet.has(b.id) && b.messageId && b.startOffset !== undefined && b.endOffset !== undefined) {
            deletedLinkKeys.add(`${b.messageId}:${b.startOffset}:${b.endOffset}`);
          }
        });
        updated[chatId] = {
          ...chat,
          blocks: chat.blocks.filter(b => !idSet.has(b.id)),
          connections: chat.connections.filter(c => !idSet.has(c.from) && !idSet.has(c.to)),
          highlights: deletedLinkKeys.size > 0
            ? chat.highlights.filter(h => !deletedLinkKeys.has(`${h.messageId}:${h.startOffset}:${h.endOffset}`))
            : chat.highlights,
        };
      });
      return updated;
    });
    showToast(`Deleted ${ids.length} blocks`);
  }, [showToast, pushSnapshot]);


  const toggleCollapse = useCallback((id: string) => {
    pushSnapshot();
    const pChatIds = projects[currentProjectId]?.chatIds || [];

    setChatsData(prev => {
      // Gather ALL connections and blocks across project chats
      const allConnections: Connection[] = [];
      pChatIds.forEach(cid => {
        const chat = prev[cid];
        if (chat) allConnections.push(...chat.connections);
      });

      // Build a mutable map of ALL blocks across project chats (deep copy)
      const allBlocksCopy = new Map<string, Block & { _chatId: string }>();
      pChatIds.forEach(cid => {
        const chat = prev[cid];
        if (chat) {
          chat.blocks.forEach(b => {
            allBlocksCopy.set(b.id, { ...b, _chatId: cid });
          });
        }
      });

      const currentBlock = allBlocksCopy.get(id);
      if (!currentBlock) return prev;

      const isNowCollapsed = !currentBlock.isCollapsed;
      currentBlock.isCollapsed = isNowCollapsed;

      const getChildrenIds = (pid: string) => allConnections.filter(c => c.from === pid).map(c => c.to);

      // Visited set to prevent infinite loops in cyclic graphs
      const visited = new Set<string>();

      const updateVisibility = (parentId: string, shouldHide: boolean) => {
         if (visited.has(parentId)) return;
         visited.add(parentId);

         const childrenIds = getChildrenIds(parentId);
         childrenIds.forEach(childId => {
           const child = allBlocksCopy.get(childId);
           if (child) {
             if (shouldHide) {
               child.isHidden = true;
               updateVisibility(childId, true);
             } else {
               child.isHidden = false;
               if (!child.isCollapsed) {
                 updateVisibility(childId, false);
               }
             }
           }
         });
      };

      updateVisibility(id, isNowCollapsed);

      // Rebuild chat data from mutated blocks
      const updated: Record<string, ChatData> = { ...prev };
      pChatIds.forEach(cid => {
        const chat = prev[cid];
        if (!chat) return;
        const updatedBlocks = chat.blocks.map(b => {
          const mutated = allBlocksCopy.get(b.id);
          return mutated ? { ...b, isCollapsed: mutated.isCollapsed, isHidden: mutated.isHidden } : b;
        });
        updated[cid] = { ...chat, blocks: updatedBlocks };
      });

      return updated;
    });
  }, [currentProjectId, projects, pushSnapshot]);

  const collapseAll = useCallback(() => {
    pushSnapshot();
    // Gather all connections across all chats in the current project
    const pChatIds = projects[currentProjectId]?.chatIds || [];

    setChatsData(prev => {
      // Collect ALL connections across project chats to determine children
      const allChildIds = new Set<string>();
      pChatIds.forEach(cid => {
        const chat = prev[cid];
        if (chat) {
          chat.connections.forEach(c => allChildIds.add(c.to));
        }
      });

      const updated: Record<string, ChatData> = {};
      Object.entries(prev).forEach(([chatId, chat]) => {
        // Only process chats in the current project
        if (pChatIds.includes(chatId)) {
          updated[chatId] = {
            ...chat,
            blocks: chat.blocks.map(b => ({
              ...b,
              isCollapsed: true, // Collapse the node itself (show small preview)
              isHidden: allChildIds.has(b.id) // Hide if it is a child in any project connection
            })),
          };
        } else {
          updated[chatId] = chat;
        }
      });
      return updated;
    });
    setCurrentTool('select');
  }, [setCurrentTool, currentProjectId, projects, pushSnapshot]);

  const expandAll = useCallback(() => {
    pushSnapshot();
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
  }, [setCurrentTool, pushSnapshot]);

  const addConnection = useCallback((
    fromId: string,
    fromPos: ConnectionPosition,
    toId: string,
    toPos: ConnectionPosition
  ) => {
    // Check ALL raw connections (cross-chat) for duplicates
    const exists = rawDisplayedConnections.some(
      c => c.from === fromId && c.to === toId
    );
    if (exists) return;

    // Prevent reverse duplicate (A→B already exists, block B→A)
    const reverseExists = rawDisplayedConnections.some(
      c => c.from === toId && c.to === fromId
    );
    if (reverseExists) return;

    // Cycle detection: prevent making A a child of B if B is already a descendant of A
    const wouldCreateCycle = (parentId: string, childId: string): boolean => {
      const visited = new Set<string>();
      const queue = [parentId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === childId) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        // Walk up: find parents of current
        rawDisplayedConnections.forEach(c => {
          if (c.to === current) queue.push(c.from);
        });
      }
      return false;
    };
    if (wouldCreateCycle(fromId, toId)) return;

    pushSnapshot();

    // Re-parent: if the child (toId) already has a parent, remove old connection first
    let updatedConnections = [...connections];
    const existingParentConn = updatedConnections.find(c => c.to === toId);
    if (existingParentConn && existingParentConn.from !== fromId) {
      updatedConnections = updatedConnections.filter(c => c !== existingParentConn);
    }

    const fromBlock = displayedBlocks.find(b => b.id === fromId);
    const newConnection: Connection = {
      from: fromId,
      fromPos,
      to: toId,
      toPos,
      color: fromBlock?.color || 'blue',
    };
    updateCurrentChatData({ connections: [...updatedConnections, newConnection] });
    showToast('Connected!');
  }, [displayedBlocks, rawDisplayedConnections, connections, showToast, updateCurrentChatData, pushSnapshot]);

  const deleteConnection = useCallback((fromId: string, toId: string) => {
    pushSnapshot();
    updateCurrentChatData({
      connections: connections.filter(c => !(c.from === fromId && c.to === toId))
    });
    showToast('Connection removed');
  }, [connections, updateCurrentChatData, showToast, pushSnapshot]);

  const mergeBlocks = useCallback((sourceId: string, targetId: string) => {
    // We need to look in displayedBlocks which combines all chats in project
    const sourceBlock = displayedBlocks.find(b => b.id === sourceId);
    const targetBlock = displayedBlocks.find(b => b.id === targetId);

    if (sourceBlock && targetBlock && sourceId !== targetId) {
      pushSnapshot();
      skipSnapshotRef.current = true;
      const mergedText = `${targetBlock.text}\n\n---\n\n${sourceBlock.text}`;

      // Update the target block and delete the source block
      updateBlock(targetId, { text: mergedText });
      deleteBlock(sourceId);
      skipSnapshotRef.current = false;

      showToast('Nodes merged successfully!');
    }
  }, [displayedBlocks, updateBlock, deleteBlock, showToast, pushSnapshot]);

  const clearCanvas = useCallback(() => {
    if (confirm('Clear canvas?')) {
      pushSnapshot();
      updateCurrentChatData({ blocks: [], connections: [], highlights: [] });
    }
  }, [updateCurrentChatData, pushSnapshot]);

  const rearrangeBlocks = useCallback((direction: 'horizontal' | 'vertical' = 'horizontal') => {
    pushSnapshot();
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
    const levelSpacing = 350;
    const nodeSpacing = 160;

    // 1. Calculate subtree sizes (perpendicular to layout direction)
    const subtreeSpan = new Map<string, number>();
    const visited = new Set<string>();

    const calculateSpan = (nodeId: string): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) {
        subtreeSpan.set(nodeId, nodeSpacing);
        return nodeSpacing;
      }

      let span = 0;
      children.forEach(childId => {
        span += calculateSpan(childId);
      });

      const result = Math.max(span, nodeSpacing);
      subtreeSpan.set(nodeId, result);
      return result;
    };

    roots.forEach(root => {
      visited.clear();
      calculateSpan(root.id);
    });

    // 2. Position nodes based on direction
    const positionedCount = new Set<string>();

    if (direction === 'horizontal') {
      // Parents on the left, children spread right
      let currentRootY = 100;

      const layoutNode = (nodeId: string, x: number, startY: number) => {
        if (positionedCount.has(nodeId)) return;
        positionedCount.add(nodeId);

        const span = subtreeSpan.get(nodeId) || nodeSpacing;
        const centerY = startY + span / 2 - 40;
        newPositions.set(nodeId, { x, y: centerY });

        let currentChildY = startY;
        const children = childrenMap.get(nodeId) || [];
        children.forEach(childId => {
          layoutNode(childId, x + levelSpacing, currentChildY);
          currentChildY += subtreeSpan.get(childId) || nodeSpacing;
        });
      };

      roots.forEach(root => {
        layoutNode(root.id, 100, currentRootY);
        currentRootY += (subtreeSpan.get(root.id) || nodeSpacing) + 100;
      });
    } else {
      // Vertical: parents on top, children spread down
      let currentRootX = 100;

      const layoutNode = (nodeId: string, startX: number, y: number) => {
        if (positionedCount.has(nodeId)) return;
        positionedCount.add(nodeId);

        const span = subtreeSpan.get(nodeId) || nodeSpacing;
        const centerX = startX + span / 2 - 100; // Adjust for card width
        newPositions.set(nodeId, { x: centerX, y });

        let currentChildX = startX;
        const children = childrenMap.get(nodeId) || [];
        children.forEach(childId => {
          layoutNode(childId, currentChildX, y + levelSpacing);
          currentChildX += subtreeSpan.get(childId) || nodeSpacing;
        });
      };

      roots.forEach(root => {
        layoutNode(root.id, currentRootX, 100);
        currentRootX += (subtreeSpan.get(root.id) || nodeSpacing) + 100;
      });
    }

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
            // Always auto-optimize connection positions after layout
            connections: chat.connections.map(conn => {
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
    showToast(direction === 'horizontal' ? 'Horizontal layout applied' : 'Vertical layout applied');
  }, [currentProjectId, projects, chatsData, setCurrentTool, showToast, pushSnapshot]);



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

  // Navigate from a chat highlight to the corresponding block on the canvas
  const handleHighlightNavigate = useCallback((messageId: string, startOffset: number, endOffset: number) => {
    // Find the block that matches this highlight's source location
    const block = displayedBlocks.find(
      b => b.messageId === messageId && b.startOffset === startOffset && b.endOffset === endOffset
    );
    if (block) {
      setSelectedBlock(block.id);
      // Tell the X6 graph to center on this block
      window.dispatchEvent(new CustomEvent('x6-focus-block', { detail: { blockId: block.id } }));
      showToast('Navigated to block on canvas');
    }
  }, [displayedBlocks, showToast]);

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

      // Switch to the new chat AND the project (so project context is picked up)
      setCurrentProjectId(projectId);
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

  // Decision mode handlers
  const handleStartDecision = useCallback(() => {
    setIsDecisionMode(true);
    setDecisionNodeIds([]);
  }, []);

  const handleCancelDecision = useCallback(() => {
    setIsDecisionMode(false);
    setDecisionNodeIds([]);
  }, []);

  const handleCreateNodeFromDecision = useCallback((content: string, color: BlockColor, stepKey: string) => {
    // Get the label for the node
    const labels: Record<string, string> = {
      'question': 'Decision',
      'context': 'Context',
      'worst-case': 'Worst Case',
      'prevention': 'Prevention',
      'best-case': 'Best Case',
      'inaction': 'Cost of Inaction',
    };

    const label = labels[stepKey] || stepKey;
    const truncated = content.length > 150 ? content.substring(0, 150) + '...' : content;
    const nodeText = `${label}: ${truncated}`;

    // Calculate position - tree layout with Decision at top, branches below
    const nodeIndex = decisionNodeIds.length;
    let x = 0, y = 0;

    // Layout: Decision (top center) -> Context (below) -> Worst/Best (split) -> Prevention/Inaction (under each)
    switch (stepKey) {
      case 'question':
        x = 300; y = 50;
        break;
      case 'context':
        x = 300; y = 200;
        break;
      case 'worst-case':
        x = 80; y = 350;
        break;
      case 'prevention':
        x = 80; y = 500;
        break;
      case 'best-case':
        x = 520; y = 350;
        break;
      case 'inaction':
        x = 520; y = 500;
        break;
      default:
        x = 50 + (nodeIndex % 2) * 280;
        y = 50 + Math.floor(nodeIndex / 2) * 150;
    }

    // Create the block
    const id = `block-${++blockIdRef.current}`;
    const newBlock: Block = {
      id,
      text: nodeText,
      color,
      x,
      y,
      chatId: currentChatId,
      isEditing: false,
    };

    // Create connections based on the step (parent-child relationships)
    const newConnections: Connection[] = [];

    // Connection mapping: which node connects to which
    const connectionMap: Record<string, { parentStep: string; fromPos: ConnectionPosition; toPos: ConnectionPosition }> = {
      'context': { parentStep: 'question', fromPos: 'bottom', toPos: 'top' },
      'worst-case': { parentStep: 'context', fromPos: 'bottom', toPos: 'top' },
      'best-case': { parentStep: 'context', fromPos: 'bottom', toPos: 'top' },
      'prevention': { parentStep: 'worst-case', fromPos: 'bottom', toPos: 'top' },
      'inaction': { parentStep: 'best-case', fromPos: 'bottom', toPos: 'top' },
    };

    const connectionInfo = connectionMap[stepKey];
    if (connectionInfo && decisionNodeIds.length > 0) {
      // Find the parent node ID
      const stepOrder = ['question', 'context', 'worst-case', 'prevention', 'best-case', 'inaction'];
      const parentStepIndex = stepOrder.indexOf(connectionInfo.parentStep);
      if (parentStepIndex >= 0 && parentStepIndex < decisionNodeIds.length) {
        const parentId = decisionNodeIds[parentStepIndex];
        newConnections.push({
          from: parentId,
          fromPos: connectionInfo.fromPos,
          to: id,
          toPos: connectionInfo.toPos,
          color,
        });
      }
    }

    // Update with new block and connections
    updateCurrentChatData({
      blocks: [...blocks, newBlock],
      connections: [...connections, ...newConnections]
    });
    setDecisionNodeIds(prev => [...prev, id]);
  }, [blocks, connections, currentChatId, decisionNodeIds, updateCurrentChatData]);

  const handleDecisionComplete = useCallback(async (decisionData: DecisionData) => {
    // Create a new project for this decision
    try {
      // Build project context from Fear Setting framework answers
      const projectContext = `Decision: ${decisionData.question}

Context: ${decisionData.context}

Worst Case Scenario: ${decisionData.worstCase}

Prevention/Mitigation: ${decisionData.prevention}

Best Case Scenario: ${decisionData.bestCase}

Cost of Inaction: ${decisionData.costOfInaction}

Final Decision: ${decisionData.choice}
Confidence: ${decisionData.confidence}/10`;

      const newProjectRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: decisionData.question,
          isDecision: true,
          decisionData,
          context: projectContext  // Include the Fear Setting context
        }),
      });
      const newProject: ProjectWithDecision = await newProjectRes.json();

      // Create a chat for this decision project
      const newChatRes = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: decisionData.question,
          projectId: newProject.id,
        }),
      });
      const newChatData = await newChatRes.json();

      // Move current canvas blocks to the new chat
      const currentBlocks = blocks;
      const currentConnections = connections;

      // Update the new chat with the decision blocks
      await fetch(`/api/chats/${newChatData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: currentBlocks,
          connections: currentConnections,
        }),
      });

      // Update local state - explicitly include context from Fear Setting answers
      setProjects(prev => ({
        ...prev,
        [newProject.id]: {
          ...newProject,
          chatIds: [newChatData.id],
          context: projectContext  // Ensure context is set in local state
        }
      }));

      setChatsData(prev => ({
        ...prev,
        [newChatData.id]: {
          title: newChatData.title,
          preview: decisionData.question,
          messages: [],
          blocks: currentBlocks,
          connections: currentConnections,
          highlights: [],
        }
      }));

      // Switch to the new decision project/chat
      setCurrentProjectId(newProject.id);
      setCurrentChatId(newChatData.id);
      setIsDecisionMode(false);
      setDecisionNodeIds([]);

      // Update cache - include context from Fear Setting answers
      saveToCache(
        { ...projects, [newProject.id]: { ...newProject, chatIds: [newChatData.id], context: projectContext } },
        {
          ...chatsData,
          [newChatData.id]: {
            title: newChatData.title,
            preview: decisionData.question,
            messages: [],
            blocks: currentBlocks,
            connections: currentConnections,
            highlights: [],
          }
        }
      );

      const reviewDate = new Date(decisionData.reviewDate);
      showToast(`Decision saved! Review on ${reviewDate.toLocaleDateString()}`);
    } catch (error) {
      console.error('Error creating decision:', error);
      showToast('Failed to save decision');
    }
  }, [blocks, connections, projects, chatsData, showToast, saveToCache]);

  // ============================================
  // CANVAS SYNTHESIS HANDLERS
  // ============================================

  const handleSynthesizeDecision = useCallback(async () => {
    if (displayedBlocks.length < 3) {
      showToast('Add at least 3 blocks to your canvas to synthesize a decision');
      return;
    }

    setShowSynthesisModal(true);
    setIsSynthesizing(true);
    setSynthesisResult(null);

    try {
      // Get API key from localStorage
      const geminiApiKey = typeof window !== 'undefined'
        ? localStorage.getItem('cercily-gemini-api-key')
        : null;

      // Prepare canvas data for the API
      const canvasData = {
        projectId: currentProjectId,
        projectName: projects[currentProjectId]?.title || 'Untitled Project',
        nodes: displayedBlocks.map(b => ({
          id: b.id,
          content: b.text,
          color: b.color,
        })),
        connections: displayedConnections.map(c => {
          const fromBlock = displayedBlocks.find(b => b.id === c.from);
          const toBlock = displayedBlocks.find(b => b.id === c.to);
          return {
            fromId: c.from,
            toId: c.to,
            fromContent: fromBlock?.text || '',
            toContent: toBlock?.text || '',
          };
        }),
      };

      const response = await fetch('/api/decisions/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canvasData,
          apiKey: geminiApiKey,
          modelName: activeChatModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to synthesize decision');
      }

      const data = await response.json();
      setSynthesisResult(data.synthesis);
    } catch (error) {
      console.error('Error synthesizing decision:', error);
      showToast('Failed to synthesize decision. Please try again.');
      setShowSynthesisModal(false);
    } finally {
      setIsSynthesizing(false);
    }
  }, [displayedBlocks, displayedConnections, currentProjectId, projects, activeChatModel, showToast]);

  const handleCommitSynthesizedDecision = useCallback((decision: Omit<SynthesizedDecision, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newDecision: SynthesizedDecision = {
      ...decision,
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };

    // Save to local state and localStorage
    setSynthesizedDecisions(prev => {
      const updated = [...prev, newDecision];
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('cercily-synthesized-decisions', JSON.stringify(updated));
      }
      return updated;
    });

    setShowSynthesisModal(false);
    setSynthesisResult(null);

    const reviewDate = new Date(decision.reviewDate);
    showToast(`Decision committed! Review on ${reviewDate.toLocaleDateString()}`);
  }, [showToast]);

  const handleNavigateToNode = useCallback((nodeId: string) => {
    // Find the block and select it
    const block = displayedBlocks.find(b => b.id === nodeId);
    if (block) {
      setSelectedBlock(nodeId);
      // If the block belongs to a different chat, switch to it
      if (block.chatId && block.chatId !== currentChatId) {
        handleSelectChat(block.chatId);
      }
      showToast('Navigated to node');
    }
  }, [displayedBlocks, currentChatId, handleSelectChat, showToast]);

  // Load synthesized decisions from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cercily-synthesized-decisions');
      if (stored) {
        try {
          setSynthesizedDecisions(JSON.parse(stored));
        } catch (e) {
          console.warn('Failed to load synthesized decisions from localStorage:', e);
        }
      }
    }
  }, []);

  const handleOpenDecisionJournal = useCallback(() => {
    setShowDecisionJournal(true);
  }, []);

  const handleReviewDecision = useCallback((decisionId: string) => {
    const decision = synthesizedDecisions.find(d => d.id === decisionId);
    if (decision) {
      setReviewingDecision(decision);
      setShowReviewModal(true);
      setShowDecisionJournal(false);
    }
  }, [synthesizedDecisions]);

  const handleViewDecision = useCallback((decisionId: string) => {
    const decision = synthesizedDecisions.find(d => d.id === decisionId);
    if (decision) {
      // Navigate to the project if available
      if (decision.projectId && projects[decision.projectId]) {
        handleSelectProject(decision.projectId);
        setShowDecisionJournal(false);
        showToast('Navigated to decision project');
      } else {
        // Project not found - open the review modal to show decision details
        setReviewingDecision(decision);
        setShowReviewModal(true);
        setShowDecisionJournal(false);
      }
    }
  }, [synthesizedDecisions, projects, handleSelectProject, showToast]);

  const handleSubmitReview = useCallback((decisionId: string, review: {
    actualOutcome: string;
    learnings: string;
    outcomeRating: 'good' | 'neutral' | 'bad';
  }) => {
    const now = new Date().toISOString();

    setSynthesizedDecisions(prev => {
      const updated = prev.map(d => {
        if (d.id === decisionId) {
          return {
            ...d,
            actualOutcome: review.actualOutcome,
            learnings: review.learnings,
            outcomeRating: review.outcomeRating,
            reviewedAt: now,
            updatedAt: now,
          };
        }
        return d;
      });

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('cercily-synthesized-decisions', JSON.stringify(updated));
      }

      return updated;
    });

    setShowReviewModal(false);
    setReviewingDecision(null);
    showToast('Review saved! Your reflections have been recorded.');
  }, [showToast]);

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
    isDecision: p.isDecision,
    chats: p.chatIds.map(id => ({
      id,
      title: chatsData[id]?.title || 'Untitled',
      preview: chatsData[id]?.preview || '',
      active: id === currentChatId,
      updatedAt: chatsData[id]?.updatedAt,
    })),
  }));

  // Show loading screen while fetching data
  if (isLoading) {
    return (
      <div className="loading-overlay">
        <CircularProgress
          size={64}
          strokeWidth={4}
          text="Loading your thoughts..."
          subtext="Connecting to Cercily"
        />
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
        <div className={`sidebar-wrapper ${sidebarVisible ? 'open' : 'closed'}`}>
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
            onStartDecision={handleStartDecision}
            onOpenDecisionJournal={handleOpenDecisionJournal}
            pendingReviewCount={synthesizedDecisions.filter(d => {
              if (d.reviewedAt) return false;
              const reviewDate = new Date(d.reviewDate);
              return reviewDate <= new Date();
            }).length}
          />
        </div>
        <div className={`panes-container ${isResizing ? 'is-resizing' : ''}`}>
          <div className="chat-pane" style={{ width: `calc(${chatPaneWidth}% - 4px)` }}>
            {isDecisionMode ? (
              <DecisionFlow
                onComplete={handleDecisionComplete}
                onCancel={handleCancelDecision}
                onCreateNode={handleCreateNodeFromDecision}
                modelName={activeChatModel}
                customPrompt={customDecisionPrompt}
              />
            ) : (
              <ChatView
                key={currentChatId}
                messages={messages}
                highlights={highlights}
                onTextSelection={handleTextSelection}
                onHighlightClick={handleHighlightClick}
                onHighlightNavigate={handleHighlightNavigate}
                onSendMessage={handleSendMessage}
                isSendingMessage={isSendingMessage}
                includeContext={includeContext}
                onToggleContext={() => setIncludeContext(prev => !prev)}
                hasContext={!!projects[currentProjectId]?.context}
              />
            )}
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
            onDragStart={() => setIsResizing(true)}
            onDragEnd={() => setIsResizing(false)}
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
              onSynthesizeDecision={handleSynthesizeDecision}
              onUndo={canvasUndo}
              onRedo={canvasRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              onPushSnapshot={pushSnapshot}
              onAddBranch={addBranch}
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
        onCustomPromptChange={setCustomDecisionPrompt}
      />
      <ProjectContextModal
        isOpen={contextModalOpen}
        onClose={() => setContextModalOpen(false)}
        projectId={contextModalProjectId}
        projectTitle={projects[contextModalProjectId]?.title || ''}
        initialContext={projects[contextModalProjectId]?.context || ''}
        onSave={handleSaveProjectContext}
      />

      {/* Saving indicator */}
      {isSaving && (
        <div className="saving-indicator">
          <CircularProgress size={24} strokeWidth={3} text="Saving..." />
        </div>
      )}

      {/* Synthesis Modal */}
      <SynthesisModal
        isOpen={showSynthesisModal}
        onClose={() => {
          setShowSynthesisModal(false);
          setSynthesisResult(null);
        }}
        synthesis={synthesisResult}
        isLoading={isSynthesizing}
        projectId={currentProjectId}
        projectName={projects[currentProjectId]?.title || 'Untitled Project'}
        onCommit={handleCommitSynthesizedDecision}
        onNavigateToNode={handleNavigateToNode}
      />

      {/* Decision Journal */}
      <DecisionJournalView
        isOpen={showDecisionJournal}
        onClose={() => setShowDecisionJournal(false)}
        decisions={synthesizedDecisions}
        onReviewDecision={handleReviewDecision}
        onViewDecision={handleViewDecision}
      />

      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setReviewingDecision(null);
        }}
        decision={reviewingDecision}
        onSubmitReview={handleSubmitReview}
      />
    </>
  );
}

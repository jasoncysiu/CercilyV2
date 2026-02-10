'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Block, Connection, ChatData } from '@/lib/types';

const MAX_HISTORY = 50;

type CanvasSnapshot = Record<string, {
  blocks: Block[];
  connections: Connection[];
}>;

function extractSnapshot(
  chatsData: Record<string, ChatData>,
  projectChatIds: string[]
): CanvasSnapshot {
  const snapshot: CanvasSnapshot = {};
  for (const chatId of projectChatIds) {
    const chat = chatsData[chatId];
    if (chat) {
      snapshot[chatId] = {
        blocks: JSON.parse(JSON.stringify(chat.blocks)),
        connections: JSON.parse(JSON.stringify(chat.connections)),
      };
    }
  }
  return snapshot;
}

export function useCanvasHistory(
  chatsData: Record<string, ChatData>,
  setChatsData: React.Dispatch<React.SetStateAction<Record<string, ChatData>>>,
  projectChatIds: string[],
  currentProjectId: string,
) {
  const [past, setPast] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);

  // Track whether the last chatsData change was from undo/redo to avoid
  // capturing it as a new snapshot
  const isUndoRedoRef = useRef(false);

  // Keep refs in sync so pushSnapshot has a stable identity
  const chatsDataRef = useRef(chatsData);
  chatsDataRef.current = chatsData;
  const projectChatIdsRef = useRef(projectChatIds);
  projectChatIdsRef.current = projectChatIds;

  // Reset history when project changes
  useEffect(() => {
    setPast([]);
    setFuture([]);
  }, [currentProjectId]);

  const pushSnapshot = useCallback(() => {
    const snapshot = extractSnapshot(chatsDataRef.current, projectChatIdsRef.current);
    setPast(prev => [...prev.slice(-(MAX_HISTORY - 1)), snapshot]);
    setFuture([]);
  }, []);

  const applySnapshot = useCallback((snapshot: CanvasSnapshot) => {
    isUndoRedoRef.current = true;
    setChatsData(prev => {
      const updated = { ...prev };
      for (const [chatId, data] of Object.entries(snapshot)) {
        if (updated[chatId]) {
          updated[chatId] = {
            ...updated[chatId],
            blocks: data.blocks,
            connections: data.connections,
          };
        }
      }
      return updated;
    });
  }, [setChatsData]);

  const undo = useCallback(() => {
    setPast(prevPast => {
      if (prevPast.length === 0) return prevPast;

      const newPast = [...prevPast];
      const previousState = newPast.pop()!;

      // Save current state to future before applying
      const currentSnapshot = extractSnapshot(chatsDataRef.current, projectChatIdsRef.current);
      setFuture(prevFuture => [currentSnapshot, ...prevFuture]);

      applySnapshot(previousState);
      return newPast;
    });
  }, [applySnapshot]);

  const redo = useCallback(() => {
    setFuture(prevFuture => {
      if (prevFuture.length === 0) return prevFuture;

      const newFuture = [...prevFuture];
      const nextState = newFuture.shift()!;

      // Save current state to past before applying
      const currentSnapshot = extractSnapshot(chatsDataRef.current, projectChatIdsRef.current);
      setPast(prevPast => [...prevPast, currentSnapshot]);

      applySnapshot(nextState);
      return newFuture;
    });
  }, [applySnapshot]);

  return {
    pushSnapshot,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

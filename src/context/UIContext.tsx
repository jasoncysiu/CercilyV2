"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BlockColor } from '@/lib/types';

interface SelectionPopupState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
  messageId: string;
  startOffset: number;
  endOffset: number;
}

interface RemoveHighlightPopupState {
  visible: boolean;
  x: number;
  y: number;
  highlightId: string | null;
}

interface UIContextType {
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  toastMessage: string;
  toastVisible: boolean;
  showToast: (message: string) => void;
  selectionPopup: SelectionPopupState;
  setSelectionPopup: (state: SelectionPopupState) => void;
  removeHighlightPopup: RemoveHighlightPopupState;
  setRemoveHighlightPopup: (state: RemoveHighlightPopupState) => void;
  highlightColor: BlockColor;
  setHighlightColor: (color: BlockColor) => void;
  chatPaneWidth: number;
  setChatPaneWidth: (width: number) => void;
  showSettingsPanel: boolean;
  setShowSettingsPanel: (show: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopupState>({ visible: false, x: 0, y: 0, text: '', messageId: '', startOffset: 0, endOffset: 0 });
  const [removeHighlightPopup, setRemoveHighlightPopup] = useState<RemoveHighlightPopupState>({ visible: false, x: 0, y: 0, highlightId: null });
  const [highlightColor, setHighlightColor] = useState<BlockColor>('yellow');
  const [chatPaneWidth, setChatPaneWidth] = useState(50); // Percentage width
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
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

  const value = {
    sidebarVisible,
    setSidebarVisible,
    toastMessage,
    toastVisible,
    showToast,
    selectionPopup,
    setSelectionPopup,
    removeHighlightPopup,
    setRemoveHighlightPopup,
    highlightColor,
    setHighlightColor,
    chatPaneWidth,
    setChatPaneWidth,
    showSettingsPanel,
    setShowSettingsPanel,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
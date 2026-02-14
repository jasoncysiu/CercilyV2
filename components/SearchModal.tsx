'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Search, LayoutGrid, MessageSquare, FolderOpen } from 'lucide-react';
import { ProjectItem, Block, Message } from '@/lib/types';

type SearchTab = 'all' | 'canvas' | 'conversations' | 'projects';

interface SearchResult {
  type: 'project' | 'chat' | 'block' | 'message';
  id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectItem[];
  blocks: Block[];
  messages: Message[];
  chatTitle: string;
  onSelectChat: (chatId: string) => void;
  onSelectProject: (projectId: string) => void;
  onNavigateToBlock?: (blockId: string) => void;
}

export default function SearchModal({
  isOpen, onClose, projects, blocks, messages, chatTitle,
  onSelectChat, onSelectProject, onNavigateToBlock,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTab('all');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  if (q) {
    // Canvas blocks
    if (tab === 'all' || tab === 'canvas') {
      for (const block of blocks) {
        if (block.text.toLowerCase().includes(q)) {
          results.push({
            type: 'block',
            id: block.id,
            title: block.text.length > 60 ? block.text.slice(0, 60) + '...' : block.text,
            subtitle: 'Canvas',
          });
        }
      }
    }

    // Conversation messages
    if (tab === 'all' || tab === 'conversations') {
      for (const msg of messages) {
        if (msg.content.toLowerCase().includes(q)) {
          const idx = msg.content.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 20);
          const end = Math.min(msg.content.length, idx + q.length + 40);
          const snippet = (start > 0 ? '...' : '') + msg.content.slice(start, end) + (end < msg.content.length ? '...' : '');
          results.push({
            type: 'message',
            id: msg.id,
            title: msg.role === 'user' ? 'You' : 'Assistant',
            subtitle: chatTitle,
            snippet,
          });
        }
      }
    }

    // Projects & chats
    if (tab === 'all' || tab === 'projects') {
      for (const project of projects) {
        if (project.title.toLowerCase().includes(q)) {
          results.push({ type: 'project', id: project.id, title: project.title, subtitle: 'Project' });
        }
        for (const chat of project.chats) {
          if (chat.title.toLowerCase().includes(q)) {
            results.push({ type: 'chat', id: chat.id, title: chat.title, subtitle: project.title });
          }
        }
      }
    }
  }

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'chat') {
      onSelectChat(result.id);
    } else if (result.type === 'project') {
      onSelectProject(result.id);
    } else if (result.type === 'block') {
      onNavigateToBlock?.(result.id);
    }
    onClose();
  };

  const tabs: { key: SearchTab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: null },
    { key: 'canvas', label: 'Canvas', icon: <LayoutGrid size={13} /> },
    { key: 'conversations', label: 'Chats', icon: <MessageSquare size={13} /> },
    { key: 'projects', label: 'Projects', icon: <FolderOpen size={13} /> },
  ];

  return (
    <>
      <div className="search-modal-overlay" onClick={onClose} />
      <div className="search-modal">
        <div className="search-modal-header">
          <h2>Search</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="search-modal-input-wrapper">
          <Search size={18} className="search-modal-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-modal-input"
            placeholder="Search canvas, chats, projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="search-modal-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`search-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="search-modal-results">
          {!q && (
            <div className="search-modal-empty">
              <p className="search-modal-empty-title">Start typing to search</p>
              <p className="search-modal-empty-hint">Search across canvas nodes, conversations, and projects.</p>
            </div>
          )}
          {q && results.length === 0 && (
            <div className="search-modal-empty">
              <p className="search-modal-empty-title">No results</p>
              <p className="search-modal-empty-hint">Try a different search term or filter.</p>
            </div>
          )}
          {results.map((result, i) => (
            <button
              key={`${result.type}-${result.id}-${i}`}
              className="search-modal-result"
              onClick={() => handleSelect(result)}
            >
              <div className="search-modal-result-row">
                <span className="search-modal-result-title">{result.title}</span>
                {result.subtitle && <span className="search-modal-result-badge">{result.subtitle}</span>}
              </div>
              {result.snippet && <span className="search-modal-result-snippet">{result.snippet}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

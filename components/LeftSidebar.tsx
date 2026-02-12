'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ProjectItem } from '@/lib/types';
import { ChevronRight, ChevronDown, Edit, Plus, Trash2, FileText, Target, BookOpen, MessageSquare, MoreHorizontal } from 'lucide-react';

interface LeftSidebarProps {
  projects: ProjectItem[];
  currentChatId: string;
  onSelectChat: (chatId: string) => void;
  onSelectProject: (projectId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onNewProject: () => void;
  onNewChat: () => void;
  onDeleteProject: (projectId: string) => void;
  onNewChatInProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newTitle: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onOpenProjectContext: (projectId: string) => void;
  onStartDecision: () => void;
  onOpenDecisionJournal: () => void;
  pendingReviewCount?: number;
}

export default function LeftSidebar({ projects, currentChatId, onSelectChat, onSelectProject, onDeleteChat, onNewProject, onNewChat, onDeleteProject, onNewChatInProject, onRenameProject, onRenameChat, onOpenProjectContext, onStartDecision, onOpenDecisionJournal, pendingReviewCount = 0 }: LeftSidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(projects.map(p => p.id))
  );
  const [showComposeMenu, setShowComposeMenu] = useState(false);
  const [overflowMenuId, setOverflowMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const composeRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const openMenuId = showComposeMenu ? '__compose__' : overflowMenuId;

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showComposeMenu && composeRef.current && !composeRef.current.contains(target)) {
        setShowComposeMenu(false);
      }
      if (overflowMenuId && overflowRef.current && !overflowRef.current.contains(target)) {
        setOverflowMenuId(null);
      }
    };
    const handleEscape = () => {
      setShowComposeMenu(false);
      setOverflowMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') handleEscape(); });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', (e) => { if (e.key === 'Escape') handleEscape(); });
    };
  }, [openMenuId, showComposeMenu, overflowMenuId]);

  // Focus the rename input when editingId changes
  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingId]);

  const formatRelativeTime = (iso?: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditingValue(currentTitle);
    setOverflowMenuId(null);
  };

  const commitRename = useCallback((id: string, type: 'project' | 'chat') => {
    const trimmed = editingValue.trim();
    if (trimmed && trimmed !== '') {
      if (type === 'project') {
        onRenameProject(id, trimmed);
      } else {
        onRenameChat(id, trimmed);
      }
    }
    setEditingId(null);
    setEditingValue('');
  }, [editingValue, onRenameProject, onRenameChat]);

  const cancelRename = () => {
    setEditingId(null);
    setEditingValue('');
  };

  // Split projects into decisions and regular projects
  const decisions = projects.filter(p => p.isDecision);
  const regularProjects = projects.filter(p => !p.isDecision);

  const renderProjectGroup = (project: ProjectItem) => (
    <div className="project-group" key={project.id}>
      <div className="project-title-container">
        {editingId === project.id ? (
          <input
            ref={renameInputRef}
            className="inline-rename-input"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(project.id, 'project');
              if (e.key === 'Escape') cancelRename();
            }}
            onBlur={() => commitRename(project.id, 'project')}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="project-title-toggle"
            onClick={() => {
              onSelectProject(project.id);
              toggleProject(project.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              startRename(project.id, project.title);
            }}
          >
            <span className={`toggle-arrow ${expandedProjects.has(project.id) ? 'expanded' : ''}`}>
              {expandedProjects.has(project.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="project-title-text">{project.title}</span>
          </div>
        )}
        <div className="project-overflow-wrapper" ref={overflowMenuId === project.id ? overflowRef : undefined}>
          <button
            className={`project-overflow-btn ${overflowMenuId === project.id ? 'active' : ''}`}
            aria-label={`Actions for ${project.title}`}
            onClick={(e) => {
              e.stopPropagation();
              setOverflowMenuId(overflowMenuId === project.id ? null : project.id);
            }}
          >
            <MoreHorizontal size={15} />
          </button>
          {overflowMenuId === project.id && (
            <div className="overflow-menu">
              <button
                className="overflow-menu-item"
                onClick={() => { onNewChatInProject(project.id); setOverflowMenuId(null); }}
              >
                <Plus size={14} /> Add chat
              </button>
              <button
                className="overflow-menu-item"
                onClick={() => { onOpenProjectContext(project.id); setOverflowMenuId(null); }}
              >
                <FileText size={14} /> Edit context
              </button>
              <button
                className="overflow-menu-item"
                onClick={() => startRename(project.id, project.title)}
              >
                <Edit size={14} /> Rename
              </button>
              <div className="overflow-menu-divider" />
              <button
                className="overflow-menu-item danger"
                onClick={() => {
                  if (confirm(`Delete project "${project.title}"?`)) {
                    onDeleteProject(project.id);
                  }
                  setOverflowMenuId(null);
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
      {expandedProjects.has(project.id) && (
        <div className="chat-list">
          {project.chats.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
              onClick={() => {
                if (editingId !== chat.id) onSelectChat(chat.id);
              }}
            >
              <div className="chat-item-content">
                {editingId === chat.id ? (
                  <input
                    ref={renameInputRef}
                    className="inline-rename-input"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(chat.id, 'chat');
                      if (e.key === 'Escape') cancelRename();
                    }}
                    onBlur={() => commitRename(chat.id, 'chat')}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div
                      className="chat-item-title"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(chat.id, chat.title);
                      }}
                    >
                      {chat.title}
                    </div>
                    <div className="chat-item-time">{formatRelativeTime(chat.updatedAt)}</div>
                  </>
                )}
              </div>
              {editingId !== chat.id && (
                <div className="chat-overflow-wrapper" ref={overflowMenuId === chat.id ? overflowRef : undefined}>
                  <button
                    className={`chat-overflow-btn ${overflowMenuId === chat.id ? 'active' : ''}`}
                    aria-label={`Actions for ${chat.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverflowMenuId(overflowMenuId === chat.id ? null : chat.id);
                    }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {overflowMenuId === chat.id && (
                    <div className="overflow-menu">
                      <button
                        className="overflow-menu-item"
                        onClick={(e) => { e.stopPropagation(); startRename(chat.id, chat.title); }}
                      >
                        <Edit size={14} /> Rename
                      </button>
                      <div className="overflow-menu-divider" />
                      <button
                        className="overflow-menu-item danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete chat "${chat.title}"?`)) {
                            onDeleteChat(chat.id);
                          }
                          setOverflowMenuId(null);
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="left-sidebar">
      <div className="sidebar-header">
        <input type="text" className="search-box" placeholder="Search..." />
        <div className="compose-wrapper" ref={composeRef}>
          <button
            className={`compose-btn ${showComposeMenu ? 'active' : ''}`}
            onClick={() => setShowComposeMenu(!showComposeMenu)}
            aria-label="Create new"
          >
            <Plus size={18} />
          </button>
          {showComposeMenu && (
            <div className="compose-dropdown">
              <button
                className="compose-dropdown-item"
                onClick={() => { onStartDecision(); setShowComposeMenu(false); }}
              >
                <Target size={15} />
                <span>New Decision</span>
              </button>
              <button
                className="compose-dropdown-item"
                onClick={() => { onNewChat(); setShowComposeMenu(false); }}
              >
                <MessageSquare size={15} />
                <span>New Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="project-list">
        <button className="journal-pinned-item" onClick={onOpenDecisionJournal}>
          <BookOpen size={15} />
          <span className="journal-pinned-label">Decision Journal</span>
          {pendingReviewCount > 0 && (
            <span className="journal-pinned-badge">{pendingReviewCount}</span>
          )}
        </button>

        {decisions.length > 0 && (
          <>
            <div className="sidebar-section-label">Decisions</div>
            {decisions.map(renderProjectGroup)}
          </>
        )}

        {regularProjects.length > 0 && (
          <>
            <div className="sidebar-section-label">Projects</div>
            {regularProjects.map(renderProjectGroup)}
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ProjectItem } from '@/lib/types';
import { ChevronRight, ChevronDown, Edit, Plus, Trash2 } from 'lucide-react'; // Import Lucide icons

interface LeftSidebarProps {
  projects: ProjectItem[];
  currentChatId: string;
  onSelectChat: (chatId: string) => void;
  onSelectProject: (projectId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onNewChatInProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newTitle: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
}

export default function LeftSidebar({ projects, currentChatId, onSelectChat, onSelectProject, onDeleteChat, onNewProject, onDeleteProject, onNewChatInProject, onRenameProject, onRenameChat }: LeftSidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(projects.map(p => p.id))
  );
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const handleProjectRename = (projectId: string, currentTitle: string) => {
    const newTitle = prompt('Rename project:', currentTitle);
    if (newTitle) {
      onRenameProject(projectId, newTitle);
      setEditingProjectId(null);
    }
  };

  const handleChatRename = (chatId: string, currentTitle: string) => {
    const newTitle = prompt('Rename chat:', currentTitle);
    if (newTitle) {
      onRenameChat(chatId, newTitle);
      setEditingChatId(null);
    }
  };

  return (
    <div className="left-sidebar">
      <div className="sidebar-header">
        <input type="text" className="search-box" placeholder="Search..." />
      </div>
      <button className="new-project-btn" onClick={onNewProject}>
        <Plus size={16} /> New Project
      </button>
      <div className="project-list">
        {projects.map(project => (
          <div className="project-group" key={project.id}>
            <div className="project-title-container">
              <div
                className="project-title-toggle"
                onClick={() => {
                  onSelectProject(project.id);
                  toggleProject(project.id);
                }}
              >
                <span className={`toggle-arrow ${expandedProjects.has(project.id) ? 'expanded' : ''}`}>
                  {expandedProjects.has(project.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span className="project-title-text">{project.title}</span>
              </div>
              <button
                className="project-edit-btn"
                aria-label={`Rename ${project.title}`}
                onClick={() => handleProjectRename(project.id, project.title)}
                title="Rename project"
              >
                <Edit size={14} />
              </button>
              <button
                className="project-add-chat-btn"
                aria-label={`Add chat to ${project.title}`}
                onClick={() => onNewChatInProject(project.id)}
              >
                <Plus size={14} />
              </button>
              <button
                className="project-delete-btn"
                aria-label={`Delete ${project.title}`}
                onClick={() => {
                  if (confirm(`Delete project "${project.title}"?`)) {
                    onDeleteProject(project.id);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            {expandedProjects.has(project.id) && (
              <div className="chat-list">
                {project.chats.map(chat => (
                  <div
                    key={chat.id}
                    className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <div className="chat-item-content">
                      <div className="chat-item-title">{chat.title}</div>
                      <div className="chat-item-preview">{chat.preview}</div>
                    </div>
                    <button
                      aria-label={`Rename ${chat.title}`}
                      className="chat-item-edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChatRename(chat.id, chat.title);
                      }}
                      title="Rename chat"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      aria-label={`Delete ${chat.title}`}
                      className="chat-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete chat "${chat.title}"?`)) {
                          onDeleteChat(chat.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
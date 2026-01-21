'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, Save } from 'lucide-react';

interface ProjectContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  initialContext: string;
  onSave: (projectId: string, context: string) => void;
}

export default function ProjectContextModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  initialContext,
  onSave,
}: ProjectContextModalProps) {
  const [context, setContext] = useState(initialContext);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContext(initialContext);
  }, [initialContext, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);

    // Create a timeout promise for 1 minute
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Save timed out')), 60000);
    });

    try {
      await Promise.race([
        onSave(projectId, context),
        timeoutPromise
      ]);
      onClose();
    } catch (error) {
      if ((error as Error).message === 'Save timed out') {
        alert('Save operation timed out. Please try again.');
      } else {
        alert('Failed to save context. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="project-context-modal">
        <div className="modal-header">
          <div className="modal-title">
            <FileText size={20} />
            <h2>Project Context</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-subtitle">
          <span className="project-name">{projectTitle}</span>
        </div>

        <p className="context-hint">
          Add context that will be included in all chats under this project.
          This helps the AI understand the topic without repeating yourself.
        </p>

        <div className="context-editor">
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g., This project is about building a SaaS product for enterprise customers. Key focus areas: user authentication, billing integration, and admin dashboards..."
            rows={8}
          />
          <div className="char-count">
            {context.length} / 2500 characters
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : (
              <>
                <Save size={16} />
                Save Context
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

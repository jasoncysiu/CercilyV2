'use client';

import React, { useState, useEffect } from 'react';
import { X, Monitor, Sun, Moon, Key, Eye, EyeOff, Check, Sparkles, RotateCcw, ChevronRight, ChevronDown, Trash2, MessageSquareText, ExternalLink } from 'lucide-react';
import ModelSelector from './ModelSelector';

type Theme = 'system' | 'light' | 'dark';

type CanvasFont = 'basic' | 'elegant' | 'montserrat' | 'monospace' | 'modern';
type TextSize = 'small' | 'mid' | 'large';

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string; size: string }[] = [
  { value: 'small', label: 'Small', size: '13px' },
  { value: 'mid', label: 'Mid', size: '15px' },
  { value: 'large', label: 'Large', size: '17px' },
];

const FONT_OPTIONS: { value: CanvasFont; label: string; family: string }[] = [
  { value: 'basic', label: 'Basic', family: "'Aino', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { value: 'elegant', label: 'Elegant', family: "'PT Serif', Georgia, serif" },
  { value: 'montserrat', label: 'Montserrat', family: "'Montserrat', -apple-system, sans-serif" },
  { value: 'monospace', label: 'Monospace', family: "'SF Mono', 'Fira Code', 'Courier New', monospace" },
  { value: 'modern', label: 'Modern', family: "'Bebas Neue', Impact, sans-serif" },
];

const DEFAULT_DECISION_PROMPT = `You are a decision-making coach. Analyze this person's thinking using the Fear Setting framework and provide a clear, actionable synthesis.

Provide a synthesis that:
1. Identifies key patterns or contradictions in their thinking
2. Points out risks they might have missed
3. Highlights their strongest points
4. Challenges any weak assumptions
5. Gives a clear recommendation

Keep it concise (3-4 paragraphs max). Be direct and honest.`;

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels: string[];
  onSelectAvailableModels: (models: string[]) => void;
  onCustomPromptChange?: (prompt: string) => void;
}

export default function SettingsPanel({ isOpen, onClose, availableModels, onSelectAvailableModels, onCustomPromptChange }: SettingsPanelProps) {
  const [theme, setTheme] = useState<Theme>('system');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [canvasFont, setCanvasFont] = useState<CanvasFont>('basic');
  const [textSize, setTextSize] = useState<TextSize>('mid');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['theme']));
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Load display name from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('cercily-display-name');
    if (savedName) setDisplayName(savedName);
  }, []);

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setDisplayName(trimmed);
      localStorage.setItem('cercily-display-name', trimmed);
      window.dispatchEvent(new Event('cercily-name-change'));
    }
    setEditingName(false);
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('cercily-theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('cercily-gemini-api-key');
    if (savedKey) {
      setGeminiApiKey(savedKey);
      setApiKeySaved(true);
    }
  }, []);

  // Load custom prompt from localStorage on mount
  useEffect(() => {
    const savedPrompt = localStorage.getItem('cercily-decision-prompt');
    if (savedPrompt) {
      setCustomPrompt(savedPrompt);
    }
  }, []);

  // Load canvas font from localStorage on mount
  useEffect(() => {
    const savedFont = localStorage.getItem('cercily-canvas-font') as CanvasFont | null;
    if (savedFont) {
      setCanvasFont(savedFont);
      applyCanvasFont(savedFont);
    }
  }, []);

  // Load text size from localStorage on mount
  useEffect(() => {
    const savedSize = localStorage.getItem('cercily-text-size') as TextSize | null;
    if (savedSize) {
      setTextSize(savedSize);
      applyTextSize(savedSize);
    }
  }, []);

  const applyTextSize = (sizeKey: TextSize) => {
    const option = TEXT_SIZE_OPTIONS.find(s => s.value === sizeKey);
    if (option) {
      document.documentElement.style.setProperty('--canvas-font-size', option.size);
    }
  };

  const handleTextSizeChange = (sizeKey: TextSize) => {
    setTextSize(sizeKey);
    localStorage.setItem('cercily-text-size', sizeKey);
    applyTextSize(sizeKey);
    window.dispatchEvent(new Event('cercily-text-size-change'));
  };

  const applyCanvasFont = (fontKey: CanvasFont) => {
    const option = FONT_OPTIONS.find(f => f.value === fontKey);
    if (option) {
      document.documentElement.style.setProperty('--canvas-font', option.family);
    }
  };

  const handleFontChange = (fontKey: CanvasFont) => {
    setCanvasFont(fontKey);
    localStorage.setItem('cercily-canvas-font', fontKey);
    applyCanvasFont(fontKey);
  };

  const handleSaveApiKey = () => {
    if (geminiApiKey.trim()) {
      localStorage.setItem('cercily-gemini-api-key', geminiApiKey.trim());
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('cercily-gemini-api-key');
    setGeminiApiKey('');
    setApiKeySaved(false);
  };

  const handleSavePrompt = () => {
    const trimmed = customPrompt.trim();
    if (trimmed) {
      localStorage.setItem('cercily-decision-prompt', trimmed);
    } else {
      localStorage.removeItem('cercily-decision-prompt');
    }
    onCustomPromptChange?.(trimmed);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const handleResetPrompt = () => {
    setCustomPrompt('');
    localStorage.removeItem('cercily-decision-prompt');
    onCustomPromptChange?.('');
    setPromptSaved(false);
  };

  const handleClearHistory = () => {
    if (confirm('Clear all local data? This will remove cached projects, chats, decisions, and preferences. Data stored in Notion will not be affected.')) {
      localStorage.removeItem('cercily-cache-projects');
      localStorage.removeItem('cercily-cache-chats');
      localStorage.removeItem('cercily-cache-timestamp');
      localStorage.removeItem('cercily-synthesized-decisions');
      localStorage.removeItem('cercily-display-name');
      localStorage.removeItem('cercily-theme');
      localStorage.removeItem('cercily-canvas-font');
      localStorage.removeItem('cercily-text-size');
      localStorage.removeItem('cercily-decision-prompt');
      localStorage.removeItem('cercily-gemini-api-key');
      window.location.reload();
    }
  };

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');

    if (newTheme === 'light') {
      root.classList.add('theme-light');
    } else if (newTheme === 'dark') {
      root.classList.add('theme-dark');
    }
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('cercily-theme', newTheme);
    applyTheme(newTheme);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="settings-overlay"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Profile section */}
        <div className={`settings-profile-section ${showProfileMenu ? 'expanded' : ''}`}>
          <button
            className="settings-profile"
            onClick={() => setShowProfileMenu(prev => !prev)}
          >
            <div className="settings-profile-avatar">
              {getInitials(displayName)}
            </div>
            <div className="settings-profile-info">
              {editingName ? (
                <input
                  className="settings-profile-name-input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { handleSaveName(); e.stopPropagation(); }
                    if (e.key === 'Escape') { setEditingName(false); e.stopPropagation(); }
                  }}
                  onBlur={handleSaveName}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  placeholder="Your name"
                />
              ) : (
                <>
                  <span className="settings-profile-name-text">
                    {displayName || 'Set your name'}
                  </span>
                  <span className="settings-profile-plan">Local workspace</span>
                </>
              )}
            </div>
            <span className={`settings-profile-chevron ${showProfileMenu ? 'open' : ''}`}>
              <ChevronRight size={16} />
            </span>
          </button>
          {showProfileMenu && (
            <div className="settings-profile-menu">
              <button
                className="settings-profile-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameInput(displayName);
                  setEditingName(true);
                  setShowProfileMenu(false);
                }}
              >
                Edit name
              </button>
              <button
                className="settings-profile-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open('https://github.com/anthropics/claude-code/issues', '_blank');
                }}
              >
                <MessageSquareText size={14} />
                Send Feedback
                <ExternalLink size={12} className="settings-profile-menu-ext" />
              </button>
              <div className="settings-profile-menu-divider" />
              <button
                className="settings-profile-menu-item danger"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearHistory();
                }}
              >
                <Trash2 size={14} />
                Clear Local Data
              </button>
            </div>
          )}
        </div>

        <div className="settings-content">
          {/* Theme */}
          <div className="settings-accordion">
            <button className={`settings-accordion-trigger ${openSections.has('theme') ? 'open' : ''}`} onClick={() => toggleSection('theme')}>
              <ChevronRight size={16} className="settings-accordion-arrow" />
              <span>Theme</span>
            </button>
            {openSections.has('theme') && (
              <div className="settings-accordion-body">
                <p className="settings-hint">Choose your preferred theme</p>
                <div className="theme-buttons">
                  <button
                    className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('system')}
                  >
                    <Monitor size={18} />
                    <span>System</span>
                  </button>
                  <button
                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('light')}
                  >
                    <Sun size={18} />
                    <span>Light</span>
                  </button>
                  <button
                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                  >
                    <Moon size={18} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Canvas Font */}
          <div className="settings-accordion">
            <button className={`settings-accordion-trigger ${openSections.has('font') ? 'open' : ''}`} onClick={() => toggleSection('font')}>
              <ChevronRight size={16} className="settings-accordion-arrow" />
              <span>Canvas Font</span>
            </button>
            {openSections.has('font') && (
              <div className="settings-accordion-body">
                <p className="settings-hint">Choose the typeface for canvas nodes</p>
                <div className="font-select-wrapper">
                  <select
                    className="font-select"
                    value={canvasFont}
                    onChange={(e) => handleFontChange(e.target.value as CanvasFont)}
                  >
                    {FONT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="font-preview" style={{ fontFamily: FONT_OPTIONS.find(f => f.value === canvasFont)?.family }}>
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>
            )}
          </div>

          {/* Text Size */}
          <div className="settings-accordion">
            <button className={`settings-accordion-trigger ${openSections.has('textSize') ? 'open' : ''}`} onClick={() => toggleSection('textSize')}>
              <ChevronRight size={16} className="settings-accordion-arrow" />
              <span>Text Size</span>
            </button>
            {openSections.has('textSize') && (
              <div className="settings-accordion-body">
                <p className="settings-hint">Choose the text size for both panes</p>
                <div className="theme-buttons">
                  {TEXT_SIZE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`theme-btn ${textSize === opt.value ? 'active' : ''}`}
                      onClick={() => handleTextSizeChange(opt.value)}
                    >
                      <span style={{ fontSize: opt.size }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* API Keys */}
          <div className="settings-accordion">
            <button className={`settings-accordion-trigger ${openSections.has('apiKeys') ? 'open' : ''}`} onClick={() => toggleSection('apiKeys')}>
              <ChevronRight size={16} className="settings-accordion-arrow" />
              <span>API Keys</span>
            </button>
            {openSections.has('apiKeys') && (
              <div className="settings-accordion-body">
                <p className="settings-hint">Add your API keys to use AI models</p>
                <div className="api-key-group">
                  <label className="api-key-label">Gemini API Key</label>
                  <div className="api-key-input-row">
                    <div className="api-key-input-wrapper">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="Enter your Gemini API key"
                        className="api-key-input"
                      />
                      <button
                        className="api-key-toggle"
                        onClick={() => setShowApiKey(!showApiKey)}
                        type="button"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button
                      className={`api-key-save ${apiKeySaved ? 'saved' : ''}`}
                      onClick={handleSaveApiKey}
                      disabled={!geminiApiKey.trim()}
                    >
                      {apiKeySaved ? <Check size={16} /> : 'Save'}
                    </button>
                  </div>
                  {geminiApiKey && (
                    <button className="api-key-clear" onClick={handleClearApiKey}>
                      Clear API Key
                    </button>
                  )}
                  <p className="api-key-hint">
                    Get your API key from{' '}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                      Google AI Studio
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* AI Models */}
          <div className="settings-accordion">
            <button className={`settings-accordion-trigger ${openSections.has('models') ? 'open' : ''}`} onClick={() => toggleSection('models')}>
              <ChevronRight size={16} className="settings-accordion-arrow" />
              <span>AI Models</span>
            </button>
            {openSections.has('models') && (
              <div className="settings-accordion-body">
                <p className="settings-hint">Select which models to use</p>
                <ModelSelector
                  initialAvailableModels={availableModels}
                  onSelectAvailableModels={onSelectAvailableModels}
                />
              </div>
            )}
          </div>

          {/* Decision Prompt */}
          <div className="settings-accordion">
            <button className={`settings-accordion-trigger ${openSections.has('prompt') ? 'open' : ''}`} onClick={() => toggleSection('prompt')}>
              <ChevronRight size={16} className="settings-accordion-arrow" />
              <span>Decision Prompt</span>
            </button>
            {openSections.has('prompt') && (
              <div className="settings-accordion-body">
                <p className="settings-hint">
                  Customize how the AI analyzes your decisions. Leave blank to use the default Fear Setting framework.
                </p>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={DEFAULT_DECISION_PROMPT}
                  className="settings-prompt-textarea"
                  rows={6}
                />
                <div className="settings-prompt-actions">
                  <button
                    className="settings-prompt-reset"
                    onClick={handleResetPrompt}
                    title="Reset to default"
                  >
                    <RotateCcw size={14} />
                    <span>Reset</span>
                  </button>
                  <button
                    className={`api-key-save ${promptSaved ? 'saved' : ''}`}
                    onClick={handleSavePrompt}
                  >
                    {promptSaved ? <Check size={16} /> : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

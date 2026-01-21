'use client';

import React, { useState, useEffect } from 'react';
import { X, Monitor, Sun, Moon, Key, Eye, EyeOff, Check } from 'lucide-react';
import ModelSelector from './ModelSelector';

type Theme = 'system' | 'light' | 'dark';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels: string[];
  onSelectAvailableModels: (models: string[]) => void;
}

export default function SettingsPanel({ isOpen, onClose, availableModels, onSelectAvailableModels }: SettingsPanelProps) {
  const [theme, setTheme] = useState<Theme>('system');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

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

        <div className="settings-content">
          {/* Theme Section */}
          <div className="settings-section">
            <label className="settings-label">Appearance</label>
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

          <div className="settings-divider" />

          {/* API Keys Section */}
          <div className="settings-section">
            <label className="settings-label">
              <Key size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              API Keys
            </label>
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

          <div className="settings-divider" />

          {/* Model Selector */}
          <div className="settings-section">
            <label className="settings-label">AI Models</label>
            <p className="settings-hint">Select which models to use</p>
            <ModelSelector
              initialAvailableModels={availableModels}
              onSelectAvailableModels={onSelectAvailableModels}
            />
          </div>
        </div>
      </div>
    </>
  );
}

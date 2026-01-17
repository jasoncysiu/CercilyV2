'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ModelSelector from './ModelSelector';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels: string[];
  onSelectAvailableModels: (models: string[]) => void;
}

export default function SettingsPanel({ isOpen, onClose, availableModels, onSelectAvailableModels }: SettingsPanelProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#2c2c2e] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Settings</DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure your application settings.
          </DialogDescription>
        </DialogHeader>
        <ModelSelector
          initialAvailableModels={availableModels}
          onSelectAvailableModels={onSelectAvailableModels}
        />
      </DialogContent>
    </Dialog>
  );
}
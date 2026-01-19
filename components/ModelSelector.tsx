'use client';

import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Model {
  name: string;
  displayName: string;
  description: string;
  supportedGenerationMethods?: string[];
}

interface ModelSelectorProps {
  initialAvailableModels: string[];
  onSelectAvailableModels: (models: string[]) => void;
}

export default function ModelSelector({ initialAvailableModels, onSelectAvailableModels }: ModelSelectorProps) {
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>(initialAvailableModels);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Model[] = await response.json();
        // Filter for generative models and sort by display name
        const generativeModels = data.filter(m => m.supportedGenerationMethods?.includes('generateContent')).sort((a, b) => a.displayName.localeCompare(b.displayName));
        setAllModels(generativeModels);
      } catch (err) {
        console.error('Failed to fetch models:', err);
        setError('Failed to load models. Please check your API key and server logs.');
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, []);

  const handleCheckboxChange = (modelName: string, checked: boolean) => {
    let newSelectedModels;
    if (checked) {
      if (selectedModels.length < 2) {
        newSelectedModels = [...selectedModels, modelName];
      } else {
        // If already 2 selected, don't add more
        return;
      }
    } else {
      newSelectedModels = selectedModels.filter(name => name !== modelName);
    }
    setSelectedModels(newSelectedModels);
    onSelectAvailableModels(newSelectedModels);
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Loading models...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-4 text-white">Select Chat Models (Max 2)</h3>
      <ScrollArea className="h-[200px] w-full rounded-md border border-gray-700 p-4 bg-gray-800">
        <div className="grid gap-4">
          {allModels.length === 0 ? (
            <p className="text-gray-400 text-base">No generative models found. Ensure your API key is valid.</p>
          ) : (
            allModels.map(model => (
              <div key={model.name} className="flex items-center space-x-2">
                <Checkbox
                  id={model.name}
                  checked={selectedModels.includes(model.name)}
                  onCheckedChange={(checked) => handleCheckboxChange(model.name, checked as boolean)}
                  disabled={!selectedModels.includes(model.name) && selectedModels.length >= 2}
                />
                <Label htmlFor={model.name} className="text-white cursor-pointer text-base">
                  <span className="font-medium text-base">{model.displayName}</span>
                  <span className="text-gray-400 text-base block">{model.description}</span>
                </Label>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <p className="text-base text-gray-500 mt-4">
        Selected: {selectedModels.length} / 2
      </p>
    </div>
  );
}
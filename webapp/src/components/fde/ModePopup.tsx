'use client';

import { useState } from 'react';
import { X, ChevronRight, Bot, Cpu, Database, Search } from 'lucide-react';

export interface ModeOption {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
}

export interface SubAgent {
  type: string;
  label: string;
  description?: string;
}

export interface ModePopupProps {
  modes: ModeOption[];
  selectedMode: string;
  onSelectMode: (modeId: string) => void;
  subAgents?: SubAgent[];
  agentType?: string;
  onClose: () => void;
  tokenUsage?: number;
}

const MODE_ICONS: Record<string, React.ReactNode> = {
  explore: <Search className="w-4 h-4" />,
  build: <Database className="w-4 h-4" />,
  operate: <Cpu className="w-4 h-4" />,
  analyze: <Bot className="w-4 h-4" />,
};

const MODE_COLORS: Record<string, string> = {
  explore: 'text-blue-400',
  build: 'text-green-400',
  operate: 'text-amber-400',
  analyze: 'text-purple-400',
}

export function ModePopup({ 
  modes, 
  selectedMode, 
  onSelectMode, 
  subAgents = [],
  agentType,
  onClose,
  tokenUsage = 0
}: ModePopupProps) {
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Mode selector"
    >
      <div 
        className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-y-auto mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-300">Modes</h3>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-zinc-800 rounded focus:outline-none focus:ring-2 focus:ring-zinc-500"
            aria-label="Close mode selector"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        
        {/* Sub-agents section */}
        {subAgents && subAgents.length > 0 && (
          <div className="p-4 border-b border-zinc-700">
            <h4 className="text-xs font-medium text-zinc-400 mb-2">Agents</h4>
            <div className="space-y-2" role="listbox" aria-label="Available agents">
              {subAgents.map((agent) => (
                <button
                  key={agent.type}
                  onClick={() => {}}
                  className={`w-full flex items-center gap-3 p-2 rounded text-left text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                    agentType === agent.type 
                      ? 'bg-zinc-700 text-white' 
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                  role="option"
                  aria-selected={agentType === agent.type}
                >
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${
                    MODE_COLORS[agent.type] || 'text-zinc-400'
                  }`}>
                    {MODE_ICONS[agent.type] || <Bot className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-medium">{agent.label}</div>
                    {agent.description && (
                      <div className="text-xs text-zinc-500 mt-0.5">{agent.description}</div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 ml-auto text-zinc-500" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Modes section */}
        <div className="p-4">
          <h4 className="text-xs font-medium text-zinc-400 mb-2">Steps</h4>
          <div className="space-y-1" role="listbox" aria-label="Available modes">
            {modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                onMouseEnter={() => setHoveredMode(mode.id)}
                onMouseLeave={() => setHoveredMode(null)}
                className={`w-full flex items-center gap-3 p-3 rounded text-left focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                  selectedMode === mode.id 
                    ? 'bg-zinc-700 text-white' 
                    : 'text-zinc-300 hover:bg-zinc-800'
                } ${tokenUsage > 50 ? 'opacity-40' : ''}`}
                role="option"
                aria-selected={selectedMode === mode.id}
                disabled={tokenUsage > 50}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center ${
                  MODE_COLORS[mode.id] || 'text-zinc-400'
                }`}>
                  {MODE_ICONS[mode.id] || <Search className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{mode.label}</div>
                  {hoveredMode === mode.id && mode.description && (
                    <div className="text-xs text-zinc-500 mt-0.5">{mode.description}</div>
                  )}
                </div>
                {selectedMode === mode.id && (
                  <div className="w-2 h-2 rounded-full bg-white" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

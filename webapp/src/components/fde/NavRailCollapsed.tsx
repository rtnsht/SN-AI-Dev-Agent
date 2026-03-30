'use client';

import { useState, type ReactNode } from 'react';
import {
  Home,
  Settings,
  Plus,
  MessageSquare,
  Wrench,
  Layers,
  Database,
  Server,
  Bot,
  Cpu,
  Search,
  BarChart3
} from 'lucide-react';
import type { SDLCPhase } from '@/lib/types';

export interface NavRailCollapsedProps {
  phase: SDLCPhase;
  phaseProgress?: number;
  updateSetBadge?: string;
  instanceIndicators?: {
    connected: boolean;
    name?: string;
  };
  agentType?: 'Builder' | 'Explorer' | 'Operator' | 'Analyzer';
  onPhaseClick: () => void;
  onSettingsClick: () => void;
  onNewChatClick: () => void;
  onOpenChatList?: () => void;
  onOpenTools?: () => void;
  onOpenAgents?: () => void;
}

const PHASE_COLORS: Record<string, string> = {
  spec: 'bg-blue-500',
  design: 'bg-purple-500',
  implementation: 'bg-green-500',
  testing: 'bg-amber-500',
  deployment: 'bg-red-500',
  scope_selection: 'bg-cyan-500',
  unknown: 'bg-zinc-500',
};

const AGENT_ICONS: Record<string, ReactNode> = {
  Builder: <Database className="w-4 h-4" />,
  Explorer: <Search className="w-4 h-4" />,
  Operator: <Cpu className="w-4 h-4" />,
  Analyzer: <BarChart3 className="w-4 h-4" />,
};

const AGENT_COLORS: Record<string, string> = {
  Builder: 'text-green-400',
  Explorer: 'text-blue-400',
  Operator: 'text-amber-400',
  Analyzer: 'text-purple-400',
};

export function NavRailCollapsed({
  phase,
  phaseProgress = 0,
  updateSetBadge,
  instanceIndicators,
  agentType,
  onPhaseClick,
  onSettingsClick,
  onNewChatClick,
  onOpenChatList,
  onOpenTools,
  onOpenAgents
}: NavRailCollapsedProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const phaseColor = PHASE_COLORS[phase] || PHASE_COLORS.unknown;

  return (
    <div className="w-16 bg-zinc-900 border-r border-zinc-700 flex flex-col items-center py-4 gap-4">
      {/* Logo / Home */}
      <button
        className="p-2 hover:bg-zinc-800 rounded-lg group relative"
        onMouseEnter={() => setHoveredItem('home')}
        onMouseLeave={() => setHoveredItem(null)}
        aria-label="Home"
      >
        <Home className="w-5 h-5 text-zinc-400 group-hover:text-white" />
        {hoveredItem === 'home' && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
            Home
          </div>
        )}
      </button>

      {/* New Chat */}
      <button
        onClick={onNewChatClick}
        className="p-2 hover:bg-zinc-800 rounded-lg group relative"
        onMouseEnter={() => setHoveredItem('new')}
        onMouseLeave={() => setHoveredItem(null)}
        aria-label="New chat"
      >
        <Plus className="w-5 h-5 text-zinc-400 group-hover:text-white" />
        {hoveredItem === 'new' && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
            New Chat
          </div>
        )}
      </button>

      {/* Divider */}
      <div className="w-8 h-px bg-zinc-700" />

      {/* Chat list */}
      <button
        onClick={onOpenChatList}
        className="p-2 hover:bg-zinc-800 rounded-lg group relative"
        onMouseEnter={() => setHoveredItem('chats')}
        onMouseLeave={() => setHoveredItem(null)}
        aria-label="Chats"
      >
        <MessageSquare className="w-5 h-5 text-zinc-400 group-hover:text-white" />
        {hoveredItem === 'chats' && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
            Chats
          </div>
        )}
      </button>

      {/* Tool workbench */}
      <button
        onClick={onOpenTools}
        className="p-2 hover:bg-zinc-800 rounded-lg group relative"
        onMouseEnter={() => setHoveredItem('tools')}
        onMouseLeave={() => setHoveredItem(null)}
        aria-label="Tools"
      >
        <Wrench className="w-5 h-5 text-zinc-400 group-hover:text-white" />
        {hoveredItem === 'tools' && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
            Tools
          </div>
        )}
      </button>

      {/* Agents / mode config */}
      <button
        onClick={onOpenAgents}
        className="p-2 hover:bg-zinc-800 rounded-lg group relative"
        onMouseEnter={() => setHoveredItem('agents')}
        onMouseLeave={() => setHoveredItem(null)}
        aria-label="Agents"
      >
        <Bot className="w-5 h-5 text-zinc-400 group-hover:text-white" />
        {hoveredItem === 'agents' && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
            Agents
          </div>
        )}
      </button>

      {/* Phase Chip */}
      <button
        onClick={onPhaseClick}
        className="group relative"
        onMouseEnter={() => setHoveredItem('phase')}
        onMouseLeave={() => setHoveredItem(null)}
        aria-label={`Phase: ${phase}`}
      >
        <div className={`w-10 h-10 rounded-lg ${phaseColor} flex items-center justify-center`}>
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full"
            style={{ width: `${Math.min(phaseProgress * 100, 100)}%` }}
          />
        </div>
        {hoveredItem === 'phase' && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
            Phase: {phase}
          </div>
        )}
      </button>

      {/* Agent Type Badge */}
      {agentType && (
        <div
          className="group relative"
          onMouseEnter={() => setHoveredItem('agent')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <div className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center ${AGENT_COLORS[agentType] || ''}`}>
            {AGENT_ICONS[agentType] || <Bot className="w-5 h-5" />}
          </div>
          {hoveredItem === 'agent' && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
              Agent: {agentType}
            </div>
          )}
        </div>
      )}

      {/* Update Set Badge */}
      {updateSetBadge && (
        <div
          className="group relative"
          onMouseEnter={() => setHoveredItem('updateset')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <div className="w-10 h-6 rounded bg-zinc-800 flex items-center justify-center px-1">
            <span className="text-[10px] text-zinc-300 truncate">{updateSetBadge}</span>
          </div>
          {hoveredItem === 'updateset' && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
              Update Set: {updateSetBadge}
            </div>
          )}
        </div>
      )}

      {/* Instance Indicators */}
      {instanceIndicators && (
        <div
          className="group relative"
          onMouseEnter={() => setHoveredItem('instance')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <div className={`w-10 h-10 rounded-lg ${instanceIndicators.connected ? 'bg-green-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
            <Server className={`w-5 h-5 ${instanceIndicators.connected ? 'text-green-400' : 'text-red-400'}`} />
          </div>
          {hoveredItem === 'instance' && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
              {instanceIndicators.name || 'Instance'}
              <div className={instanceIndicators.connected ? 'text-green-400' : 'text-red-400'}>
                {instanceIndicators.connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <button
        onClick={onSettingsClick}
        className="p-2 hover:bg-zinc-800 rounded-lg group relative"
        onMouseEnter={() => setHoveredItem('settings')}
        onMouseLeave={() => setHoveredItem(null)}
        aria-label="Settings"
      >
        <Settings className="w-5 h-5 text-zinc-400 group-hover:text-white" />
        {hoveredItem === 'settings' && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded text-xs text-white whitespace-nowrap z-10" role="tooltip">
            Settings
          </div>
        )}
      </button>
    </div>
  );
}

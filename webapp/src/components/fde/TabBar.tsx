'use client';

import { X, Plus, MessageSquare, Zap } from 'lucide-react';

export interface Tab {
  id: string;
  type: 'main' | 'quick';
  label: string;
  isActive: boolean;
}

export interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewQuickTab: () => void;
}

export default function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onNewQuickTab }: TabBarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-surface-200 border-b border-surface-300">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-t cursor-pointer text-sm font-medium transition-colors
            ${tab.id === activeTabId
              ? 'bg-surface-100 text-content-100 border-t-2 border-primary'
              : 'bg-surface-300 text-content-300 hover:bg-surface-200 hover:text-content-200'
            }
          `}
        >
          {tab.type === 'main' ? (
            <MessageSquare className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-xs bg-accent/20 text-accent px-1 rounded">Quick</span>
            </div>
          )}
          <span className="max-w-24 truncate">{tab.label}</span>
          {tab.type === 'quick' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="ml-1 p-0.5 rounded hover:bg-surface-300"
              aria-label="Close tab"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      
      <button
        onClick={onNewQuickTab}
        className="flex items-center gap-1 px-2 py-1.5 text-content-400 hover:text-content-200 hover:bg-surface-200 rounded text-sm"
        aria-label="New quick agent tab"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, X, Table, Code, FileText, Layers, Server } from 'lucide-react';

export interface ContextBlock {
  id: string;
  type: 'table' | 'scope' | 'record' | 'script' | 'system';
  label: string;
  content: string;
  tokens?: number;
  expanded?: boolean;
}

export interface ContextBlockPanelProps {
  blocks: ContextBlock[];
  onAddBlock: (block: Omit<ContextBlock, 'id'>) => void;
  onRemoveBlock: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse: () => void;
}

const BLOCK_ICONS: Record<string, React.ReactNode> = {
  table: <Table className="w-4 h-4" />,
  scope: <Layers className="w-4 h-4" />,
  record: <FileText className="w-4 h-4" />,
  script: <Code className="w-4 h-4" />,
  system: <Server className="w-4 h-4" />,
};

const BLOCK_COLORS: Record<string, string> = {
  table: 'text-blue-400',
  scope: 'text-purple-400',
  record: 'text-green-400',
  script: 'text-amber-400',
  system: 'text-cyan-400',
};

export function ContextBlockPanel({
  blocks,
  onAddBlock,
  onRemoveBlock,
  collapsed = false,
  onToggleCollapse
}: ContextBlockPanelProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  const toggleBlock = (id: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalTokens = blocks.reduce((sum, b) => sum + (b.tokens || 0), 0);

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded">
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-zinc-800 rounded"
          aria-label="Expand context panel"
        >
          <ChevronRight className="w-4 h-4 text-zinc-400" aria-hidden="true" />
        </button>
        <span className="text-xs text-zinc-400">{blocks.length} context items</span>
        <span className="text-xs text-zinc-500">({totalTokens} tokens)</span>
      </div>
    );
  }

  const handleAddBlock = () => {
    const label = prompt('Enter context label:');
    if (label && label.trim()) {
      onAddBlock({ type: 'system', label: label.trim(), content: '' });
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-zinc-800 rounded"
            aria-label="Collapse context panel"
          >
            <ChevronDown className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          </button>
          <span className="text-sm font-medium text-zinc-300">Context</span>
          <span className="text-xs text-zinc-500">({blocks.length} items, {totalTokens} tokens)</span>
        </div>
        <button
          onClick={handleAddBlock}
          className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400"
          aria-label="Add new context block"
        >
          + Add
        </button>
      </div>

      {/* Blocks */}
      <div className="p-2 space-y-1 max-h-48 overflow-y-auto" role="list" aria-label="Context blocks">
        {blocks.map((block, index) => (
          <div
            key={block.id}
            className="bg-zinc-800 rounded border border-zinc-700 group"
            role="listitem"
          >
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-zinc-750"
              onClick={() => toggleBlock(block.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleBlock(block.id);
                }
              }}
              aria-expanded={expandedBlocks.has(block.id)}
              aria-label={`${block.label}, ${block.type} context block`}
            >
              <span className="text-xs font-mono text-zinc-500 w-6" aria-hidden="true">{index + 1}</span>
              <div className={`flex-shrink-0 ${BLOCK_COLORS[block.type]}`} aria-hidden="true">
                {BLOCK_ICONS[block.type]}
              </div>
              <span className="flex-1 text-sm text-white truncate">{block.label}</span>
              {block.tokens && (
                <span className="text-xs text-zinc-500">{block.tokens}</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveBlock(block.id);
                }}
                className="p-1 hover:bg-zinc-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove ${block.label}`}
              >
                <X className="w-3 h-3 text-zinc-500" aria-hidden="true" />
              </button>
              {expandedBlocks.has(block.id) ? (
                <ChevronDown className="w-3 h-3 text-zinc-400" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-3 h-3 text-zinc-400" aria-hidden="true" />
              )}
            </div>
            {expandedBlocks.has(block.id) && (
              <div className="px-8 py-2 text-xs text-zinc-400 border-t border-zinc-700 bg-zinc-850">
                {block.content || 'No content'}
              </div>
            )}
          </div>
        ))}
        {blocks.length === 0 && (
          <div className="text-sm text-zinc-500 text-center py-4">No context blocks</div>
        )}
      </div>
    </div>
  );
}

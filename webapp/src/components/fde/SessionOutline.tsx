'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, FileText, Code, Network, FileCheck, MessageSquare } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';

export interface Artifact {
  id: string;
  title: string;
  type: string;
  createdAt: Date;
  vaptScore?: number;
}

export interface SessionOutlineProps {
  messages: ChatMessage[];
  artifacts: Artifact[];
  onArtifactClick: (artifactId: string) => void;
  collapsed?: boolean;
  onToggleCollapse: () => void;
  onSummarize?: () => void;
  onClearContext?: () => void;
}

const ARTIFACT_ICONS: Record<string, ReactNode> = {
  code: <Code className="w-3 h-3" />,
  diagram: <Network className="w-3 h-3" />,
  document: <FileText className="w-3 h-3" />,
  spec: <FileCheck className="w-3 h-3" />,
  test: <FileCheck className="w-3 h-3" />,
  other: <FileText className="w-3 h-3" />,
};

export function SessionOutline({
  messages,
  artifacts,
  onArtifactClick,
  collapsed = false,
  onToggleCollapse,
  onSummarize,
  onClearContext,
}: SessionOutlineProps) {
  const [artifactsExpanded, setArtifactsExpanded] = useState(true);
  const visibleMessages = messages.filter((msg) => !msg.hidden && !msg.queued);
  const estimateTokens = (message: ChatMessage) => Math.max(1, Math.ceil((message.content?.length || 0) / 4));
  const totalTokens = visibleMessages.reduce((sum, msg) => sum + estimateTokens(msg), 0);

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded">
        <button
          onClick={onToggleCollapse}
          className="p-0.5 hover:bg-zinc-800 rounded"
          aria-label="Expand session outline"
        >
          <ChevronRight className="w-3 h-3 text-zinc-400" />
        </button>
        <span className="text-xs text-zinc-500">{visibleMessages.length} messages</span>
        {artifacts.length > 0 && (
          <span className="text-xs text-amber-500">{artifacts.length} artifacts</span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="p-0.5 hover:bg-zinc-800 rounded"
            aria-label="Collapse session outline"
          >
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>
          <span className="text-xs font-medium text-zinc-400">Session Outline</span>
        </div>
        <span className="text-xs text-zinc-600">{visibleMessages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="max-h-40 overflow-y-auto">
        {visibleMessages.slice(-10).map((msg, index) => (
          <div
            key={msg.id || index}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 border-b border-zinc-800 last:border-b-0"
          >
            <MessageSquare className="w-3 h-3 text-zinc-500 flex-shrink-0" />
            <span className="flex-1 text-xs text-zinc-300 truncate">
              {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI' : msg.role}
            </span>
            <span className="text-xs text-zinc-600 truncate max-w-[45%]">
              {msg.content?.substring(0, 42)}...
            </span>
            <span className="text-[10px] text-zinc-500 tabular-nums">{estimateTokens(msg)}t</span>
          </div>
        ))}
      </div>

      {/* Artifacts Section (Collapsible) */}
      {artifacts.length > 0 && (
        <div className="border-t border-zinc-700">
          <button
            onClick={() => setArtifactsExpanded(!artifactsExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 text-left"
            aria-expanded={artifactsExpanded}
            aria-controls="artifacts-list"
          >
            {artifactsExpanded ? (
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-400" />
            )}
            <span className="text-xs font-medium text-amber-400">Artifacts</span>
            <span className="text-xs text-zinc-600">({artifacts.length})</span>
          </button>
          {artifactsExpanded && (
            <div id="artifacts-list" className="pb-2">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  onClick={() => onArtifactClick(artifact.id)}
                  className="w-full flex items-center gap-2 px-6 py-1.5 hover:bg-zinc-800 text-left"
                  aria-label={`Open artifact: ${artifact.title}`}
                >
                  <div className="text-amber-500">
                    {ARTIFACT_ICONS[artifact.type] || <FileText className="w-3 h-3" />}
                  </div>
                  <span className="flex-1 text-xs text-zinc-300 truncate">{artifact.title}</span>
                  <span className="text-xs text-zinc-600">{artifact.type}</span>
                  {artifact.vaptScore != null && (
                    <span className="text-[10px] text-emerald-400 tabular-nums">{artifact.vaptScore}/100</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-zinc-700 px-3 py-3 space-y-3">
        <div className="text-[11px] text-zinc-500">
          <div className="flex items-center justify-between">
            <span>Visible messages</span>
            <span className="tabular-nums">{visibleMessages.length}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>Approx tokens</span>
            <span className="tabular-nums">{totalTokens}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>Artifacts</span>
            <span className="tabular-nums">{artifacts.length}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onSummarize}
            disabled={!onSummarize || visibleMessages.length === 0}
            className="w-full text-left px-3 py-2 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--fde-surface-3)', color: 'var(--fde-text-primary)' }}
          >
            Summarize older messages
          </button>
          <button
            type="button"
            onClick={onClearContext}
            disabled={!onClearContext || visibleMessages.length === 0}
            className="w-full text-left px-3 py-2 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgba(249, 115, 115, 0.12)', color: 'var(--fde-accent-operate)' }}
          >
            Clear outline context
          </button>
        </div>
      </div>
    </div>
  );
}

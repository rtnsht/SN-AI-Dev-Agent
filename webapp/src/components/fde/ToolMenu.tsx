'use client';

import { ChevronDown, ChevronUp, ShieldCheck, Wrench } from 'lucide-react';
import type { ToolSelectionMode } from '@/lib/tool-categories';

export interface ToolCategorySummary {
  id: string;
  label: string;
  count: number;
}

export interface ToolMenuProps {
  mode: string;
  categories: ToolCategorySummary[];
  activeCategories: string[];
  selectionMode: ToolSelectionMode;
  open: boolean;
  onToggleOpen: () => void;
  onToggleCategory: (categoryId: string) => void;
  onSelectAllTools: () => void;
  onUseCategorySelection: () => void;
  customToolCount?: number;
}

export function ToolMenu({
  mode,
  categories,
  activeCategories,
  selectionMode,
  open,
  onToggleOpen,
  onToggleCategory,
  onSelectAllTools,
  onUseCategorySelection,
  customToolCount = 0,
}: ToolMenuProps) {
  const totalCount = categories.reduce((sum, category) => sum + category.count, 0);
  const categoryEnabledCount = categories
    .filter((category) => activeCategories.includes(category.id))
    .reduce((sum, category) => sum + category.count, 0);
  const enabledCount =
    selectionMode === "all"
      ? totalCount
      : selectionMode === "custom"
        ? customToolCount
        : categoryEnabledCount;

  return (
    <div className="fde-card px-3 py-2">
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full flex items-center gap-2 text-left"
        style={{ color: 'var(--fde-text-primary)' }}
      >
        <Wrench className="w-4 h-4" style={{ color: 'var(--fde-accent-build)' }} />
        <span className="text-sm font-medium capitalize">{mode} mode</span>
        <span className="text-xs" style={{ color: 'var(--fde-text-secondary)' }}>
          {enabledCount} of {totalCount} tools enabled
        </span>
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ color: 'var(--fde-text-disabled)', border: '1px solid var(--fde-border-default)' }}>
          {selectionMode === "all" ? "All" : selectionMode === "custom" ? "Custom" : "Categories"}
        </span>
        <div className="flex-1" />
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onUseCategorySelection}
              className="px-3 py-1.5 rounded text-xs"
              style={{
                background: selectionMode === "categories" ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${selectionMode === "categories" ? 'var(--fde-border-emphasis)' : 'var(--fde-border-default)'}`,
                color: selectionMode === "categories" ? 'var(--fde-text-primary)' : 'var(--fde-text-secondary)',
              }}
            >
              Use categories
            </button>
            <button
              type="button"
              onClick={onSelectAllTools}
              className="px-3 py-1.5 rounded text-xs"
              style={{
                background: selectionMode === "all" ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${selectionMode === "all" ? 'var(--fde-border-emphasis)' : 'var(--fde-border-default)'}`,
                color: selectionMode === "all" ? 'var(--fde-text-primary)' : 'var(--fde-text-secondary)',
              }}
            >
              Allow all tools
            </button>
            {customToolCount > 0 && (
              <div
                className="px-3 py-1.5 rounded text-xs"
                style={{
                  background: selectionMode === "custom" ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${selectionMode === "custom" ? 'var(--fde-border-emphasis)' : 'var(--fde-border-default)'}`,
                  color: selectionMode === "custom" ? 'var(--fde-text-primary)' : 'var(--fde-text-secondary)',
                }}
              >
                Custom set: {customToolCount}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categories.map((category) => {
              const active = activeCategories.includes(category.id);
              return (
                <label
                  key={category.id}
                  className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer"
                  style={{
                    background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: `1px solid ${active ? 'var(--fde-border-emphasis)' : 'var(--fde-border-default)'}`,
                    color: active ? 'var(--fde-text-primary)' : 'var(--fde-text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => onToggleCategory(category.id)}
                    disabled={selectionMode === "all"}
                    className="rounded border-zinc-600 bg-zinc-900"
                  />
                  <span className="text-sm flex-1">{category.label}</span>
                  <span className="text-xs">{category.count}</span>
                </label>
              );
            })}
          </div>

          <div
            className="flex items-center gap-2 px-3 py-2 rounded"
            style={{
              background: 'rgba(56, 201, 118, 0.08)',
              border: '1px solid rgba(56, 201, 118, 0.18)',
              color: 'var(--fde-text-secondary)',
            }}
          >
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--fde-success)' }} />
            <span className="text-xs">
              Write tools still require approval. Tool filtering only narrows what the agent can reach in this session.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

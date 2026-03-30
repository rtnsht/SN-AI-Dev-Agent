'use client';

import { useState, type ReactNode } from 'react';
import { FileText, Layers, Link2, Plus, Table, Upload, X } from 'lucide-react';

export type ContextChipType = 'table' | 'updateSet' | 'scope' | 'file' | 'record' | 'system';

export interface ContextChip {
  id: string;
  type: ContextChipType;
  label: string;
  content?: string;
  tokens?: number;
}

export interface ContextRibbonProps {
  blocks: ContextChip[];
  onAddBlock: (type: ContextChipType) => void;
  onRemoveBlock: (id: string) => void;
}

const CHIP_META: Record<ContextChipType, { icon: ReactNode; className: string; label: string }> = {
  table: { icon: <Table className="w-3 h-3" />, className: 'fde-chip fde-chip-explore', label: 'Table' },
  updateSet: { icon: <Layers className="w-3 h-3" />, className: 'fde-chip fde-chip-build', label: 'Update Set' },
  scope: { icon: <Layers className="w-3 h-3" />, className: 'fde-chip fde-chip-sdd', label: 'Scope' },
  file: { icon: <Upload className="w-3 h-3" />, className: 'fde-chip', label: 'File' },
  record: { icon: <Link2 className="w-3 h-3" />, className: 'fde-chip fde-chip-flow', label: 'Record' },
  system: { icon: <FileText className="w-3 h-3" />, className: 'fde-chip fde-chip-analyze', label: 'System' },
};

const ADD_OPTIONS: { type: ContextChipType; label: string }[] = [
  { type: 'table', label: 'Add table context' },
  { type: 'updateSet', label: 'Add update set' },
  { type: 'scope', label: 'Add scope' },
  { type: 'file', label: 'Add file note' },
  { type: 'record', label: 'Link record' },
  { type: 'system', label: 'Add system note' },
];

export function ContextRibbon({ blocks, onAddBlock, onRemoveBlock }: ContextRibbonProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      className="fde-card px-3 py-2 flex items-center gap-2 overflow-x-auto fde-scroll"
      style={{ background: 'var(--fde-surface-2)', borderRadius: 'var(--fde-radius)' }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto fde-scroll">
        {blocks.length === 0 ? (
          <span className="text-xs" style={{ color: 'var(--fde-text-disabled)' }}>
            No context added yet. Add a table, update set, scope, or file.
          </span>
        ) : (
          blocks.map((block) => {
            const meta = CHIP_META[block.type];
            return (
              <div key={block.id} className={`${meta.className} flex-shrink-0`}>
                {meta.icon}
                <span className="truncate max-w-[160px]">{block.label}</span>
                <button
                  onClick={() => onRemoveBlock(block.id)}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${block.label}`}
                  title={`Remove ${block.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="relative flex-shrink-0">
        <button
          onClick={() => setPickerOpen((prev) => !prev)}
          className="fde-button fde-button-secondary inline-flex items-center gap-1"
          type="button"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
        {pickerOpen && (
          <div
            className="absolute right-0 bottom-full mb-2 min-w-[190px] rounded shadow-lg z-20"
            style={{
              background: 'var(--fde-surface-3)',
              border: '1px solid var(--fde-border-default)',
              boxShadow: 'var(--fde-shadow-lg)',
            }}
          >
            {ADD_OPTIONS.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => {
                  onAddBlock(option.type);
                  setPickerOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
                style={{ color: 'var(--fde-text-primary)' }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

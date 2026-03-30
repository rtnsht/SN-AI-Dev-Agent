'use client';

import { Keyboard } from 'lucide-react';

export interface ShortcutHintBarProps {
  queueLength?: number;
  onSkipAgent?: () => void;
  className?: string;
}

export function ShortcutHintBar({ queueLength = 0, onSkipAgent, className = '' }: ShortcutHintBarProps) {
  return (
    <div 
      className={`flex items-center gap-4 text-xs text-zinc-500 ${className}`}
      role="toolbar"
      aria-label="Keyboard shortcuts"
    >
      <div className="flex items-center gap-1">
        <Keyboard className="w-3 h-3" aria-hidden="true" />
        <span>Enter to send</span>
      </div>
      <span className="text-zinc-600" aria-hidden="true">|</span>
      <div className="flex items-center gap-1">
        <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-mono">Shift</kbd>
        <span>+</span>
        <span>Enter for new line</span>
      </div>
      {onSkipAgent && (
        <>
          <span className="text-zinc-600" aria-hidden="true">|</span>
          <button 
            onClick={onSkipAgent}
            className="flex items-center gap-1 hover:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 rounded px-1"
            aria-label="Skip agent (Command K)"
          >
            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-mono">Cmd</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-mono">K</kbd>
            <span>Skip agent</span>
          </button>
        </>
      )}
      {queueLength > 0 && (
        <div 
          className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-medium"
          role="status"
          aria-live="polite"
          aria-label={`${queueLength} messages queued`}
        >
          {queueLength} queued
        </div>
      )}
    </div>
  );
}

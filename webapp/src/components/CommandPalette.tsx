"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { filterCommands, type SlashCommand, type CommandContext } from "@/lib/slash-commands";
import { Terminal, Zap, Info, HelpCircle, Settings } from "lucide-react";

interface CommandPaletteProps {
  /** Current text in the input field */
  inputText: string;
  /** Command context for filtering available commands */
  ctx: CommandContext;
  /** Called when user selects a command — replaces input text */
  onSelect: (commandName: string) => void;
  /** Called when palette should be dismissed */
  onDismiss: () => void;
  /** Whether the palette is visible */
  visible: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  mode: <Zap size={14} />,
  context: <Info size={14} />,
  meta: <HelpCircle size={14} />,
  settings: <Settings size={14} />,
  chat: <Terminal size={14} />,
};

export default function CommandPalette({ inputText, ctx, onSelect, onDismiss, visible }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [commands, setCommands] = useState<SlashCommand[]>([]);

  useEffect(() => {
    if (!visible) return;
    const filtered = filterCommands(inputText, ctx);
    setCommands(filtered);
    setSelectedIndex(0);
  }, [inputText, ctx, visible]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || commands.length === 0) return;
      if (e.isComposing || e.key === "Process") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % commands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + commands.length) % commands.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        onSelect(commands[selectedIndex].name);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }
    },
    [visible, commands, selectedIndex, onSelect, onDismiss]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-cmd-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!visible || commands.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 z-50 max-h-64 overflow-y-auto rounded-lg border shadow-lg"
      style={{
        background: "var(--surface-elevated)",
        borderColor: "var(--border-default)",
      }}
      ref={listRef}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider opacity-50 font-medium">
        Commands
      </div>
      {commands.map((cmd, i) => (
        <button
          key={cmd.name}
          data-cmd-item
          className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer"
          style={{
            background: i === selectedIndex ? "var(--color-primary, #3b82f6)20" : "transparent",
            color: "var(--text-primary)",
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => onSelect(cmd.name)}
        >
          <span className="flex-shrink-0 opacity-60">
            {CATEGORY_ICONS[cmd.category] || <Terminal size={14} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="font-mono text-xs" style={{ color: "var(--color-primary, #3b82f6)" }}>
              {cmd.name}
            </span>
            {cmd.aliases.length > 0 && (
              <span className="ml-2 text-[10px] opacity-40">
                {cmd.aliases.slice(0, 2).join(", ")}
              </span>
            )}
            <span className="block text-xs opacity-60 truncate">{cmd.description}</span>
          </span>
          {i === selectedIndex && (
            <span className="flex-shrink-0 text-[10px] opacity-40 font-mono">
              Enter
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

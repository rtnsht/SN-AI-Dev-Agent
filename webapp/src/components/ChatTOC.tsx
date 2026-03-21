"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ChatMessage, SDLCPhase } from "@/lib/types";
import { SDLC_PHASES } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
}

interface TOCEntry {
  id: string;
  label: string;
  type: "phase" | "user" | "assistant" | "system";
  phase?: SDLCPhase;
  preview?: string;
  depth: number;
}

function buildTOC(messages: ChatMessage[]): TOCEntry[] {
  const entries: TOCEntry[] = [];
  const visible = messages.filter(m => !m.hidden);
  let lastPhase: SDLCPhase | undefined;

  for (let i = 0; i < visible.length; i++) {
    const msg = visible[i];
    const msgId = msg.id || `msg-${i}`;

    if (msg.phaseGate && msg.phaseGate !== lastPhase) {
      const info = SDLC_PHASES.find(p => p.key === msg.phaseGate);
      entries.push({
        id: msgId,
        label: `${info?.label || msg.phaseGate} Phase`,
        type: "phase",
        phase: msg.phaseGate,
        depth: 0,
      });
      lastPhase = msg.phaseGate;
    }

    const content = msg.content || "";
    let preview = "";
    if (msg.role === "user") {
      preview = content.slice(0, 80).replace(/\n/g, " ");
      if (content.length > 80) preview += "...";
    } else if (msg.role === "assistant") {
      const headingMatch = content.match(/^#+\s+(.+)/m);
      const boldMatch = content.match(/\*\*([^*]+)\*\*/);
      preview = headingMatch?.[1] || boldMatch?.[1] || content.slice(0, 60).replace(/\n/g, " ");
      if (preview.length > 60 && !headingMatch) preview = preview.slice(0, 60) + "...";
    } else {
      preview = content.slice(0, 50).replace(/\n/g, " ");
    }

    entries.push({
      id: msgId,
      label: msg.role === "user" ? "You" : msg.role === "system" ? "System" : "AI",
      type: msg.role,
      phase: msg.phaseGate,
      preview,
      depth: msg.phaseGate ? 1 : 0,
    });
  }
  return entries;
}

export default function ChatTOC({ messages, isOpen, onClose }: Props) {
  const [entries, setEntries] = useState<TOCEntry[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  const stableEntries = useMemo(() => buildTOC(messages), [messages]);

  useEffect(() => {
    setEntries(stableEntries);
  }, [stableEntries]);

  useEffect(() => {
    if (!isOpen || stableEntries.length === 0) return;
    const observer = new IntersectionObserver(
      (obs) => {
        for (const entry of obs) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-10% 0px -80% 0px" }
    );
    stableEntries.forEach(e => {
      const el = document.getElementById(e.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [stableEntries, isOpen]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const phaseColor: Record<string, string> = {
    spec: "var(--color-info)",
    design: "var(--color-primary)",
    scope_selection: "#a78bfa",
    implementation: "var(--color-warning)",
    testing: "#f472b6",
    deployment: "var(--color-success)",
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); onClose(); } }}
        role="button"
        tabIndex={0}
        aria-label="Close navigation"
      />
      <div
        className="fixed right-4 top-16 z-50 w-72 max-h-[70vh] rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Chat Navigation</span>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: "var(--text-disabled)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-disabled)"; }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {entries.map((entry, i) => (
            <button
              key={`${entry.id}-${i}`}
              onClick={() => scrollTo(entry.id)}
              className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-start gap-2 ${
                activeId === entry.id ? "font-medium" : ""
              }`}
              style={{
                paddingLeft: `${12 + entry.depth * 12}px`,
                background: activeId === entry.id ? "var(--surface-secondary)" : "transparent",
                color: activeId === entry.id ? "var(--text-primary)" : "var(--text-secondary)",
              }}
              onMouseEnter={e => { if (activeId !== entry.id) e.currentTarget.style.background = "var(--surface-secondary)"; }}
              onMouseLeave={e => { if (activeId !== entry.id) e.currentTarget.style.background = "transparent"; }}
            >
              {entry.type === "phase" ? (
                <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: phaseColor[entry.phase || ""] || "var(--text-disabled)" }} />
              ) : entry.type === "user" ? (
                <span className="text-[9px] mt-0.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }}>You</span>
              ) : entry.type === "system" ? (
                <span className="text-[9px] mt-0.5 flex-shrink-0" style={{ color: "var(--text-disabled)" }}>Sys</span>
              ) : (
                <span className="text-[9px] mt-0.5 flex-shrink-0" style={{ color: "var(--color-info)" }}>AI</span>
              )}
              <span className="truncate">
                {entry.type === "phase" ? (
                  <span className="font-semibold" style={{ color: phaseColor[entry.phase || ""] || "var(--text-primary)" }}>
                    {entry.label}
                  </span>
                ) : (
                  entry.preview || entry.label
                )}
              </span>
            </button>
          ))}
          {entries.length === 0 && (
            <div className="text-center py-4 text-[11px]" style={{ color: "var(--text-disabled)" }}>
              No messages yet
            </div>
          )}
        </div>
      </div>
    </>
  );
}

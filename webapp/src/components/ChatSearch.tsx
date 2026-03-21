"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  messageId: string;
  messageIndex: number;
  snippet: string;
  role: "user" | "assistant" | "system";
}

export default function ChatSearch({ messages, isOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setActiveIdx(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setActiveIdx(0);
      return;
    }
    const q = query.toLowerCase();
    const found: SearchResult[] = [];
    const visible = messages.filter(m => !m.hidden);
    for (let i = 0; i < visible.length; i++) {
      const msg = visible[i];
      const content = (msg.content || "").toLowerCase();
      const idx = content.indexOf(q);
      if (idx !== -1) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(content.length, idx + q.length + 30);
        const raw = msg.content || "";
        let snippet = (start > 0 ? "..." : "") + raw.slice(start, end) + (end < raw.length ? "..." : "");
        snippet = snippet.replace(/\n/g, " ");
        found.push({
          messageId: msg.id || `msg-${i}`,
          messageIndex: i,
          snippet,
          role: msg.role,
        });
      }
    }
    setResults(found);
    setActiveIdx(0);
  }, [query, messages]);

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightedElRef = useRef<{ el: HTMLElement; origRadius: string } | null>(null);

  const clearHighlight = useCallback(() => {
    if (highlightedElRef.current) {
      const { el, origRadius } = highlightedElRef.current;
      el.style.outline = "none";
      el.style.outlineOffset = "0";
      el.style.borderRadius = origRadius;
      highlightedElRef.current = null;
    }
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearHighlight();
  }, [clearHighlight]);

  const jumpTo = useCallback((result: SearchResult) => {
    clearHighlight();
    const el = document.getElementById(result.messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightedElRef.current = { el, origRadius: el.style.borderRadius };
      el.style.outline = "2px solid var(--color-primary)";
      el.style.outlineOffset = "4px";
      el.style.borderRadius = "8px";
      highlightTimerRef.current = setTimeout(() => clearHighlight(), 2000);
    }
  }, [clearHighlight]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      if (results.length > 0) {
        if (e.shiftKey) {
          const prev = (activeIdx - 1 + results.length) % results.length;
          setActiveIdx(prev);
          jumpTo(results[prev]);
        } else {
          jumpTo(results[activeIdx]);
          setActiveIdx((activeIdx + 1) % results.length);
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        const next = (activeIdx + 1) % results.length;
        setActiveIdx(next);
        jumpTo(results[next]);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        const prev = (activeIdx - 1 + results.length) % results.length;
        setActiveIdx(prev);
        jumpTo(results[prev]);
      }
    }
  }, [results, activeIdx, jumpTo, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-md"
      onKeyDown={handleKeyDown}
    >
      <div
        className="rounded-lg shadow-2xl overflow-hidden"
        style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-disabled)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search in chat..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {query && (
            <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-disabled)" }}>
              {results.length > 0 ? `${activeIdx + 1}/${results.length}` : "0 results"}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors flex-shrink-0"
            style={{ color: "var(--text-disabled)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-disabled)"; }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {results.length > 0 && (
          <div className="max-h-48 overflow-y-auto" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {results.map((r, i) => (
              <button
                key={`${r.messageId}-${i}`}
                onClick={() => { setActiveIdx(i); jumpTo(r); }}
                className="w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-start gap-2"
                style={{
                  background: i === activeIdx ? "var(--surface-secondary)" : "transparent",
                  color: i === activeIdx ? "var(--text-primary)" : "var(--text-secondary)",
                }}
                onMouseEnter={e => { if (i !== activeIdx) e.currentTarget.style.background = "var(--surface-secondary)"; }}
                onMouseLeave={e => { if (i !== activeIdx) e.currentTarget.style.background = "transparent"; }}
              >
                <span className="text-[9px] mt-0.5 flex-shrink-0 w-5" style={{ color: r.role === "user" ? "var(--text-disabled)" : "var(--color-info)" }}>
                  {r.role === "user" ? "You" : r.role === "system" ? "Sys" : "AI"}
                </span>
                <span className="truncate">{r.snippet}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

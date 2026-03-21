"use client";

import { useState, useRef, useEffect } from "react";
import type { SDLCPhase } from "@/lib/types";
import { SDLC_PHASES } from "@/lib/types";
import { Shield, ChevronDown, X } from "lucide-react";

interface SDDModeChipProps {
  /** Whether SDD mode is active */
  active: boolean;
  /** Current SDLC phase */
  currentPhase: SDLCPhase | null;
  /** Callback to switch to freeform mode */
  onSwitchToFreeform: () => void;
  /** Callback to show status */
  onShowStatus: () => void;
}

export default function SDDModeChip({
  active,
  currentPhase,
  onSwitchToFreeform,
  onShowStatus,
}: SDDModeChipProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [dropdownOpen]);

  if (!active) return null;

  const phaseInfo = currentPhase
    ? SDLC_PHASES.find((p) => p.key === currentPhase)
    : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
        style={{
          background: "color-mix(in srgb, var(--color-primary, #3b82f6) 15%, transparent)",
          color: "var(--color-primary, #3b82f6)",
          border: "1px solid color-mix(in srgb, var(--color-primary, #3b82f6) 30%, transparent)",
        }}
      >
        <Shield size={12} />
        <span>SDD</span>
        {phaseInfo && (
          <>
            <span className="opacity-40">|</span>
            <span className="opacity-80">{phaseInfo.label}</span>
          </>
        )}
        <ChevronDown size={10} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
      </button>

      {dropdownOpen && (
        <div
          className="absolute bottom-full left-0 mb-1 min-w-[180px] rounded-lg border shadow-lg overflow-hidden z-50"
          style={{
            background: "var(--surface-elevated)",
            borderColor: "var(--border-default)",
          }}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:opacity-80 cursor-pointer"
            style={{ color: "var(--text-primary)" }}
            onClick={() => {
              onShowStatus();
              setDropdownOpen(false);
            }}
          >
            <Shield size={12} className="opacity-60" />
            View status
          </button>
          <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:opacity-80 cursor-pointer"
            style={{ color: "var(--text-disabled)" }}
            onClick={() => {
              onSwitchToFreeform();
              setDropdownOpen(false);
            }}
          >
            <X size={12} className="opacity-60" />
            Switch to freeform
          </button>
        </div>
      )}
    </div>
  );
}

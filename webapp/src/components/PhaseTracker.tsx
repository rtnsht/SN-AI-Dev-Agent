"use client";

import type { SDLCPhase } from "@/lib/types";
import { SDLC_PHASES } from "@/lib/types";

interface Props {
  /** Currently active phase (the one in progress) */
  currentPhase: SDLCPhase | null;
  /** Phases that have been approved/completed */
  completedPhases: SDLCPhase[];
  /** The requirement ID being worked on */
  reqId: string | null;
  /** Callback when user clicks a phase to navigate to it */
  onPhaseClick?: (phase: SDLCPhase) => void;
}

/** Palantir-style phase index labels */
const PHASE_INDEX: Record<SDLCPhase, string> = {
  spec: "/0.1",
  design: "/0.2",
  scope_selection: "/0.3",
  implementation: "/0.4",
  testing: "/0.5",
  deployment: "/0.6",
};

export default function PhaseTracker({ currentPhase, completedPhases, reqId, onPhaseClick }: Props) {
  if (!reqId || !currentPhase) return null;

  return (
    <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md" style={{ background: "var(--surface-secondary)" }}>
      {reqId && (
        <span className="hidden sm:inline text-[10px] font-mono mr-1" style={{ color: "var(--text-disabled)" }}>{reqId}</span>
      )}
      {SDLC_PHASES.map((phase, i) => {
        const isCompleted = completedPhases.includes(phase.key);
        const isCurrent = phase.key === currentPhase;
        const isFuture = !isCompleted && !isCurrent;

        const statusText = isCompleted ? "Complete" : isCurrent ? "In progress" : "Pending";
        const gateText = phase.requiresApproval ? "Requires approval" : "Auto-proceeds";
        const hoverTitle = `${PHASE_INDEX[phase.key]} ${phase.label} — ${statusText}\n${gateText}`;

        // Status dot color
        const dotColor = isCompleted
          ? "var(--status-success)"
          : isCurrent
            ? "var(--status-progress)"
            : "var(--status-todo)";

        return (
          <div key={phase.key} className="flex items-center">
            {i > 0 && (
              <div
                className="w-3 sm:w-4 h-px mx-0.5"
                style={{ background: isCompleted ? "var(--status-success)" : "var(--border-default)" }}
              />
            )}
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded transition-all ${
                isCurrent ? "ring-1 ring-[rgba(76,125,255,0.3)]" : ""
              } ${(isCompleted || isCurrent) && onPhaseClick ? "cursor-pointer hover:opacity-80" : ""}`}
              style={{
                background: isCurrent ? "rgba(76,125,255,0.12)" : isCompleted ? "rgba(56,201,118,0.06)" : "transparent",
              }}
              title={hoverTitle}
              onClick={() => {
                if ((isCompleted || isCurrent) && onPhaseClick) onPhaseClick(phase.key);
              }}
              role={(isCompleted || isCurrent) && onPhaseClick ? "button" : undefined}
              tabIndex={(isCompleted || isCurrent) && onPhaseClick ? 0 : undefined}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && (isCompleted || isCurrent) && onPhaseClick) {
                  e.preventDefault();
                  onPhaseClick(phase.key);
                }
              }}
            >
              {/* Status dot */}
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: dotColor,
                  ...(isCurrent ? { animation: "statusPulse 2s ease-in-out infinite" } : {}),
                }}
              />
              {/* Phase index + label */}
              <span className="hidden sm:flex items-baseline gap-1">
                <span className="phase-label" style={{ fontSize: "9px", color: "var(--text-disabled)" }}>
                  {PHASE_INDEX[phase.key]}
                </span>
                <span
                  className="text-[10px] sm:text-[11px] font-medium"
                  style={{
                    color: isCurrent ? "var(--color-info)" : isCompleted ? "var(--color-success)" : "var(--text-disabled)",
                  }}
                >
                  {phase.label}
                </span>
              </span>
              {/* Mobile: abbreviated */}
              <span
                className="sm:hidden text-[9px] font-medium"
                style={{
                  color: isCurrent ? "var(--color-info)" : isCompleted ? "var(--color-success)" : "var(--text-disabled)",
                }}
              >
                {phase.label.slice(0, 4)}
              </span>
              {/* Gate type indicator on desktop */}
              {isFuture && (
                <span className="hidden sm:inline text-[8px]" style={{ color: "var(--text-disabled)", opacity: 0.6 }}>
                  {phase.requiresApproval ? "🔒" : "⚡"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


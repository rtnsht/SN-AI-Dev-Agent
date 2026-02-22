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
}

export default function PhaseTracker({ currentPhase, completedPhases, reqId }: Props) {
  if (!reqId || !currentPhase) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 rounded-lg border border-gray-700/50">
      <span className="text-[10px] text-gray-500 font-medium mr-1">{reqId}</span>
      {SDLC_PHASES.map((phase, i) => {
        const isCompleted = completedPhases.includes(phase.key);
        const isCurrent = phase.key === currentPhase;
        const isPast = isCompleted;
        const isFuture = !isCompleted && !isCurrent;

        return (
          <div key={phase.key} className="flex items-center">
            {i > 0 && (
              <div className={`w-3 h-px mx-0.5 ${isPast ? "bg-green-500" : "bg-gray-700"}`} />
            )}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                isCurrent
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                  : isCompleted
                    ? "bg-green-500/10 text-green-400"
                    : "text-gray-600"
              }`}
              title={`${phase.label}${isCompleted ? " ✓" : isCurrent ? " (in progress)" : ""}`}
            >
              {isCompleted && (
                <svg className="w-2.5 h-2.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isCurrent && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />}
              {isFuture && <span className="w-1.5 h-1.5 bg-gray-700 rounded-full" />}
              <span>{phase.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


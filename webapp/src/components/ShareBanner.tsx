"use client";

import { Share2, X } from "lucide-react";

import type { ShareMetrics } from "@/lib/share-content";

interface ShareBannerProps {
  stats: ShareMetrics;
  onShare: () => void;
  onDismiss: () => void;
}

export default function ShareBanner({ stats, onShare, onDismiss }: ShareBannerProps) {
  const stageLabel = `${stats.phaseCount} ${stats.phaseCount === 1 ? "stage" : "stages"}`;
  const durationLabel = `${stats.durationMin} min`;

  return (
    <div className="app-banner app-banner-success">
      <div className="app-banner-inner" style={{ justifyContent: "flex-start", paddingRight: "4rem" }}>
        <Share2 className="app-banner-icon" strokeWidth={1.8} />
        <div className="app-banner-text">
          <strong>{stageLabel}</strong> down, <strong>{durationLabel}</strong> in. Other ServiceNow builders could learn from this.
        </div>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={{
            background: "color-mix(in srgb, var(--surface-primary) 88%, transparent)",
            border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
          Share this
        </button>
      </div>
      <button type="button" onClick={onDismiss} className="app-banner-dismiss" aria-label="Dismiss share prompt">
        <X className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
}

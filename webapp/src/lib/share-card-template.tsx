/**
 * CSS-only share card fallback component.
 *
 * Used when AI image generation is unavailable (no OpenAI key, rate limited, etc.).
 * Renders a styled React component — NOT a Satori/ImageResponse template.
 */

import {
  buildShareHeadline,
  buildShareSubline,
  normalizeShareMetrics,
  sanitizeHashtag,
  SHARE_APP_URL,
  type ShareMetrics,
} from "@/lib/share-content";

interface ShareCardFallbackProps {
  metrics: ShareMetrics;
  tag?: string;
}

export function ShareCardFallback({ metrics, tag }: ShareCardFallbackProps) {
  const normalized = normalizeShareMetrics(metrics);
  const headline = buildShareHeadline(normalized);
  const subline = buildShareSubline(normalized);
  const safeTag = sanitizeHashtag(tag);

  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #08111f 0%, #0d1730 40%, #1d2f63 100%)",
        color: "#f8fafc",
        padding: "28px",
        minHeight: "250px",
      }}
    >
      {/* Decorative circles */}
      <div
        className="absolute rounded-full"
        style={{ top: -80, right: -60, width: 220, height: 220, background: "rgba(96,165,250,0.14)" }}
      />
      <div
        className="absolute rounded-full"
        style={{ bottom: -100, left: -40, width: 220, height: 220, background: "rgba(168,85,247,0.12)" }}
      />

      <div className="relative space-y-3">
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "#93c5fd" }}
        >
          SN AI Agent
        </div>
        <div className="text-[18px] font-bold leading-snug tracking-tight">
          {headline}
        </div>
        <div className="text-[12px]" style={{ color: "rgba(226,232,240,0.82)" }}>
          {subline}
        </div>
        <div className="flex gap-2 flex-wrap pt-1">
          {[
            `${normalized.durationMin} min session`,
            `${normalized.phaseCount} SDLC stages`,
            `${normalized.toolCount} AI-guided ops`,
          ].map((label) => (
            <span
              key={label}
              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: "#dbe7ff",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        className="relative flex justify-between items-end pt-4 mt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.14)" }}
      >
        <div className="space-y-0.5">
          <div className="text-[11px] font-semibold" style={{ color: "rgba(226,232,240,0.88)" }}>
            {SHARE_APP_URL.replace(/^https?:\/\//, "")}
          </div>
          <div className="text-[9px]" style={{ color: "rgba(147,197,253,0.78)" }}>
            Built for the ServiceNow community
          </div>
        </div>
        <div className="text-[10px] text-right" style={{ color: "rgba(191,219,254,0.84)" }}>
          #servicenow #ai {safeTag}
        </div>
      </div>
    </div>
  );
}

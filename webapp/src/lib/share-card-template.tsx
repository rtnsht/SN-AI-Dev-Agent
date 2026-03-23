import type { ReactElement } from "react";

import {
  SHARE_APP_URL,
  buildShareHeadline,
  buildShareSubline,
  normalizeShareMetrics,
  sanitizeHashtag,
  type ShareMetrics,
} from "@/lib/share-content";

interface ShareCardTemplateProps {
  /** Raster/SVG data URI, or null to render a CSS lettermark (Satori-safe). */
  logoDataUri: string | null;
  metrics: ShareMetrics;
  tag: string;
}

function StatPill({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "14px 22px",
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.16)",
        color: "#dbe7ff",
        fontSize: 26,
        fontWeight: 500,
        letterSpacing: "-0.02em",
      }}
    >
      {label}
    </div>
  );
}

export function ShareCardTemplate({ logoDataUri, metrics, tag }: ShareCardTemplateProps): ReactElement {
  const normalized = normalizeShareMetrics(metrics);
  const headline = buildShareHeadline(normalized);
  const subline = buildShareSubline(normalized);
  const safeTag = sanitizeHashtag(tag);

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#0a1020",
        color: "#f8fafc",
        padding: 48,
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background: "linear-gradient(135deg, #08111f 0%, #0d1730 40%, #1d2f63 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -140,
          right: -120,
          width: 420,
          height: 420,
          borderRadius: 999,
          background: "rgba(96,165,250,0.16)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -180,
          left: -80,
          width: 420,
          height: 420,
          borderRadius: 999,
          background: "rgba(168,85,247,0.14)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 18,
          borderRadius: 28,
          border: "1px solid rgba(96,165,250,0.28)",
          display: "flex",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 34, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {logoDataUri ? (
            <img src={logoDataUri} alt="SN AI Agent" width={56} height={56} />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)",
                color: "#ffffff",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.04em",
              }}
            >
              SN
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, color: "#93c5fd", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              SN AI Agent
            </div>
            <div style={{ fontSize: 18, color: "rgba(226,232,240,0.75)" }}>
              More time to think
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 72, lineHeight: 1.02, letterSpacing: "-0.05em", fontWeight: 700, maxWidth: 980 }}>
            {headline}
          </div>
          <div style={{ fontSize: 28, color: "rgba(226,232,240,0.82)", letterSpacing: "-0.02em" }}>
            {subline}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <StatPill label={`${normalized.durationMin} min session`} />
          <StatPill label={`${normalized.phaseCount} SDLC stages`} />
          <StatPill label={`${normalized.toolCount} AI-guided ops`} />
        </div>
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          paddingTop: 28,
          borderTop: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 24, color: "rgba(226,232,240,0.88)", fontWeight: 600 }}>
              {SHARE_APP_URL.replace(/^https?:\/\//, "")}
            </div>
            <div style={{ fontSize: 18, color: "rgba(147,197,253,0.78)" }}>
              Built for the ServiceNow community
            </div>
          </div>
          <div style={{ fontSize: 22, color: "rgba(191,219,254,0.84)", textAlign: "right", maxWidth: 480 }}>
            #servicenow #ai {safeTag}
          </div>
        </div>
      </div>
    </div>
  );
}

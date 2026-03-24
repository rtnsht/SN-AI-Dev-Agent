/**
 * POST /api/share-image
 *
 * Default: Satori (next/og) — deterministic, fast, no external API key needed.
 * Optional: pass `useAI: true` to generate an artistic image via Gemini.
 *
 * Env: GEMINI_API_KEY — required only for the AI path
 */

import { ImageResponse } from "next/og";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";

import { checkShareImage } from "@/lib/auth-rate-limiter";
import { getClientIp } from "@/lib/client-ip";
import { resolveShareSessionContext } from "@/lib/share-server";
import {
  buildShareAchievement,
  buildShareHeadline,
  buildShareSubline,
  normalizeShareMetrics,
  sanitizeHashtag,
  SHARE_APP_URL,
  type ShareMetrics,
} from "@/lib/share-content";

export const runtime = "nodejs";

const SESSION_ID_PATTERN = /^sess_\d{13,20}_[A-Za-z0-9-]{6,64}$/;
const GEMINI_MODEL = "gemini-3-pro-image-preview";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/* ── Font loading: local public/fonts/ first, CDN fallback ──────────────── */

let fontRegularBuf: ArrayBuffer | null = null;
let fontSemiBoldBuf: ArrayBuffer | null = null;
let fontBoldBuf: ArrayBuffer | null = null;
let logoCachedUri: string | null = null;

const FONT_LOCAL = {
  regular:  join(process.cwd(), "public/fonts/inter-400.woff"),
  semiBold: join(process.cwd(), "public/fonts/inter-600.woff"),
  bold:     join(process.cwd(), "public/fonts/inter-700.woff"),
};
const FONT_CDN = {
  regular:  "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff",
  semiBold: "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-600-normal.woff",
  bold:     "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff",
};

async function loadFont(localPath: string, cdnUrl: string): Promise<ArrayBuffer> {
  if (existsSync(localPath)) {
    return readFileSync(localPath).buffer as ArrayBuffer;
  }
  const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Font CDN ${res.status}: ${cdnUrl}`);
  return res.arrayBuffer();
}

async function ensureFonts(): Promise<[ArrayBuffer, ArrayBuffer, ArrayBuffer]> {
  if (fontRegularBuf && fontSemiBoldBuf && fontBoldBuf) {
    return [fontRegularBuf, fontSemiBoldBuf, fontBoldBuf];
  }
  const [r, sb, b] = await Promise.all([
    loadFont(FONT_LOCAL.regular,  FONT_CDN.regular),
    loadFont(FONT_LOCAL.semiBold, FONT_CDN.semiBold),
    loadFont(FONT_LOCAL.bold,     FONT_CDN.bold),
  ]);
  fontRegularBuf = r;
  fontSemiBoldBuf = sb;
  fontBoldBuf = b;
  return [r, sb, b];
}

function getLogoDataUri(): string {
  if (logoCachedUri !== null) return logoCachedUri;
  try {
    const svg = readFileSync(join(process.cwd(), "public/logo-r-v10.svg"), "utf8");
    logoCachedUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    logoCachedUri = "";
  }
  return logoCachedUri;
}

/* ── Satori card component ──────────────────────────────────────────────── */

function ShareCardImage({ metrics }: { metrics: ShareMetrics }) {
  const n = normalizeShareMetrics(metrics);
  const headline = buildShareHeadline(n);
  const subline = buildShareSubline(n);
  const domain = SHARE_APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const logo = getLogoDataUri();

  const tags: string[] = ["#servicenow", "#ai"];
  const aiTag = sanitizeHashtag(n.aiTag);
  if (aiTag && !tags.includes(aiTag)) tags.push(aiTag);

  const pills = [
    `${n.durationMin} min session`,
    `${n.phaseCount} SDLC stages`,
    `${n.toolCount} AI-guided ops`,
  ];

  return (
    <div
      style={{
        display: "flex",
        width: 1200,
        height: 630,
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #080e1e 0%, #0d1830 45%, #182b58 100%)",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", position: "absolute", top: -80, right: -50, width: 340, height: 340, borderRadius: 170, background: "radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 70%)" }} />
      <div style={{ display: "flex", position: "absolute", bottom: -100, left: -40, width: 300, height: 300, borderRadius: 150, background: "radial-gradient(circle, rgba(124,58,237,0.11) 0%, transparent 70%)" }} />
      <div style={{ display: "flex", position: "absolute", top: 200, right: 120, width: 140, height: 140, borderRadius: 70, background: "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)" }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          margin: 30,
          padding: "44px 52px",
          borderRadius: 20,
          border: "1px solid rgba(96,165,250,0.16)",
          flex: 1,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={44} height={44} style={{ borderRadius: 10, marginRight: 14 }} alt="" />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.18em", color: "#93c5fd" }}>SN AI Agent</span>
            <span style={{ fontSize: 12, color: "#4b6a94", marginTop: 2 }}>Say it. Ship it.</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
          <span style={{ fontSize: 34, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.22, letterSpacing: "-0.01em" }}>{headline}</span>
          <span style={{ fontSize: 16, color: "#8b9fc4", marginTop: 14, lineHeight: 1.5 }}>{subline}</span>
          <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
            {pills.map((label) => (
              <span key={label} style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: "#c1cfe0", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999, padding: "7px 18px" }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 30, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#4b6a94" }}>{domain}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#7dd3fc" }}>{tags.join("  ")}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Satori renderer ────────────────────────────────────────────────────── */

async function renderWithSatori(metrics: ShareMetrics): Promise<{ imageBase64: string; mimeType: string } | null> {
  try {
    const [regular, semiBold, bold] = await ensureFonts();
    const response = new ImageResponse(
      (<ShareCardImage metrics={metrics} />),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: "Inter", data: regular,  weight: 400 as const, style: "normal" as const },
          { name: "Inter", data: semiBold, weight: 600 as const, style: "normal" as const },
          { name: "Inter", data: bold,     weight: 700 as const, style: "normal" as const },
        ],
      },
    );
    const buffer = await response.arrayBuffer();
    return { imageBase64: Buffer.from(buffer).toString("base64"), mimeType: "image/png" };
  } catch (err) {
    console.error("[share-image] Satori render failed:", err);
    return null;
  }
}

/* ── Gemini AI renderer ─────────────────────────────────────────────────── */

function buildGeminiPrompt(metrics: ShareMetrics): string {
  const n = normalizeShareMetrics(metrics);
  const achievement = buildShareAchievement(n);
  const headline = buildShareHeadline(n);
  const subline = buildShareSubline(n);
  const domain = SHARE_APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const tags: string[] = ["#servicenow", "#ai"];
  const aiTag = sanitizeHashtag(n.aiTag);
  if (aiTag && !tags.includes(aiTag)) tags.push(aiTag);

  return [
    "Generate a professional, visually striking share card image for social media (LinkedIn / X).",
    "",
    "The card MUST include these text elements, rendered clearly and legibly:",
    `- Headline (large, bold, white): "${headline}"`,
    `- Subline (smaller, light blue): "${subline}"`,
    `- App branding (top-left, small caps, tracked): "SN AI AGENT"`,
    `- Tagline (below branding, muted): "Say it. Ship it."`,
    `- Stats as rounded pills: "${n.durationMin} min session" | "${n.phaseCount} SDLC stages" | "${n.toolCount} AI-guided ops"`,
    `- Footer: "${domain}" on the left, "${tags.join("  ")}" on the right`,
    "",
    `The image celebrates completing ${achievement} using AI-assisted ServiceNow development.`,
    "",
    "Visual style:",
    "- Background: rich dark gradient from deep navy (#080e1e) through midnight blue (#0d1830) to indigo (#182b58)",
    "- Decorative: subtle glowing blue and violet orbs, faint circuit-board traces, flowing light trails",
    "- Inner border: rounded rectangle with a faint blue glow",
    "- Text: white and light blue on dark, high contrast, clean sans-serif font",
    "- Stats pills: frosted glass effect with subtle white border",
    "- Footer separated by a thin horizontal line",
    "",
    "Layout: landscape 16:9 aspect ratio. All text must be sharp, readable, and correctly spelled.",
  ].join("\n");
}

async function renderWithGemini(metrics: ShareMetrics, apiKey: string): Promise<{ imageBase64: string; mimeType: string } | null> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildGeminiPrompt(metrics) }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[share-image] Gemini error:", response.status, errText.slice(0, 300));
      return null;
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          return { imageBase64: part.inlineData.data, mimeType: part.inlineData.mimeType };
        }
      }
    }
    console.error("[share-image] Gemini returned no image");
    return null;
  } catch (err) {
    console.error("[share-image] Gemini fetch error:", err);
    return null;
  }
}

/* ── POST handler ───────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const rateLimit = await checkShareImage(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many image generation requests. Please try again later." }, { status: 429 });
    }

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const record = body as Record<string, unknown>;

    const sessionId = String(record.sessionId || "");
    if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
      return NextResponse.json({ error: "Missing or invalid sessionId" }, { status: 400 });
    }

    let resolved;
    try { resolved = await resolveShareSessionContext(request, sessionId); }
    catch (err) {
      console.error("[share-image] Session resolution crashed:", err);
      return NextResponse.json({ error: "Session verification failed" }, { status: 500 });
    }
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error || "Unauthorized" }, { status: resolved.status });
    }

    const metrics: ShareMetrics = {
      durationMin:    typeof record.durationMin === "number" ? record.durationMin : 1,
      phaseCount:     typeof record.phaseCount  === "number" ? record.phaseCount  : 1,
      toolCount:      typeof record.toolCount   === "number" ? record.toolCount   : 1,
      assistantCount: typeof record.assistantCount === "number" ? record.assistantCount : 1,
      aiTag: sanitizeHashtag(typeof record.tag === "string" ? record.tag : null),
    };

    const useAI = record.useAI === true;

    // AI path (Gemini) — only when explicitly requested and key is available
    if (useAI) {
      const geminiKey = process.env.GEMINI_API_KEY || "";
      if (!geminiKey) {
        return NextResponse.json({ error: "AI image generation is not configured on this server.", geminiUnavailable: true }, { status: 503 });
      }
      const aiResult = await renderWithGemini(metrics, geminiKey);
      if (aiResult) return NextResponse.json({ ...aiResult, source: "gemini" });
      // Gemini failed — fall through to Satori
    }

    // Default path: Satori
    const satoriResult = await renderWithSatori(metrics);
    if (satoriResult) return NextResponse.json({ ...satoriResult, source: "satori" });

    // Both failed — signal CSS fallback
    return NextResponse.json({ fallback: true, metrics: normalizeShareMetrics(metrics) });
  } catch (error) {
    console.error("[share-image] Unhandled error:", error);
    return NextResponse.json({ error: "Failed to generate share image" }, { status: 500 });
  }
}

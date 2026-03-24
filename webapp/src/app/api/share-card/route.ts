import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

import { checkShareCard } from "@/lib/auth-rate-limiter";
import { getClientIp } from "@/lib/client-ip";
import { normalizeShareMetrics, sanitizeHashtag } from "@/lib/share-content";
import { ShareCardTemplate } from "@/lib/share-card-template";
import { resolveShareSessionContext } from "@/lib/share-server";

export const runtime = "nodejs";

const size = {
  width: 1200,
  height: 628,
};

/** `false` = not yet resolved; `null` = use CSS lettermark (PNG/SVG missing or unreadable). */
let cachedLogoDataUri: string | null | false = false;

/**
 * Prefer `public/logo-share-card.png` (raster, reliable in Satori) when present;
 * else SVG data URI; else null for template fallback.
 */
async function getLogoDataUri(): Promise<string | null> {
  if (cachedLogoDataUri !== false) return cachedLogoDataUri;
  const cwd = process.cwd();
  const pngPath = join(cwd, "public", "logo-share-card.png");
  try {
    const buf = await readFile(pngPath);
    cachedLogoDataUri = `data:image/png;base64,${buf.toString("base64")}`;
    return cachedLogoDataUri;
  } catch {
    /* optional asset */
  }
  try {
    const svg = await readFile(join(cwd, "public", "logo-r-v10.svg"), "utf8");
    cachedLogoDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    return cachedLogoDataUri;
  } catch {
    cachedLogoDataUri = null;
    return null;
  }
}

function parseMetric(value: string | null, fallback: number): number {
  // `Number(null)` is 0 — treat missing/empty query params as "use fallback"
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const rateLimit = await checkShareCard(ip);
    if (!rateLimit.allowed) {
      return new Response("Too many share card requests", { status: 429 });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
    if (!sessionId || !/^sess_\d{13,20}_[A-Za-z0-9-]{6,64}$/.test(sessionId)) {
      return new Response("Missing or invalid sessionId", { status: 400 });
    }

    const resolved = await resolveShareSessionContext(request, sessionId);
    if (!resolved.ok) {
      return new Response(resolved.error || "Unauthorized", { status: resolved.status });
    }

    const metrics = normalizeShareMetrics({
      durationMin: parseMetric(request.nextUrl.searchParams.get("durationMin"), 12),
      phaseCount: parseMetric(request.nextUrl.searchParams.get("phaseCount"), 1),
      toolCount: parseMetric(request.nextUrl.searchParams.get("toolCount"), 1),
      assistantCount: parseMetric(request.nextUrl.searchParams.get("assistantCount"), 3),
      aiTag: sanitizeHashtag(request.nextUrl.searchParams.get("tag")),
    });

    const logoDataUri = await getLogoDataUri();

    return new ImageResponse(
      ShareCardTemplate({
        logoDataUri: logoDataUri ?? null,
        metrics,
        tag: metrics.aiTag || "",
      }),
      size
    );
  } catch (error) {
    console.error("[share-card] Error:", error);
    return new Response("Failed to generate share card", { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

import { checkShareTracking } from "@/lib/auth-rate-limiter";
import { getClientIp } from "@/lib/client-ip";
import { parseShareTrackingBody } from "@/lib/request-validation";
import { computeShareFingerprint, resolveShareSessionContext } from "@/lib/share-server";
import { getSupabase } from "@/lib/supabase";

interface ShareTrackingRow {
  id: string;
  shown_count: number;
  shared_at: string | null;
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key|unique constraint/i.test(error.message || "");
}

async function loadTrackingRow(fingerprint: string): Promise<ShareTrackingRow | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from("share_prompt_tracking")
    .select("id, shown_count, shared_at")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ShareTrackingRow | null;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const rateLimit = await checkShareTracking(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many share requests. Please try again later." }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parseShareTrackingBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { sessionId, action, platform } = parsed.data;
    const resolved = await resolveShareSessionContext(request, sessionId);
    if (!resolved.ok || !resolved.context) {
      return NextResponse.json({ error: resolved.error || "Unauthorized" }, { status: resolved.status });
    }

    const fingerprint = computeShareFingerprint(resolved.context);
    if (!fingerprint) {
      return NextResponse.json({ ok: true, canShow: false, fingerprint: null });
    }

    const db = getSupabase();
    let existing = await loadTrackingRow(fingerprint);
    const now = new Date().toISOString();

    if (action === "shown") {
      if (existing?.shared_at || (existing?.shown_count ?? 0) >= 2) {
        return NextResponse.json({ ok: true, canShow: false, fingerprint });
      }

      const nextCount = Math.min((existing?.shown_count ?? 0) + 1, 2);
      if (existing) {
        const { error } = await db
          .from("share_prompt_tracking")
          .update({
            shown_count: nextCount,
            last_shown_at: now,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from("share_prompt_tracking").insert({
          fingerprint,
          shown_count: nextCount,
          last_shown_at: now,
        });
        if (error) {
          if (isUniqueViolation(error)) {
            existing = await loadTrackingRow(fingerprint);
            if (!existing) throw new Error("share_tracking insert race: row missing after conflict");
            if (existing.shared_at || (existing.shown_count ?? 0) >= 2) {
              return NextResponse.json({ ok: true, canShow: false, fingerprint });
            }
            const retryCount = Math.min((existing.shown_count ?? 0) + 1, 2);
            const { error: upErr } = await db
              .from("share_prompt_tracking")
              .update({ shown_count: retryCount, last_shown_at: now })
              .eq("id", existing.id);
            if (upErr) throw new Error(upErr.message);
            return NextResponse.json({ ok: true, canShow: true, fingerprint });
          }
          throw new Error(error.message);
        }
      }

      return NextResponse.json({ ok: true, canShow: true, fingerprint });
    }

    if (action === "dismissed") {
      if (existing) {
        const { error } = await db
          .from("share_prompt_tracking")
          .update({
            shown_count: 2,
            last_shown_at: now,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from("share_prompt_tracking").insert({
          fingerprint,
          shown_count: 2,
          last_shown_at: now,
        });
        if (error) {
          if (isUniqueViolation(error)) {
            existing = await loadTrackingRow(fingerprint);
            if (existing) {
              const { error: upErr } = await db
                .from("share_prompt_tracking")
                .update({ shown_count: 2, last_shown_at: now })
                .eq("id", existing.id);
              if (upErr) throw new Error(upErr.message);
            }
          } else {
            throw new Error(error.message);
          }
        }
      }

      return NextResponse.json({ ok: true, fingerprint });
    }

    if (action === "shared") {
      if (existing) {
        const { error } = await db
          .from("share_prompt_tracking")
          .update({
            shown_count: 2,
            last_shown_at: now,
            shared_at: now,
            platform,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from("share_prompt_tracking").insert({
          fingerprint,
          shown_count: 2,
          last_shown_at: now,
          shared_at: now,
          platform,
        });
        if (error) {
          if (isUniqueViolation(error)) {
            existing = await loadTrackingRow(fingerprint);
            if (existing) {
              const { error: upErr } = await db
                .from("share_prompt_tracking")
                .update({
                  shown_count: 2,
                  last_shown_at: now,
                  shared_at: now,
                  platform,
                })
                .eq("id", existing.id);
              if (upErr) throw new Error(upErr.message);
            }
          } else {
            throw new Error(error.message);
          }
        }
      }

      return NextResponse.json({ ok: true, fingerprint });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error("[share-tracking] Error:", error);
    return NextResponse.json({ error: "Failed to update share tracking." }, { status: 500 });
  }
}

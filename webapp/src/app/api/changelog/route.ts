import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function isSingleRowMissing(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const code = String((err as { code?: string }).code ?? "");
  return code === "PGRST116";
}

export async function GET() {
  try {
    const db = getSupabase();

    const releaseResult = await db
      .from("releases")
      .select("id, version, title, release_date, status")
      .eq("status", "published")
      .order("release_date", { ascending: false })
      .limit(1)
      .single();

    let currentRelease = releaseResult.data ?? null;
    if (releaseResult.error && !isSingleRowMissing(releaseResult.error)) {
      console.error("[changelog] releases query error:", releaseResult.error);
      currentRelease = null;
    }

    const changelogQuery = currentRelease
      ? db
          .from("changelog")
          .select("id, title, status, category, description, display_order, release_id, created_at")
          .or(`release_id.eq.${currentRelease.id},release_id.is.null`)
          .order("display_order", { ascending: true })
          .limit(50)
      : db
          .from("changelog")
          .select("id, title, status, category, description, display_order, release_id, created_at")
          .order("display_order", { ascending: true })
          .limit(50);

    const changelogResult = await changelogQuery;
    if (changelogResult.error) {
      console.error("[changelog] changelog query error:", changelogResult.error);
    }

    const entries = changelogResult.data ?? [];

    return NextResponse.json({ currentRelease, entries });
  } catch (err) {
    console.error("[changelog] GET error:", err);
    return NextResponse.json({ currentRelease: null, entries: [] });
  }
}

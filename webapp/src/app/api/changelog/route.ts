import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const db = getSupabase();

    const [releaseResult, changelogResult] = await Promise.all([
      db
        .from("releases")
        .select("id, version, title, release_date, status")
        .eq("status", "published")
        .order("release_date", { ascending: false })
        .limit(1)
        .single(),
      db
        .from("changelog")
        .select("id, title, status, category, description, display_order, release_id, created_at")
        .order("display_order", { ascending: true })
        .limit(50),
    ]);

    const currentRelease = releaseResult.data ?? null;
    const entries = changelogResult.data ?? [];

    return NextResponse.json({ currentRelease, entries });
  } catch (err) {
    console.error("[changelog] GET error:", err);
    return NextResponse.json({ currentRelease: null, entries: [] });
  }
}

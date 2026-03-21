import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("changelog")
      .select("id, title, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;
    return NextResponse.json({ entries: data || [] });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}

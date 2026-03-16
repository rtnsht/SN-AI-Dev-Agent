import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** GET /api/admin/instances — list all known ServiceNow instances (for admin dropdown) */
export async function GET() {
  try {
    const db = getSupabase();

    // Fetch all instances joined with user info
    const { data: instances, error } = await db
      .from("user_instances")
      .select("id, user_id, instance_url, instance_name, sn_username, last_connected_at")
      .order("last_connected_at", { ascending: false });

    if (error) {
      console.error("[admin/instances] DB error:", error.message);
      return NextResponse.json({ error: "Failed to fetch instances" }, { status: 500 });
    }

    // Fetch users for name/email mapping
    const { data: users } = await db
      .from("users")
      .select("id, name, email");

    const userMap = new Map<string, { name: string; email: string }>();
    for (const u of users || []) {
      userMap.set(u.id, { name: u.name, email: u.email });
    }

    // Deduplicate by instance_url — keep the most recent connection per URL
    const seen = new Map<string, typeof enriched[0]>();
    const enriched = (instances || []).map((inst) => {
      const u = userMap.get(inst.user_id);
      return {
        id: inst.id,
        instance_url: inst.instance_url,
        instance_name: inst.instance_name || inst.instance_url,
        sn_username: inst.sn_username || "",
        user_name: u?.name || "",
        user_email: u?.email || "",
        last_connected_at: inst.last_connected_at,
      };
    });

    for (const inst of enriched) {
      if (!seen.has(inst.instance_url)) {
        seen.set(inst.instance_url, inst);
      }
    }

    return NextResponse.json({ instances: Array.from(seen.values()) });
  } catch (err) {
    console.error("[admin/instances] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createAuthToken } from "@/lib/auth";
import { sendApprovalEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/admin-auth";
import { parseActionBody } from "@/lib/request-validation";

/** PATCH /api/admin/requests/[id] — approve or reject */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = parseActionBody(await request.json(), ["approve", "reject"]);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { action } = parsed.data;
    const adminEmail = auth.session.user.email || "admin";

    const db = getSupabase();

    // Get the request
    const { data: req } = await db
      .from("access_requests")
      .select("id, email, name, status")
      .eq("id", id)
      .single();

    if (!req) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (req.status !== "pending") {
      return NextResponse.json({ error: `Request is already ${req.status}` }, { status: 400 });
    }

    if (action === "reject") {
      await db
        .from("access_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminEmail,
        })
        .eq("id", id);

      return NextResponse.json({ success: true, status: "rejected" });
    }

    // Approve: create user + send magic link
    // Check if user already exists
    const { data: existingUser } = await db
      .from("users")
      .select("id")
      .eq("email", req.email)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: userErr } = await db
        .from("users")
        .insert({
          email: req.email,
          name: req.name,
          role: "user",
          status: "active",
          must_set_password: true,
        })
        .select("id")
        .single();

      if (userErr || !newUser) {
        console.error("[admin/requests] User create error:", userErr?.message);
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
      }
      userId = newUser.id;
    }

    // Update request status
    await db
      .from("access_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminEmail,
      })
      .eq("id", id);

    // Generate magic link and send approval email
    const { token } = await createAuthToken(req.email, "magic_link", userId);
    await sendApprovalEmail(req.name, req.email, token);

    return NextResponse.json({ success: true, status: "approved" });
  } catch (err) {
    console.error("[admin/requests] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}


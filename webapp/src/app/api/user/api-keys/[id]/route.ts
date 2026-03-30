import { NextRequest, NextResponse } from "next/server";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { decryptJson } from "@/lib/crypto-vault";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await validateSession(sessionToken);
  if (!session || session.is_temporary) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const showRaw = new URL(req.url).searchParams.get("reveal") === "true";

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseClient
    .from("user_api_keys")
    .select(
      "id, provider, label, api_key_encrypted, key_prefix, key_hint, is_active, last_used_at, created_at"
    )
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result: Record<string, unknown> = {
    id: data.id,
    provider: data.provider,
    label: data.label,
    is_active: data.is_active,
    last_used_at: data.last_used_at,
    created_at: data.created_at,
  };

  if (showRaw) {
    // NOTE: api_key returned here is intentionally revealed to the authenticated owner only — never log this value
    const decrypted = decryptJson<{ key: string }>(JSON.parse(data.api_key_encrypted));
    result.api_key = decrypted.key;
    result.key_hint = data.key_hint;
  } else {
    result.key_hint = data.key_hint;
  }

  return NextResponse.json({ apiKey: result });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await validateSession(sessionToken);
  if (!session || session.is_temporary) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseClient
    .from("user_api_keys")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

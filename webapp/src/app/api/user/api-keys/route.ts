import { NextRequest, NextResponse } from "next/server";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { encryptJson } from "@/lib/crypto-vault";

function maskKey(apiKey: string): { encrypted: string; prefix: string; hint: string } {
  const prefix = apiKey.slice(0, 4);
  const suffix = apiKey.length > 8 ? apiKey.slice(-4) : "";
  const maskedLength = Math.max(0, apiKey.length - prefix.length - suffix.length);
  const hint = `${prefix}${"*".repeat(maskedLength)}${suffix}`;
  const encrypted = encryptJson({ key: apiKey });
  return { encrypted: JSON.stringify(encrypted), prefix, hint };
}

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await validateSession(sessionToken);
  if (!session || session.is_temporary) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseClient
    .from("user_api_keys")
    .select("id, provider, label, key_prefix, key_hint, is_active, last_used_at, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ apiKeys: data });
}

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await validateSession(sessionToken);
  if (!session || session.is_temporary) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { provider, label, api_key } = body;

  if (!provider || !label || !api_key) {
    return NextResponse.json(
      { error: "provider, label, and api_key are required" },
      { status: 400 }
    );
  }

  const { encrypted, prefix, hint } = maskKey(api_key);
  const timestamp = new Date().toISOString();

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabaseClient
    .from("user_api_keys")
    .update({
      is_active: false,
      updated_at: timestamp,
    })
    .eq("user_id", session.user.id)
    .eq("provider", provider)
    .eq("is_active", true);

  const { data, error } = await supabaseClient
    .from("user_api_keys")
    .insert({
      user_id: session.user.id,
      provider,
      label,
      api_key_encrypted: encrypted,
      key_prefix: prefix,
      key_hint: hint,
      is_active: true,
      updated_at: timestamp,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    {
      apiKey: {
        id: data.id,
        provider,
        label,
        key_hint: hint,
        is_active: data.is_active,
        created_at: data.created_at,
      },
    },
    { status: 201 }
  );
}

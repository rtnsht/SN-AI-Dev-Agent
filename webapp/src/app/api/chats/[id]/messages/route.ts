import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/session-auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const db = getSupabase();
  const { data: chat, error: chatError } = await db
    .from("chats")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .maybeSingle();

  if (chatError || !chat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await db
    .from("chat_messages")
    .select("id, role, content, model_used, provider, token_count, context_items, artifacts, metadata, sort_key, created_at")
    .eq("chat_id", id)
    .order("sort_key", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { role, content, model_used, provider, token_count, context_items, artifacts, metadata } = body;

  if (!role || !["user", "assistant", "tool", "system"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const db = getSupabase();

  // Verify user owns this chat
  const { data: chat } = await db
    .from("chats")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .single();

  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await db
    .from("chat_messages")
    .insert({
      chat_id: id,
      role,
      content: content || null,
      model_used: model_used || null,
      provider: provider || null,
      token_count: token_count || null,
      context_items: context_items || [],
      artifacts: artifacts || [],
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ message: data }, { status: 201 });
}

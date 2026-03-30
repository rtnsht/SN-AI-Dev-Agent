import { NextRequest, NextResponse } from "next/server";

import { decryptJson, type EncryptedBlob } from "@/lib/crypto-vault";
import { requireUserSession } from "@/lib/session-auth";
import { testConnection, type UserCredentials } from "@/lib/sn-engine";
import { getSupabase } from "@/lib/supabase";
import type { Credentials } from "@/lib/types";
import {
  normalizeServiceNowAuthMethod,
  validateServiceNowCredentials,
} from "@/lib/servicenow-auth";

interface ConnectionRow {
  id: string;
  label: string;
  instance_url: string;
  project_id: string | null;
  system_type: string;
  is_default: boolean;
  is_active: boolean;
  credentials_enc: string;
  metadata: Record<string, unknown> | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const db = getSupabase();
  const { data, error } = await db
    .from("user_system_connections")
    .select(
      "id, label, instance_url, project_id, system_type, is_default, is_active, credentials_enc, metadata"
    )
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const row = data as ConnectionRow;
  let credentials: Credentials;

  try {
    const encrypted = JSON.parse(row.credentials_enc) as EncryptedBlob;
    credentials = decryptJson<Credentials>(encrypted);
  } catch {
    return NextResponse.json({ error: "Saved connection credentials could not be read" }, { status: 500 });
  }

  const normalizedCredentials: Credentials = {
    ...credentials,
    instanceUrl: credentials.instanceUrl || row.instance_url,
    snAuthType: normalizeServiceNowAuthMethod(credentials.snAuthType),
  };

  const validationError = validateServiceNowCredentials(normalizedCredentials, {
    serverBasicConfigured: false,
    requireUsernameForBasic: true,
  });

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const result = await testConnection(normalizedCredentials as Omit<UserCredentials, "claudeApiKey">);
  if (result.success) {
    const timestamp = new Date().toISOString();
    await db
      .from("user_system_connections")
      .update({
        last_used_at: timestamp,
        last_verified_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", row.id);
  }

  return NextResponse.json({
    connection: {
      id: row.id,
      label: row.label,
      instance_url: row.instance_url,
      project_id: row.project_id,
      system_type: row.system_type,
      is_default: row.is_default,
      is_active: row.is_active,
      metadata: row.metadata,
    },
    credentials: normalizedCredentials,
    result,
  });
}

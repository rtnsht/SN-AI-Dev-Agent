import { decryptJson, encryptJson } from "@/lib/crypto-vault";
import { normalizeServiceNowAuthMethod } from "@/lib/servicenow-auth";
import { getSupabase } from "@/lib/supabase";
import type { Credentials } from "@/lib/types";

interface StoredConnectionRow {
  id: string;
  user_id: string;
  system_type: string;
  label: string;
  instance_url: string;
  project_id: string | null;
  credentials_enc: string;
  is_default: boolean;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  last_verified_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedConnectionSummary {
  id: string;
  system_type: string;
  label: string;
  instance_url: string;
  project_id: string | null;
  is_default: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
  last_verified_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedConnectionWithCredentials extends SavedConnectionSummary {
  credentials: Partial<Credentials>;
}

export function buildConnectionMetadata(credentials: Partial<Credentials>): Record<string, unknown> {
  return {
    username: credentials.username || null,
    snAuthType: normalizeServiceNowAuthMethod(credentials.snAuthType),
    clientId: credentials.clientId || null,
  };
}

export function encryptConnectionCredentials(credentials: Partial<Credentials>): string {
  return JSON.stringify(encryptJson(credentials));
}

export function toSavedConnectionSummary(row: StoredConnectionRow): SavedConnectionSummary {
  return {
    id: row.id,
    system_type: row.system_type,
    label: row.label,
    instance_url: row.instance_url,
    project_id: row.project_id,
    is_default: row.is_default,
    is_active: row.is_active,
    metadata: row.metadata || {},
    last_verified_at: row.last_verified_at,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSavedConnectionWithCredentials(
  userId: string,
  connectionId: string
): Promise<SavedConnectionWithCredentials | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from("user_system_connections")
    .select("id, user_id, system_type, label, instance_url, project_id, credentials_enc, is_default, is_active, metadata, last_verified_at, last_used_at, created_at, updated_at")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  const row = data as StoredConnectionRow;
  const credentials = decryptJson<Partial<Credentials>>(JSON.parse(row.credentials_enc));

  return {
    ...toSavedConnectionSummary(row),
    credentials,
  };
}

export async function markSavedConnectionUsed(
  connectionId: string,
  updates?: { verified?: boolean }
): Promise<void> {
  const db = getSupabase();
  const timestamp = new Date().toISOString();
  await db
    .from("user_system_connections")
    .update({
      last_used_at: timestamp,
      ...(updates?.verified ? { last_verified_at: timestamp } : {}),
      updated_at: timestamp,
    })
    .eq("id", connectionId);
}

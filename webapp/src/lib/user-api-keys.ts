import { decryptJson } from "@/lib/crypto-vault";
import { getSupabase } from "@/lib/supabase";
import type { AITransport } from "@/lib/types";

interface StoredUserApiKeyRow {
  id: string;
  provider: string;
  label: string;
  api_key_encrypted: string;
  key_hint: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface StoredUserApiKey {
  id: string;
  provider: AITransport;
  label: string;
  apiKey: string;
  keyHint: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

function isTransportProvider(value: string): value is AITransport {
  return value === "anthropic" || value === "openrouter";
}

export async function listActiveUserApiKeyProviders(userId: string): Promise<Set<AITransport>> {
  const db = getSupabase();
  const { data, error } = await db
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error || !data) return new Set();

  return new Set(
    data
      .map((row) => row.provider)
      .filter((provider): provider is AITransport => isTransportProvider(String(provider)))
  );
}

export async function getActiveUserApiKey(
  userId: string,
  provider: AITransport
): Promise<StoredUserApiKey | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from("user_api_keys")
    .select("id, provider, label, api_key_encrypted, key_hint, last_used_at, created_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !isTransportProvider(data.provider)) {
    return null;
  }

  const decrypted = decryptJson<{ key: string }>(
    JSON.parse((data as StoredUserApiKeyRow).api_key_encrypted)
  );

  return {
    id: data.id,
    provider: data.provider,
    label: data.label,
    apiKey: decrypted.key,
    keyHint: data.key_hint,
    lastUsedAt: data.last_used_at,
    createdAt: data.created_at,
  };
}

export async function touchUserApiKey(id: string): Promise<void> {
  const db = getSupabase();
  const timestamp = new Date().toISOString();
  await db
    .from("user_api_keys")
    .update({
      last_used_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", id);
}

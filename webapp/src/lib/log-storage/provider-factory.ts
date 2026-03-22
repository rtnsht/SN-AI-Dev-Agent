/**
 * Provider factory — creates StorageProvider instances from env vars.
 *
 * Supports multi-provider via comma-separated LOG_STORAGE_PROVIDERS.
 * Each provider has its own prefixed env vars:
 *   LOG_STORAGE_{ID}_ENDPOINT, LOG_STORAGE_{ID}_BUCKET, etc.
 *
 * Special case: LOG_STORAGE_PROVIDERS=noop creates a single NoopProvider.
 */

import { StorageProvider, S3ProviderConfig } from "./storage-provider";
import { S3CompatibleProvider } from "./s3-provider";
import { NoopProvider } from "./noop-provider";

/**
 * Parse provider configs from environment variables.
 *
 * Format: LOG_STORAGE_PROVIDERS="do-spaces,supabase-s3"
 * Each provider reads:
 *   LOG_STORAGE_{UPPER_ID}_ENDPOINT
 *   LOG_STORAGE_{UPPER_ID}_REGION
 *   LOG_STORAGE_{UPPER_ID}_BUCKET
 *   LOG_STORAGE_{UPPER_ID}_ACCESS_KEY
 *   LOG_STORAGE_{UPPER_ID}_SECRET_KEY
 *
 * For single-provider backward compat, also supports:
 *   LOG_STORAGE_PROVIDERS="s3" with LOG_STORAGE_ENDPOINT, LOG_STORAGE_BUCKET, etc.
 */
export function createStorageProviders(): StorageProvider[] {
  const raw = process.env.LOG_STORAGE_PROVIDERS || "s3";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    throw new Error("[log-storage] LOG_STORAGE_PROVIDERS is empty");
  }

  // Single noop provider
  if (ids.length === 1 && ids[0] === "noop") {
    return [new NoopProvider()];
  }

  const providers: StorageProvider[] = [];

  for (const id of ids) {
    if (id === "noop") {
      providers.push(new NoopProvider());
      continue;
    }

    const config = resolveS3Config(id);
    providers.push(new S3CompatibleProvider(config));
  }

  return providers;
}

/**
 * Resolve S3 config for a given provider ID.
 *
 * Tries prefixed env vars first (LOG_STORAGE_{UPPER}_*),
 * then falls back to unprefixed (LOG_STORAGE_*) for single-provider setups.
 */
function resolveS3Config(id: string): S3ProviderConfig {
  const prefix = `LOG_STORAGE_${toEnvKey(id)}_`;

  const endpoint = process.env[`${prefix}ENDPOINT`] || process.env.LOG_STORAGE_ENDPOINT;
  const region = process.env[`${prefix}REGION`] || process.env.LOG_STORAGE_REGION || "us-east-1";
  const bucket = process.env[`${prefix}BUCKET`] || process.env.LOG_STORAGE_BUCKET;
  const accessKey = process.env[`${prefix}ACCESS_KEY`] || process.env.LOG_STORAGE_ACCESS_KEY;
  const secretKey = process.env[`${prefix}SECRET_KEY`] || process.env.LOG_STORAGE_SECRET_KEY;

  if (!endpoint) throw new Error(`[log-storage] Missing endpoint for provider "${id}". Set ${prefix}ENDPOINT or LOG_STORAGE_ENDPOINT`);
  if (!bucket) throw new Error(`[log-storage] Missing bucket for provider "${id}". Set ${prefix}BUCKET or LOG_STORAGE_BUCKET`);
  if (!accessKey) throw new Error(`[log-storage] Missing access key for provider "${id}". Set ${prefix}ACCESS_KEY or LOG_STORAGE_ACCESS_KEY`);
  if (!secretKey) throw new Error(`[log-storage] Missing secret key for provider "${id}". Set ${prefix}SECRET_KEY or LOG_STORAGE_SECRET_KEY`);

  return { id, endpoint, region, bucket, accessKey, secretKey };
}

/** Convert provider ID to env var prefix segment: "do-spaces" → "DO_SPACES" */
function toEnvKey(id: string): string {
  return id.toUpperCase().replace(/-/g, "_");
}

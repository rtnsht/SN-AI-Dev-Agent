/**
 * Metadata store factory.
 *
 * Selects backend based on LOG_STORAGE_METADATA_BACKEND env var:
 *   - "supabase" — always use Supabase (throws if unavailable)
 *   - "local"    — always use local JSON file
 *   - "auto"     — prefer Supabase, fall back to local (default)
 */

import path from "path";
import { MetadataStore } from "./metadata-store";
import { SupabaseMetadataStore } from "./supabase-metadata-store";
import { LocalMetadataStore } from "./local-metadata-store";

export function createMetadataStore(): MetadataStore {
  const backend = process.env.LOG_STORAGE_METADATA_BACKEND || "auto";
  const logsDir = path.join(process.cwd(), "logs");

  switch (backend) {
    case "supabase":
      return new SupabaseMetadataStore();

    case "local":
      return new LocalMetadataStore(logsDir);

    case "auto":
    default: {
      const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
      if (hasSupabase) {
        console.log("[log-storage] Metadata backend: supabase (auto-detected)");
        return new SupabaseMetadataStore();
      }
      console.log("[log-storage] Metadata backend: local JSON (Supabase not configured)");
      return new LocalMetadataStore(logsDir);
    }
  }
}

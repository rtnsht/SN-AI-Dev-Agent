/**
 * No-op storage provider for development and testing.
 *
 * Logs upload calls to console but writes nothing to remote storage.
 * Enable with LOG_STORAGE_PROVIDER=noop.
 */

import fs from "fs";
import { StorageProvider, UploadResult } from "./storage-provider";

export class NoopProvider implements StorageProvider {
  readonly name = "noop";
  readonly bucket = "noop";

  async upload(localPath: string, remoteKey: string): Promise<UploadResult> {
    const start = Date.now();
    try {
      const stat = await fs.promises.stat(localPath);
      const durationMs = Date.now() - start;
      console.log(`[log-storage:noop] Would upload ${localPath} → ${remoteKey} (${stat.size} bytes)`);
      return {
        success: true,
        key: remoteKey,
        etag: "noop",
        bytesUploaded: stat.size,
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        key: remoteKey,
        bytesUploaded: 0,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async exists(): Promise<boolean> {
    return false;
  }

  async delete(): Promise<void> {
    // no-op
  }

  async testConnection(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

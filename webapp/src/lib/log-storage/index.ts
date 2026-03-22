/**
 * Log Storage Sync — singleton entry point.
 *
 * Gated by LOG_STORAGE_ENABLED=true. Import and call getLogStorageSync()
 * to lazily initialize the scanner. Mirrors the getLogPersistence() pattern.
 */

import { LogStorageSync } from "./log-storage-sync";

const ENABLED = process.env.LOG_STORAGE_ENABLED === "true";

let _instance: LogStorageSync | null = null;
let _disabledLogged = false;

export function getLogStorageSync(): LogStorageSync | null {
  if (!ENABLED) {
    if (!_disabledLogged) {
      console.log(
        `[log-storage] DISABLED — LOG_STORAGE_ENABLED is not "true" (current value: ${JSON.stringify(process.env.LOG_STORAGE_ENABLED)})`
      );
      _disabledLogged = true;
    }
    return null;
  }
  if (!_instance) {
    console.log("[log-storage] Initializing singleton");
    _instance = new LogStorageSync();
  }
  return _instance;
}

export { LogStorageSync } from "./log-storage-sync";
export type { ScanResult } from "./log-storage-sync";
export type { StorageProvider, UploadResult, S3ProviderConfig } from "./storage-provider";
export type { MetadataStore, FileUploadRecord } from "./metadata-store";

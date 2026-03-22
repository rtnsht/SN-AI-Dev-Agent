/**
 * LogStorageSync — periodic scanner that uploads log files to object storage.
 *
 * Scans webapp/logs/ for new/changed session-*.txt and telemetry-*.md files,
 * uploads them to one or more configured StorageProvider instances, and tracks
 * upload metadata via a MetadataStore.
 *
 * Follows the same singleton + setInterval + shutdown-hook pattern as LogPersistence.
 */

import fs from "fs";
import path from "path";
import { StorageProvider, UploadResult } from "./storage-provider";
import { MetadataStore, FileUploadRecord } from "./metadata-store";
import { createStorageProviders } from "./provider-factory";
import { createMetadataStore } from "./metadata-factory";

const SCAN_INTERVAL_MS = parseInt(process.env.LOG_STORAGE_INTERVAL_MS || "300000", 10); // 5 min
const MAX_RETRIES = parseInt(process.env.LOG_STORAGE_MAX_RETRIES || "3", 10);
const MIN_FILE_AGE_MS = parseInt(process.env.LOG_STORAGE_MIN_FILE_AGE_MS || "60000", 10); // 60s
const KEY_PREFIX = process.env.LOG_STORAGE_PREFIX || "logs/";
const SHUTDOWN_TIMEOUT_MS = 5000;

/** Files matching these patterns are eligible for upload. */
const FILE_PATTERNS = [
  /^session-.*\.txt$/,       // JSONL session logs
  /^telemetry-session-.*\.md$/, // Telemetry markdown dashboards
];

/** Exclude metadata/temp files. */
const EXCLUDE_PATTERNS = [
  /^\.sync-metadata\.json/,
  /\.tmp$/,
];

export interface ScanResult {
  scannedFiles: number;
  uploadedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  providerResults: Record<string, { uploaded: number; failed: number }>;
  durationMs: number;
}

export class LogStorageSync {
  private interval: NodeJS.Timeout | null = null;
  private scanning = false;
  private shuttingDown = false;
  private providers: StorageProvider[];
  private metadata: MetadataStore;
  private logsDir: string;
  private lastScanResult: ScanResult | null = null;
  private startedAt: Date;

  constructor() {
    this.logsDir = path.join(process.cwd(), "logs");
    this.providers = createStorageProviders();
    this.metadata = createMetadataStore();
    this.startedAt = new Date();

    console.log(
      `[log-storage] Initialized with ${this.providers.length} provider(s): ${this.providers.map((p) => p.name).join(", ")}. ` +
      `Scan interval: ${SCAN_INTERVAL_MS}ms, metadata: ${this.metadata.name}`
    );

    // Non-blocking connectivity checks
    for (const provider of this.providers) {
      provider.testConnection().then((r) => {
        if (!r.ok) console.error(`[log-storage] Provider "${provider.name}" connectivity FAILED:`, r.error);
        else console.log(`[log-storage] Provider "${provider.name}" connectivity OK (bucket: ${provider.bucket})`);
      });
    }

    this.startScanLoop();
    this.registerShutdownHook();
  }

  /** Run a scan immediately (used by admin API manual trigger). */
  async triggerScan(): Promise<ScanResult> {
    return this.scan();
  }

  /** Get the result of the last completed scan. */
  getStatus(): {
    running: boolean;
    providers: string[];
    metadataBackend: string;
    scanIntervalMs: number;
    lastScan: ScanResult | null;
    startedAt: string;
  } {
    return {
      running: !this.shuttingDown,
      providers: this.providers.map((p) => `${p.name} (${p.bucket})`),
      metadataBackend: this.metadata.name,
      scanIntervalMs: SCAN_INTERVAL_MS,
      lastScan: this.lastScanResult,
      startedAt: this.startedAt.toISOString(),
    };
  }

  /** Get metadata stats (delegates to metadata store). */
  async getStats() {
    return this.metadata.getStats();
  }

  // ── Core scan logic ─────────────────────────────────────────────────

  private async scan(): Promise<ScanResult> {
    if (this.scanning) {
      console.log("[log-storage] Scan already in progress, skipping");
      return this.lastScanResult || { scannedFiles: 0, uploadedFiles: 0, skippedFiles: 0, failedFiles: 0, providerResults: {}, durationMs: 0 };
    }

    this.scanning = true;
    const start = Date.now();
    const providerResults: Record<string, { uploaded: number; failed: number }> = {};
    let scannedFiles = 0, uploadedFiles = 0, skippedFiles = 0, failedFiles = 0;

    try {
      // Ensure logs directory exists
      try {
        await fs.promises.access(this.logsDir);
      } catch {
        console.warn(`[log-storage] Logs directory does not exist: ${this.logsDir}`);
        return { scannedFiles: 0, uploadedFiles: 0, skippedFiles: 0, failedFiles: 0, providerResults: {}, durationMs: Date.now() - start };
      }

      // Read and filter eligible files
      const allFiles = await fs.promises.readdir(this.logsDir);
      const eligible = allFiles.filter((f) =>
        FILE_PATTERNS.some((p) => p.test(f)) && !EXCLUDE_PATTERNS.some((p) => p.test(f))
      );

      const now = Date.now();

      for (const filename of eligible) {
        if (this.shuttingDown) break;
        scannedFiles++;

        const filePath = path.join(this.logsDir, filename);
        let stat: fs.Stats;
        try {
          stat = await fs.promises.stat(filePath);
        } catch {
          continue; // File may have been deleted between readdir and stat
        }

        // Skip files that are too young (likely still being written)
        if (now - stat.mtimeMs < MIN_FILE_AGE_MS) {
          skippedFiles++;
          continue;
        }

        const fileMtime = stat.mtime.toISOString();
        const remoteKey = this.buildRemoteKey(filename);

        // Upload to each provider
        let fileUploaded = false;
        let fileFailed = false;

        // Use Promise.allSettled for parallel multi-provider upload
        const uploadPromises = this.providers.map(async (provider) => {
          const existing = await this.metadata.get(filename, provider.name);

          // Skip if already uploaded and file hasn't changed
          if (existing && existing.status === "uploaded" && existing.fileMtime === fileMtime) {
            return { provider: provider.name, action: "skipped" as const };
          }

          // Skip if max retries exceeded
          if (existing && existing.status === "failed" && existing.retryCount >= MAX_RETRIES) {
            return { provider: provider.name, action: "max_retries" as const };
          }

          // Upload
          const result = await provider.upload(filePath, remoteKey);
          const record: FileUploadRecord = {
            filename,
            provider: provider.name,
            remoteKey,
            fileSizeBytes: stat.size,
            fileMtime,
            etag: result.etag,
            uploadedAt: new Date().toISOString(),
            uploadDurationMs: result.durationMs,
            bucket: provider.bucket,
            status: result.success ? "uploaded" : "failed",
            errorMessage: result.error,
            retryCount: (existing?.retryCount || 0) + (result.success ? 0 : 1),
          };

          await this.metadata.upsert(record);
          return { provider: provider.name, action: result.success ? "uploaded" as const : "failed" as const, result };
        });

        const outcomes = await Promise.allSettled(uploadPromises);

        for (const outcome of outcomes) {
          if (outcome.status === "rejected") {
            fileFailed = true;
            continue;
          }
          const { provider: pName, action } = outcome.value;
          if (!providerResults[pName]) providerResults[pName] = { uploaded: 0, failed: 0 };

          if (action === "uploaded") {
            providerResults[pName].uploaded++;
            fileUploaded = true;
          } else if (action === "failed") {
            providerResults[pName].failed++;
            fileFailed = true;
          }
        }

        if (fileUploaded) uploadedFiles++;
        if (fileFailed && !fileUploaded) failedFiles++;
      }
    } catch (err) {
      console.error("[log-storage] Scan error:", err);
    } finally {
      this.scanning = false;
    }

    const result: ScanResult = {
      scannedFiles,
      uploadedFiles,
      skippedFiles,
      failedFiles,
      providerResults,
      durationMs: Date.now() - start,
    };

    this.lastScanResult = result;

    if (uploadedFiles > 0 || failedFiles > 0) {
      console.log(
        `[log-storage] Scan complete: ${scannedFiles} scanned, ${uploadedFiles} uploaded, ${skippedFiles} skipped, ${failedFiles} failed (${result.durationMs}ms)`
      );
    }

    return result;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /**
   * Build remote key from filename.
   * Extracts date from filename for date-based organization.
   * Pattern: {prefix}{YYYY-MM-DD}/{filename}
   */
  private buildRemoteKey(filename: string): string {
    // Extract date from session-YYYY-MM-DD-... or telemetry-session-...
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    const datePart = dateMatch ? dateMatch[1] : new Date().toISOString().split("T")[0];
    return `${KEY_PREFIX}${datePart}/${filename}`;
  }

  private startScanLoop(): void {
    // Run initial scan after a short delay (let the app finish starting)
    setTimeout(() => {
      if (!this.shuttingDown) {
        this.scan().catch((err) => console.error("[log-storage] Initial scan error:", err));
      }
    }, 10_000); // 10s startup delay

    this.interval = setInterval(() => {
      if (!this.shuttingDown) {
        this.scan().catch((err) => console.error("[log-storage] Scan loop error:", err));
      }
    }, SCAN_INTERVAL_MS);

    if (this.interval.unref) {
      this.interval.unref();
    }

    console.log(`[log-storage] Scan loop started (interval=${SCAN_INTERVAL_MS}ms, initial delay=10s)`);
  }

  private registerShutdownHook(): void {
    const handler = () => {
      this.shuttingDown = true;
      if (this.interval) clearInterval(this.interval);

      // Wait for in-progress scan with timeout
      if (this.scanning) {
        console.log("[log-storage] Waiting for in-progress scan to complete...");
        const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
        const check = setInterval(() => {
          if (!this.scanning || Date.now() >= deadline) {
            clearInterval(check);
            if (this.scanning) console.warn("[log-storage] Shutdown timeout — scan still in progress");
          }
        }, 100);
      }
    };
    process.on("SIGTERM", handler);
    process.on("SIGINT", handler);
  }
}

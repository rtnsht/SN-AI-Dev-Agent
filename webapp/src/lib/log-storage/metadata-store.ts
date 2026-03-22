/**
 * MetadataStore interface — tracks which log files have been uploaded
 * to which providers, enabling change detection and retry logic.
 *
 * Implementations: SupabaseMetadataStore (primary), LocalMetadataStore (fallback).
 */

export interface FileUploadRecord {
  /** Local log filename, e.g. "session-2026-03-22-1711100000000-abc1234.txt" */
  filename: string;
  /** Provider ID that handled this upload, e.g. "do-spaces" */
  provider: string;
  /** Remote S3 object key, e.g. "logs/2026-03-22/session-...txt" */
  remoteKey: string;
  /** File size in bytes at time of upload */
  fileSizeBytes: number;
  /** File mtime at time of upload (ISO 8601) */
  fileMtime: string;
  /** S3 ETag from upload response */
  etag?: string;
  /** When upload completed (ISO 8601) */
  uploadedAt: string;
  /** Upload latency in ms */
  uploadDurationMs: number;
  /** Bucket name */
  bucket: string;
  /** Upload status */
  status: "uploaded" | "failed" | "pending";
  /** Last error message if failed */
  errorMessage?: string;
  /** Number of retry attempts */
  retryCount: number;
}

export interface MetadataStore {
  /**
   * Get the upload record for a file+provider combo.
   * Returns null if no record exists.
   */
  get(filename: string, provider: string): Promise<FileUploadRecord | null>;

  /**
   * Get all records for a filename across all providers.
   */
  getByFilename(filename: string): Promise<FileUploadRecord[]>;

  /**
   * Upsert an upload record (keyed on filename+provider).
   */
  upsert(record: FileUploadRecord): Promise<void>;

  /**
   * List all records, optionally filtered by status.
   */
  list(filter?: { status?: string; provider?: string; limit?: number }): Promise<FileUploadRecord[]>;

  /**
   * Get summary stats for the admin API.
   */
  getStats(): Promise<{
    totalFiles: number;
    uploaded: number;
    failed: number;
    pending: number;
    byProvider: Record<string, { uploaded: number; failed: number }>;
  }>;

  /** Human-readable backend name for logging. */
  readonly name: string;
}

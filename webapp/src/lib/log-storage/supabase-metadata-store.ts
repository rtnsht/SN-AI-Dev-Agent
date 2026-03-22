/**
 * Supabase-backed metadata store for log file upload tracking.
 *
 * Uses the `log_file_uploads` table (see migration 014_log_file_uploads.sql).
 * Keyed on (filename, provider) composite unique constraint.
 */

import { getSupabase } from "../supabase";
import { FileUploadRecord, MetadataStore } from "./metadata-store";

export class SupabaseMetadataStore implements MetadataStore {
  readonly name = "supabase";

  async get(filename: string, provider: string): Promise<FileUploadRecord | null> {
    const db = getSupabase();
    const { data, error } = await db
      .from("log_file_uploads")
      .select("*")
      .eq("filename", filename)
      .eq("provider", provider)
      .maybeSingle();

    if (error) {
      console.error("[log-storage:metadata:supabase] get error:", error.message);
      return null;
    }
    return data ? this.toRecord(data) : null;
  }

  async getByFilename(filename: string): Promise<FileUploadRecord[]> {
    const db = getSupabase();
    const { data, error } = await db
      .from("log_file_uploads")
      .select("*")
      .eq("filename", filename);

    if (error) {
      console.error("[log-storage:metadata:supabase] getByFilename error:", error.message);
      return [];
    }
    return (data || []).map(this.toRecord);
  }

  async upsert(record: FileUploadRecord): Promise<void> {
    const db = getSupabase();
    const { error } = await db.from("log_file_uploads").upsert(
      {
        filename: record.filename,
        provider: record.provider,
        remote_key: record.remoteKey,
        file_size_bytes: record.fileSizeBytes,
        file_mtime: record.fileMtime,
        etag: record.etag || null,
        uploaded_at: record.uploadedAt,
        upload_duration_ms: record.uploadDurationMs,
        bucket: record.bucket,
        status: record.status,
        error_message: record.errorMessage || null,
        retry_count: record.retryCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "filename,provider" }
    );

    if (error) {
      console.error("[log-storage:metadata:supabase] upsert error:", error.message);
    }
  }

  async list(filter?: { status?: string; provider?: string; limit?: number }): Promise<FileUploadRecord[]> {
    const db = getSupabase();
    let query = db
      .from("log_file_uploads")
      .select("*")
      .order("uploaded_at", { ascending: false })
      .limit(filter?.limit || 200);

    if (filter?.status) query = query.eq("status", filter.status);
    if (filter?.provider) query = query.eq("provider", filter.provider);

    const { data, error } = await query;
    if (error) {
      console.error("[log-storage:metadata:supabase] list error:", error.message);
      return [];
    }
    return (data || []).map(this.toRecord);
  }

  async getStats(): Promise<{
    totalFiles: number;
    uploaded: number;
    failed: number;
    pending: number;
    byProvider: Record<string, { uploaded: number; failed: number }>;
  }> {
    const db = getSupabase();
    const { data, error } = await db
      .from("log_file_uploads")
      .select("filename, status, provider");

    if (error) {
      console.error("[log-storage:metadata:supabase] getStats error:", error.message);
      return { totalFiles: 0, uploaded: 0, failed: 0, pending: 0, byProvider: {} };
    }

    const rows = data || [];
    const byProvider: Record<string, { uploaded: number; failed: number }> = {};
    let uploaded = 0, failed = 0, pending = 0;

    for (const row of rows) {
      if (row.status === "uploaded") uploaded++;
      else if (row.status === "failed") failed++;
      else pending++;

      if (!byProvider[row.provider]) byProvider[row.provider] = { uploaded: 0, failed: 0 };
      if (row.status === "uploaded") byProvider[row.provider].uploaded++;
      else if (row.status === "failed") byProvider[row.provider].failed++;
    }

    // Count unique filenames for totalFiles
    const uniqueFiles = new Set(rows.map((r) => r.filename));

    return { totalFiles: uniqueFiles.size, uploaded, failed, pending, byProvider };
  }

  private toRecord(row: Record<string, unknown>): FileUploadRecord {
    return {
      filename: row.filename as string,
      provider: row.provider as string,
      remoteKey: row.remote_key as string,
      fileSizeBytes: Number(row.file_size_bytes),
      fileMtime: row.file_mtime as string,
      etag: (row.etag as string) || undefined,
      uploadedAt: row.uploaded_at as string,
      uploadDurationMs: Number(row.upload_duration_ms),
      bucket: row.bucket as string,
      status: row.status as FileUploadRecord["status"],
      errorMessage: (row.error_message as string) || undefined,
      retryCount: Number(row.retry_count),
    };
  }
}

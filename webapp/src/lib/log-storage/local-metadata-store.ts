/**
 * Local JSON-file-backed metadata store — fallback when Supabase is unavailable.
 *
 * Stores upload records in webapp/logs/.sync-metadata.json.
 * Keyed on "filename::provider" composite key.
 */

import fs from "fs";
import path from "path";
import { FileUploadRecord, MetadataStore } from "./metadata-store";

const METADATA_FILENAME = ".sync-metadata.json";

export class LocalMetadataStore implements MetadataStore {
  readonly name = "local";
  private filePath: string;

  constructor(logsDir: string) {
    this.filePath = path.join(logsDir, METADATA_FILENAME);
  }

  async get(filename: string, provider: string): Promise<FileUploadRecord | null> {
    const data = await this.readStore();
    return data[this.key(filename, provider)] || null;
  }

  async getByFilename(filename: string): Promise<FileUploadRecord[]> {
    const data = await this.readStore();
    return Object.values(data).filter((r) => r.filename === filename);
  }

  async upsert(record: FileUploadRecord): Promise<void> {
    const data = await this.readStore();
    data[this.key(record.filename, record.provider)] = record;
    await this.writeStore(data);
  }

  async list(filter?: { status?: string; provider?: string; limit?: number }): Promise<FileUploadRecord[]> {
    const data = await this.readStore();
    let records = Object.values(data);

    if (filter?.status) records = records.filter((r) => r.status === filter.status);
    if (filter?.provider) records = records.filter((r) => r.provider === filter.provider);

    // Sort by uploadedAt descending
    records.sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));

    if (filter?.limit) records = records.slice(0, filter.limit);
    return records;
  }

  async getStats(): Promise<{
    totalFiles: number;
    uploaded: number;
    failed: number;
    pending: number;
    byProvider: Record<string, { uploaded: number; failed: number }>;
  }> {
    const data = await this.readStore();
    const records = Object.values(data);
    const byProvider: Record<string, { uploaded: number; failed: number }> = {};
    let uploaded = 0, failed = 0, pending = 0;

    for (const r of records) {
      if (r.status === "uploaded") uploaded++;
      else if (r.status === "failed") failed++;
      else pending++;

      if (!byProvider[r.provider]) byProvider[r.provider] = { uploaded: 0, failed: 0 };
      if (r.status === "uploaded") byProvider[r.provider].uploaded++;
      else if (r.status === "failed") byProvider[r.provider].failed++;
    }

    const uniqueFiles = new Set(records.map((r) => r.filename));
    return { totalFiles: uniqueFiles.size, uploaded, failed, pending, byProvider };
  }

  private key(filename: string, provider: string): string {
    return `${filename}::${provider}`;
  }

  private async readStore(): Promise<Record<string, FileUploadRecord>> {
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private async writeStore(data: Record<string, FileUploadRecord>): Promise<void> {
    const tmp = this.filePath + ".tmp";
    await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.promises.rename(tmp, this.filePath);
  }
}

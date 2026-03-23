/**
 * S3-compatible storage provider.
 *
 * Works with DigitalOcean Spaces, AWS S3, Supabase Storage (S3 mode),
 * MinIO, Backblaze B2, and any other S3-compatible endpoint.
 *
 * Uses AWS SDK v3 (@aws-sdk/client-s3).
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import { StorageProvider, UploadResult, S3ProviderConfig } from "./storage-provider";

export class S3CompatibleProvider implements StorageProvider {
  readonly name: string;
  readonly bucket: string;

  private client: S3Client;

  constructor(private config: S3ProviderConfig) {
    this.name = config.id;
    this.bucket = config.bucket;

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle ?? false,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }

  async upload(localPath: string, remoteKey: string, contentType?: string): Promise<UploadResult> {
    const start = Date.now();
    try {
      const stat = await fs.promises.stat(localPath);
      const body = fs.createReadStream(localPath);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: remoteKey,
        Body: body,
        ContentType: contentType || this.inferContentType(remoteKey),
        ContentLength: stat.size,
      });

      const response = await this.client.send(command);
      const durationMs = Date.now() - start;

      return {
        success: true,
        key: remoteKey,
        etag: response.ETag?.replace(/"/g, ""),
        bytesUploaded: stat.size,
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      return {
        success: false,
        key: remoteKey,
        bytesUploaded: 0,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async exists(remoteKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: remoteKey }));
      return true;
    } catch {
      return false;
    }
  }

  async delete(remoteKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: remoteKey }));
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private inferContentType(key: string): string {
    if (key.endsWith(".txt") || key.endsWith(".jsonl")) return "application/x-ndjson";
    if (key.endsWith(".md")) return "text/markdown";
    if (key.endsWith(".json")) return "application/json";
    return "application/octet-stream";
  }
}

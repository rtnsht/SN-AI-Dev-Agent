/**
 * StorageProvider interface — strategy pattern for pluggable object storage.
 *
 * Implementations: S3CompatibleProvider (DO Spaces, AWS S3, Supabase Storage, MinIO, etc.),
 * NoopProvider (dev/test).
 */

export interface UploadResult {
  success: boolean;
  key: string;
  etag?: string;
  bytesUploaded: number;
  durationMs: number;
  error?: string;
}

export interface StorageProvider {
  /** Upload a local file to remote storage. */
  upload(localPath: string, remoteKey: string, contentType?: string): Promise<UploadResult>;

  /** Check if a remote object exists (idempotency check). */
  exists(remoteKey: string): Promise<boolean>;

  /** Delete a remote object. */
  delete(remoteKey: string): Promise<void>;

  /** Test connectivity — called on init. */
  testConnection(): Promise<{ ok: boolean; error?: string }>;

  /** Human-readable provider name for logging. */
  readonly name: string;

  /** Bucket/container name. */
  readonly bucket: string;
}

/**
 * Configuration for an S3-compatible storage provider instance.
 * Each provider in a multi-provider setup gets its own config.
 */
export interface S3ProviderConfig {
  /** Provider identifier used in metadata tracking, e.g. "do-spaces", "supabase-s3" */
  id: string;
  /** S3 endpoint URL, e.g. "https://nyc3.digitaloceanspaces.com" */
  endpoint: string;
  /** SDK region — always "us-east-1" for DO Spaces */
  region: string;
  /** Bucket / space name */
  bucket: string;
  /** Access key ID */
  accessKey: string;
  /** Secret access key */
  secretKey: string;
}

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.CREDENTIALS_MASTER_KEY;
  if (!key) throw new Error('CREDENTIALS_MASTER_KEY environment variable is not set');
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) throw new Error('CREDENTIALS_MASTER_KEY must be 64 hex characters (32 bytes)');
  return buf;
}

export interface EncryptedBlob {
  iv: string;
  tag: string;
  ciphertext: string;
}

export function encryptJson(plaintext: unknown): EncryptedBlob {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const plaintextStr = JSON.stringify(plaintext);
  const encrypted = Buffer.concat([cipher.update(plaintextStr, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decryptJson<T>(blob: EncryptedBlob): T {
  const key = getKey();
  const iv = Buffer.from(blob.iv, 'hex');
  const tag = Buffer.from(blob.tag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(blob.ciphertext, 'base64'), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}
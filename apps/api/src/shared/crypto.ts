import { createHash, createHmac, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { config } from '../config';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomAlphanumeric(length: number): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i]! % CHARS.length];
  }
  return result;
}

/**
 * Aether API key prefixes.
 *
 *   aether_      — user-created API key (for external programmatic access)
 *   aether_sb_   — sandbox-managed key (auto-created per sandbox, used by agents)
 *   pk_          — public key identifier (safe to store/display)
 *
 * Both secret key variants validate through the same path — only the hash is stored.
 */
export const KEY_PREFIX = 'aether_';
export const KEY_PREFIX_SANDBOX = 'aether_sb_';
export const KEY_PREFIX_TUNNEL = 'aether_tnl_';
export const KEY_PREFIX_PUBLIC = 'pk_';

const SECRET_RANDOM_LENGTH = 32;

/**
 * Check if a token is a Aether-issued key (user or sandbox).
 * Single check for the router — no branching on multiple prefixes.
 */
export function isAetherToken(token: string): boolean {
  return token.startsWith(KEY_PREFIX);
}

/**
 * Generate a public/secret key pair for a user-created API key.
 * Secret key: aether_<32 chars>  (shown once, only hash stored)
 * Public key:  pk_<32 chars>     (safe to store/display)
 */
export function generateApiKeyPair(): { publicKey: string; secretKey: string } {
  return {
    publicKey: `${KEY_PREFIX_PUBLIC}${randomAlphanumeric(SECRET_RANDOM_LENGTH)}`,
    secretKey: `${KEY_PREFIX}${randomAlphanumeric(SECRET_RANDOM_LENGTH)}`,
  };
}

/**
 * Generate a public/secret key pair for a sandbox-managed key.
 * Secret key: aether_sb_<32 chars>  (injected as AETHER_TOKEN into sandbox)
 * Public key: pk_<32 chars>          (safe to store/display)
 */
export function generateSandboxKeyPair(): { publicKey: string; secretKey: string } {
  return {
    publicKey: `${KEY_PREFIX_PUBLIC}${randomAlphanumeric(SECRET_RANDOM_LENGTH)}`,
    secretKey: `${KEY_PREFIX_SANDBOX}${randomAlphanumeric(SECRET_RANDOM_LENGTH)}`,
  };
}

/**
 * Generate a tunnel-specific setup token.
 * Token: aether_tnl_<32 chars> (shown once during tunnel creation, only hash stored)
 */
export function generateTunnelToken(): string {
  return `${KEY_PREFIX_TUNNEL}${randomAlphanumeric(SECRET_RANDOM_LENGTH)}`;
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

/**
 * Generate a human-readable device auth code: XXXX-NNNN
 * (4 uppercase letters + hyphen + 4 digits)
 */
export function generateDeviceCode(): string {
  const bytes = randomBytes(8);
  let letters = '';
  let numbers = '';
  for (let i = 0; i < 4; i++) {
    letters += UPPER[bytes[i]! % UPPER.length];
    numbers += DIGITS[bytes[i + 4]! % DIGITS.length];
  }
  return `${letters}-${numbers}`;
}

/** Check if a token is a tunnel setup token. */
export function isTunnelToken(token: string): boolean {
  return token.startsWith(KEY_PREFIX_TUNNEL);
}

export function hashSecretKey(secretKey: string): string {
  const secret = config.API_KEY_SECRET;
  if (!secret) {
    throw new Error('API_KEY_SECRET not configured');
  }

  return createHmac('sha256', secret)
    .update(secretKey)
    .digest('hex');
}

export function verifySecretKey(secretKey: string, storedHash: string): boolean {
  try {
    const computedHash = hashSecretKey(secretKey);

    const storedBuffer = Buffer.from(storedHash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');

    if (storedBuffer.length !== computedBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, computedBuffer);
  } catch {
    return false;
  }
}

export function isApiKeySecretConfigured(): boolean {
  return !!config.API_KEY_SECRET;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Hashes both inputs with SHA-256 first so the comparison is always
 * on fixed-length 32-byte digests — no string length leakage.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function deriveSigningKey(token: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(token)
    .digest('hex');
}

export function signMessage(signingKey: string, payload: string, nonce: number): string {
  return createHmac('sha256', signingKey)
    .update(`${nonce}:${payload}`)
    .digest('hex');
}

export function verifyMessageSignature(
  signingKey: string,
  payload: string,
  nonce: number,
  signature: string,
): boolean {
  try {
    const expected = signMessage(signingKey, payload, nonce);
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// ─── AES-256-GCM Credential Encryption ──────────────────────────────────────

const CREDENTIAL_ENCRYPTION_KEY_ENV = 'CREDENTIAL_ENCRYPTION_KEY';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

function getCredentialEncryptionKey(): Buffer | null {
  const hexKey = process.env[CREDENTIAL_ENCRYPTION_KEY_ENV];
  if (!hexKey) return null;
  try {
    const key = Buffer.from(hexKey, 'hex');
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a hex-encoded string: `iv:ciphertext:tag`
 * Returns the plaintext as-is if CREDENTIAL_ENCRYPTION_KEY is not set (dev mode).
 */
export function encryptCredential(plaintext: string): string {
  const key = getCredentialEncryptionKey();
  if (!key) {
    console.warn('[crypto] CREDENTIAL_ENCRYPTION_KEY not set — storing credentials in plaintext');
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypt a string encrypted by encryptCredential.
 * If the input does not match the `iv:ciphertext:tag` format, returns it as-is
 * (backward compatibility with plaintext data stored before encryption was enabled).
 */
export function decryptCredential(encrypted: string): string {
  // Not encrypted (no colons = plaintext from before encryption was enabled)
  const parts = encrypted.split(':');
  if (parts.length !== 3) return encrypted;

  const key = getCredentialEncryptionKey();
  if (!key) return encrypted;

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const ciphertext = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
  } catch {
    // Decryption failed — likely plaintext data from before encryption was enabled
    return encrypted;
  }
}

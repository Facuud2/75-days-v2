import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getServerConfig } from '../config';

const ENC_PREFIX = 'enc:v1:';
const OAUTH_STATE_PURPOSE = 'strava-oauth-state';

function deriveEncryptionKey(): Buffer {
  const { jwtSecret } = getServerConfig();
  const rawSecret = process.env.TOKEN_ENCRYPTION_KEY?.trim() || jwtSecret;
  return crypto
    .createHash('sha256')
    .update(`75days-token-at-rest:${rawSecret}`)
    .digest();
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;

  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(ENC_PREFIX)) {
    return stored;
  }

  const parts = stored.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted secret payload');
  }

  const [ivB64, tagB64, dataB64] = parts;
  const key = deriveEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function signOAuthStateWithNonce(userId: string): {
  state: string;
  nonce: string;
} {
  const { jwtSecret } = getServerConfig();
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = jwt.sign(
    {
      sub: userId,
      purpose: OAUTH_STATE_PURPOSE,
      nonce,
    },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: '10m' }
  );
  return { state, nonce };
}

export function signOAuthState(userId: string): string {
  return signOAuthStateWithNonce(userId).state;
}

export function verifyOAuthStatePayload(
  state: string
): { userId: string; nonce: string } | null {
  try {
    const { jwtSecret } = getServerConfig();
    const decoded = jwt.verify(state, jwtSecret, {
      algorithms: ['HS256'],
    }) as {
      sub?: string;
      purpose?: string;
      nonce?: string;
    };
    if (
      decoded?.purpose !== OAUTH_STATE_PURPOSE ||
      typeof decoded.sub !== 'string' ||
      !decoded.sub ||
      typeof decoded.nonce !== 'string' ||
      !decoded.nonce
    ) {
      return null;
    }
    return { userId: decoded.sub, nonce: decoded.nonce };
  } catch {
    return null;
  }
}

export function verifyOAuthState(state: string): string | null {
  return verifyOAuthStatePayload(state)?.userId ?? null;
}

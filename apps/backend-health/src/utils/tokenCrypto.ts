import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const ENC_PREFIX = 'enc:v1:';
const OAUTH_STATE_PURPOSE = 'strava-oauth-state';

function deriveEncryptionKey(): Buffer {
    const rawSecret = process.env.TOKEN_ENCRYPTION_KEY?.trim() || config.jwtSecret;
    return crypto
        .createHash('sha256')
        .update(`75days-token-at-rest:${rawSecret}`)
        .digest();
}

/**
 * Encrypts a third-party OAuth token using AES-256-GCM before storing it in Postgres (F-15).
 */
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

/**
 * Decrypts a stored token. Remains backward-compatible with legacy plaintext tokens
 * until they are rotated/refreshed and re-saved encrypted.
 */
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
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}

/**
 * Generates a short-lived signed OAuth state token bound to userId (anti-CSRF, F-14).
 */
export function signOAuthState(userId: string): string {
    return jwt.sign(
        { sub: userId, purpose: OAUTH_STATE_PURPOSE, nonce: crypto.randomBytes(8).toString('hex') },
        config.jwtSecret,
        { expiresIn: '10m' }
    );
}

/**
 * Verifies a signed OAuth state token and extracts the bound userId.
 * Returns null for tampered, expired, or raw-userId states.
 */
export function verifyOAuthState(state: string): string | null {
    try {
        const decoded = jwt.verify(state, config.jwtSecret) as {
            sub?: string;
            purpose?: string;
        };
        if (decoded?.purpose !== OAUTH_STATE_PURPOSE || typeof decoded.sub !== 'string' || !decoded.sub) {
            return null;
        }
        return decoded.sub;
    } catch {
        return null;
    }
}

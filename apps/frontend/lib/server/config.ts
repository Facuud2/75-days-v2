import { cleanEnvString } from './db';

/**
 * Build-safe server configuration accessor.
 * Reads environment variables lazily at request time and strips accidental surrounding quotes.
 */
export function getServerConfig() {
  const jwtSecret =
    cleanEnvString(process.env.JWT_SECRET) ||
    'dev-fallback-jwt-secret-change-in-prod';
  const googleClientId =
    cleanEnvString(process.env.GOOGLE_CLIENT_ID) ||
    cleanEnvString(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) ||
    '';
  const geminiApiKey = cleanEnvString(process.env.GEMINI_API_KEY) || '';
  const internalApiKey = cleanEnvString(process.env.INTERNAL_API_KEY) || '';
  const frontendUrl =
    cleanEnvString(process.env.FRONTEND_URL) || 'http://localhost:3000';

  return {
    jwtSecret,
    googleClientId,
    geminiApiKey,
    internalApiKey,
    frontendUrl,
  };
}

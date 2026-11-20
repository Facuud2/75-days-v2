/**
 * Build-safe server configuration accessor.
 * Reads environment variables lazily at request time so `next build` never fails
 * during static analysis if secrets are injected only at runtime.
 */
export function getServerConfig() {
  const rawJwtSecret = process.env.JWT_SECRET?.trim();
  if (!rawJwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('[config] Missing required environment variable: JWT_SECRET');
  }
  const jwtSecret = rawJwtSecret || 'dev-fallback-jwt-secret-change-in-prod';
  const googleClientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    '';
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || '';
  const internalApiKey = process.env.INTERNAL_API_KEY?.trim() || '';
  const frontendUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';

  return {
    jwtSecret,
    googleClientId,
    geminiApiKey,
    internalApiKey,
    frontendUrl,
  };
}

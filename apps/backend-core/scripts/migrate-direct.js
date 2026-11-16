const { execSync } = require('node:child_process');
const dotenv = require('dotenv');

dotenv.config();

function resolveDirectDatabaseUrl(env) {
  const explicit = (env.DIRECT_URL || '').trim() || (env.DATABASE_URL_UNPOOLED || '').trim();
  if (explicit) return explicit;

  const baseUrl = (env.DATABASE_URL || '').trim();
  if (!baseUrl) return '';

  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname.includes('-pooler.') && parsed.hostname.endsWith('.neon.tech')) {
      parsed.hostname = parsed.hostname.replace('-pooler.', '.');
      return parsed.toString();
    }
  } catch {
    // keep raw string
  }
  return baseUrl;
}

const directUrl = resolveDirectDatabaseUrl(process.env);
const childEnv = directUrl
  ? { ...process.env, DATABASE_URL: directUrl }
  : process.env;

execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: childEnv,
});

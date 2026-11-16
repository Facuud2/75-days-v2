const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
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

function getPrismaCommand() {
  const localBin = path.resolve(__dirname, '../node_modules/.bin/prisma');
  if (fs.existsSync(localBin)) {
    return { cmd: localBin, prefixArgs: [] };
  }
  return { cmd: 'npx', prefixArgs: ['prisma'] };
}

function runPrisma(args, dbUrl) {
  const { cmd, prefixArgs } = getPrismaCommand();
  const childEnv = dbUrl ? { ...process.env, DATABASE_URL: dbUrl } : process.env;
  try {
    const out = execFileSync(cmd, [...prefixArgs, ...args], {
      env: childEnv,
      encoding: 'utf8',
    });
    if (out) process.stdout.write(out);
    return { ok: true, output: out || '' };
  } catch (err) {
    const stdout = err.stdout ? String(err.stdout) : '';
    const stderr = err.stderr ? String(err.stderr) : '';
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    return { ok: false, output: `${stdout}\n${stderr}`, err };
  }
}

const originalUrl = (process.env.DATABASE_URL || '').trim();
let activeUrl = resolveDirectDatabaseUrl(process.env) || originalUrl;

let res = runPrisma(['migrate', 'deploy'], activeUrl);

// Fallback to original DATABASE_URL if direct/unpooled connection cannot be reached
if (!res.ok && activeUrl !== originalUrl && /P1001|P1000|ENOTFOUND|ECONNREFUSED/i.test(res.output)) {
  console.warn('[migrate-direct] Direct URL unreachable, retrying with DATABASE_URL...');
  activeUrl = originalUrl;
  res = runPrisma(['migrate', 'deploy'], activeUrl);
}

if (!res.ok) {
  process.exit(1);
}

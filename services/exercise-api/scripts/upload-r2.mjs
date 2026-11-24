#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const BUCKET = process.env.R2_BUCKET_NAME || '75days-exercises-media';
const CATALOG_PATH = path.join(ROOT, 'data/exercises.es.json');

if (!fs.existsSync(CATALOG_PATH)) {
  console.error('❌ No existe data/exercises.es.json. Ejecuta primero: npm run build:catalog');
  process.exit(1);
}

console.log(`☁️  Subiendo catálogo exercises.es.json al bucket R2 "${BUCKET}"...`);
execFileSync(
  'npx',
  [
    'wrangler',
    'r2',
    'object',
    'put',
    `${BUCKET}/catalog/exercises.es.json`,
    '--file',
    CATALOG_PATH,
    '--content-type',
    'application/json; charset=utf-8',
    '--cache-control',
    'public, max-age=86400, stale-while-revalidate=604800',
    '--remote',
  ],
  { stdio: 'inherit', cwd: ROOT }
);

console.log('✅ Catálogo subido a R2 correctamente.');

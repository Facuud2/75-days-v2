import { Hono } from 'hono';
import { cors } from 'hono/cors';
import catalogData from './data/catalog.json';

export interface ExerciseFacetItem {
  key: string;
  label: string;
  count: number;
}

export interface CatalogExercise {
  id: string;
  name: string;
  nameEn: string;
  bodyZone: string;
  bodyZoneLabel: string;
  primaryMuscle: string;
  primaryMuscleLabel: string;
  secondaryMuscles: Array<{ key: string; label: string }>;
  equipment: string;
  equipmentLabel: string;
  category: string;
  categoryLabel: string;
  level: string;
  levelLabel: string;
  force: string | null;
  forceLabel: string | null;
  mechanic: string | null;
  mechanicLabel: string | null;
  metValue: number;
  images: string[];
  instructions: string[];
}

export interface CatalogPayload {
  version: string;
  total: number;
  generatedAt: string;
  imageBaseUrl: string;
  facets: {
    bodyZones: ExerciseFacetItem[];
    muscles: ExerciseFacetItem[];
    equipment: ExerciseFacetItem[];
    categories: ExerciseFacetItem[];
    levels: ExerciseFacetItem[];
  };
  exercises: CatalogExercise[];
}

export interface Env {
  IMAGE_BASE_URL?: string;
  ALLOWED_ORIGINS?: string;
  EXERCISES_BUCKET?: R2Bucket;
}

const CATALOG = catalogData as unknown as CatalogPayload;
const EXERCISE_BY_ID = new Map<string, CatalogExercise>(
  CATALOG.exercises.map((exercise) => [exercise.id, exercise])
);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const SAFE_MEDIA_PATH_REGEX =
  /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:jpg|jpeg|png|webp|gif)$/i;
const MAX_QUERY_LEN = 100;
const MAX_FILTER_LEN = 50;

function isOriginAllowed(origin: string | undefined, allowedRaw?: string): string {
  if (!origin) return '*';
  if (!allowedRaw) return 'http://localhost:3000';

  const patterns = allowedRaw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  for (const pattern of patterns) {
    if (pattern === '*' || pattern === origin) return origin;
    if (pattern.includes('*')) {
      const escaped: string = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      if (new RegExp(`^${escaped}$`).test(origin)) {
        return origin;
      }
    }
  }

  return patterns[0] || 'http://localhost:3000';
}

function resolveImageBaseUrl(env?: Env): string {
  return (env?.IMAGE_BASE_URL || CATALOG.imageBaseUrl).replace(/\/+$/, '');
}

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error('[exercise-api] Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

app.use(
  '*',
  cors({
    origin: (origin, c) => isOriginAllowed(origin, c.env?.ALLOWED_ORIGINS),
    allowMethods: ['GET', 'HEAD', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'If-None-Match'],
    exposeHeaders: ['ETag', 'X-Catalog-Version'],
    maxAge: 86400,
  })
);

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: '75days-exercise-api',
    version: CATALOG.version,
    totalExercises: CATALOG.total,
    r2Connected: Boolean(c.env?.EXERCISES_BUCKET),
    imageBaseUrl: resolveImageBaseUrl(c.env),
  });
});

app.get('/v1/facets', (c) => {
  c.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  c.header('X-Catalog-Version', CATALOG.version);
  return c.json({
    version: CATALOG.version,
    total: CATALOG.total,
    facets: CATALOG.facets,
  });
});

/**
 * Full compressed bundle for 0ms client-side search & offline-first gym usage.
 * Supports ETag conditional requests (304 Not Modified).
 */
app.get('/v1/catalog/bundle', async (c) => {
  const etag = `"${CATALOG.version}"`;
  const ifNoneMatch = c.req.header('If-None-Match');

  c.header('ETag', etag);
  c.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  c.header('X-Catalog-Version', CATALOG.version);

  if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch.includes(etag))) {
    return c.body(null, 304);
  }

  // If R2 contains an updated catalog JSON, serve it directly from R2
  if (c.env?.EXERCISES_BUCKET) {
    const r2Object = await c.env.EXERCISES_BUCKET.get('catalog/exercises.es.json');
    if (r2Object) {
      c.header('Content-Type', 'application/json; charset=utf-8');
      c.header('X-Catalog-Source', 'r2');
      return c.body(r2Object.body);
    }
  }

  c.header('X-Catalog-Source', 'edge-bundle');
  return c.json({
    ...CATALOG,
    imageBaseUrl: resolveImageBaseUrl(c.env),
  });
});

/**
 * Server-side filtered & paginated search endpoint for direct REST clients.
 */
app.get('/v1/exercises', (c) => {
  const rawQ = c.req.query('q') || '';
  if (rawQ.length > MAX_QUERY_LEN) {
    return c.json({ error: 'Query parameter too long (max 100 chars)' }, 400);
  }
  const q = normalizeText(rawQ);
  const bodyZone = normalizeText((c.req.query('bodyZone') || '').slice(0, MAX_FILTER_LEN));
  const muscle = normalizeText((c.req.query('muscle') || '').slice(0, MAX_FILTER_LEN));
  const equipment = normalizeText((c.req.query('equipment') || '').slice(0, MAX_FILTER_LEN));
  const category = normalizeText((c.req.query('category') || '').slice(0, MAX_FILTER_LEN));
  const level = normalizeText((c.req.query('level') || '').slice(0, MAX_FILTER_LEN));

  const rawLimit = Number(c.req.query('limit') ?? 40);
  const rawOffset = Number(c.req.query('offset') ?? 0);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 100) : 40;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  let filtered = CATALOG.exercises;

  if (bodyZone && bodyZone !== 'all') {
    filtered = filtered.filter((e) => normalizeText(e.bodyZone) === bodyZone);
  }
  if (muscle && muscle !== 'all') {
    filtered = filtered.filter(
      (e) =>
        normalizeText(e.primaryMuscle) === muscle ||
        e.secondaryMuscles.some((s) => normalizeText(s.key) === muscle)
    );
  }
  if (equipment && equipment !== 'all') {
    filtered = filtered.filter((e) => normalizeText(e.equipment) === equipment);
  }
  if (category && category !== 'all') {
    filtered = filtered.filter((e) => normalizeText(e.category) === category);
  }
  if (level && level !== 'all') {
    filtered = filtered.filter((e) => normalizeText(e.level) === level);
  }
  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean).slice(0, 8);
    filtered = filtered.filter((e) => {
      const haystack = normalizeText(
        `${e.name} ${e.nameEn} ${e.primaryMuscleLabel} ${e.bodyZoneLabel} ${e.equipmentLabel}`
      );
      return tokens.every((token) => haystack.includes(token));
    });
  }

  const total = filtered.length;
  const items = filtered.slice(offset, offset + limit);

  c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  c.header('X-Catalog-Version', CATALOG.version);

  return c.json({
    version: CATALOG.version,
    imageBaseUrl: resolveImageBaseUrl(c.env),
    total,
    limit,
    offset,
    items,
  });
});

app.get('/v1/exercises/:id', (c) => {
  const id = c.req.param('id');
  const exercise = EXERCISE_BY_ID.get(id);
  if (!exercise) {
    return c.json({ error: 'Exercise not found' }, 404);
  }

  c.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  return c.json({
    imageBaseUrl: resolveImageBaseUrl(c.env),
    exercise,
  });
});

/**
 * Media endpoint: serves images from Cloudflare R2 when bound, or redirects cleanly
 * to the configured public CDN base URL.
 */
app.get('/v1/media/*', async (c) => {
  const rawAssetPath = c.req.path.replace(/^\/v1\/media\//, '').replace(/^\/+/, '');
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawAssetPath);
  } catch {
    return c.json({ error: 'Invalid asset path' }, 400);
  }

  // Reject traversal, double-encoding, backslashes, or non-image extensions
  if (
    !decodedPath ||
    decodedPath.includes('..') ||
    decodedPath.includes('\\') ||
    decodedPath.includes('%') ||
    !SAFE_MEDIA_PATH_REGEX.test(decodedPath)
  ) {
    return c.json({ error: 'Invalid asset path' }, 400);
  }

  if (c.env?.EXERCISES_BUCKET) {
    const object = await c.env.EXERCISES_BUCKET.get(`exercises/${decodedPath}`);
    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(object.body, { headers });
    }
  }

  const fallbackUrl = `${resolveImageBaseUrl(c.env)}/${decodedPath}`;
  return c.redirect(fallbackUrl, 302);
});

export default app;

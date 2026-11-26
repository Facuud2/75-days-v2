export interface CatalogFacet {
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
  isCustom?: boolean;
}

export interface CatalogBundle {
  version: string;
  total: number;
  generatedAt: string;
  imageBaseUrl: string;
  facets: {
    bodyZones: CatalogFacet[];
    muscles: CatalogFacet[];
    equipment: CatalogFacet[];
    categories: CatalogFacet[];
    levels: CatalogFacet[];
  };
  exercises: CatalogExercise[];
}

const STORAGE_KEY = '75days_exercise_catalog_v1';
const STORAGE_TS_KEY = '75days_exercise_catalog_ts_v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const REMOTE_TIMEOUT_MS = 4500;

let memoryBundle: CatalogBundle | null = null;
let inflightPromise: Promise<CatalogBundle> | null = null;

export function getExerciseApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_EXERCISE_API_URL?.trim();
  return configured ? configured.replace(/\/+$/, '') : '';
}

export function resolveExerciseImageUrl(
  imagePath: string | undefined,
  imageBaseUrl?: string
): string | null {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const base = (
    imageBaseUrl ||
    'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
  ).replace(/\/+$/, '');
  return `${base}/${imagePath.replace(/^\/+/, '')}`;
}

function readCachedBundle(): CatalogBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const ts = Number(window.localStorage.getItem(STORAGE_TS_KEY) || 0);
    if (!raw || !ts) return null;
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    const parsed = JSON.parse(raw) as CatalogBundle;
    if (!parsed || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedBundle(bundle: CatalogBundle): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
    window.localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
  } catch {
    // QuotaExceededError is non-fatal; memory cache remains active
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<CatalogBundle> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as CatalogBundle;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads the complete 876-exercise catalog directly from the independent Cloudflare
 * Workers microservice (zero Vercel Function invocations), falling back cleanly
 * to the static CDN asset `/data/exercises.es.json` if the external Worker is not
 * yet deployed or unreachable.
 */
export async function loadExerciseCatalog(forceRefresh = false): Promise<CatalogBundle> {
  if (!forceRefresh && memoryBundle) {
    return memoryBundle;
  }

  if (!forceRefresh) {
    const cached = readCachedBundle();
    if (cached) {
      memoryBundle = cached;
      return cached;
    }
  }

  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    const apiBase = getExerciseApiBaseUrl();
    const candidates: string[] = [];
    if (apiBase) {
      candidates.push(`${apiBase}/v1/catalog/bundle`);
    }
    candidates.push('/data/exercises.es.json');

    let lastError: unknown;
    for (const url of candidates) {
      try {
        const bundle = await fetchJsonWithTimeout(url, REMOTE_TIMEOUT_MS);
        if (bundle && Array.isArray(bundle.exercises) && bundle.exercises.length > 0) {
          memoryBundle = bundle;
          writeCachedBundle(bundle);
          return bundle;
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('No se pudo cargar el catálogo de ejercicios.');
  })().finally(() => {
    inflightPromise = null;
  });

  return inflightPromise;
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export type ExerciseEnvironment = 'all' | 'gym' | 'home' | 'outdoor';

/** Equipment that can be used at home without a gym setup */
export const HOME_EQUIPMENT_KEYS = new Set<string>([
  'body only',
  'none',
  'bands',
  'exercise ball',
  'foam roll',
  'medicine ball',
  'kettlebells',
  'dumbbell',
]);

/** Equipment that requires a gym or professional setup */
const GYM_EQUIPMENT_KEYS = new Set<string>([
  'machine',
  'cable',
  'barbell',
  'e-z curl bar',
]);

/**
 * Classify an exercise into one of the three mutually exclusive environments.
 *
 * Decision logic (evaluated in order, first match wins):
 * 1. OUTDOOR: cardio exercise NOT done on a gym machine (running, cycling,
 *    skating, rope jumping, prowler sprints, etc.)
 * 2. GYM: exercise requires gym-specific equipment (machines, cables, barbells,
 *    e-z curl bars) or 'other' equipment in gym-centric categories
 *    (strongman, powerlifting, olympic weightlifting)
 * 3. HOME: exercise uses only home-friendly equipment (bodyweight, bands, balls,
 *    dumbbells, kettlebells, and 'other' equipment that is not gym-specific)
 * 4. FALLBACK: everything else → home (stretching, plyometrics, bodyweight)
 */
export function matchesExerciseEnvironment(
  exercise: CatalogExercise,
  environment: ExerciseEnvironment
): boolean {
  if (environment === 'all') return true;

  const { equipment, category } = exercise;

  if (environment === 'outdoor') {
    // Cardio on non-machine equipment = outdoor activity
    return category === 'cardio' && equipment !== 'machine';
  }

  if (environment === 'gym') {
    // Explicit gym equipment
    if (GYM_EQUIPMENT_KEYS.has(equipment)) return true;
    // 'other' equipment in gym-centric categories
    if (
      equipment === 'other' &&
      ['strongman', 'powerlifting', 'olympic weightlifting'].includes(category)
    )
      return true;
    // Machine-based cardio (stationary bike, treadmill, elliptical, rowing, stairmaster)
    if (category === 'cardio' && equipment === 'machine') return true;
    return false;
  }

  if (environment === 'home') {
    // Outdoor cardio (non-machine cardio) belongs exclusively to 'outdoor'
    if (category === 'cardio' && equipment !== 'machine') return false;
    return (
      HOME_EQUIPMENT_KEYS.has(equipment) ||
      // 'other' equipment that is NOT gym-specific → home-friendly
      (equipment === 'other' &&
        !['strongman', 'powerlifting', 'olympic weightlifting'].includes(
          category
        ))
    );
  }

  return false;
}

export interface ExerciseFilterOptions {
  query?: string;
  bodyZone?: string;
  equipment?: string;
  level?: string;
  onlyCustom?: boolean;
  environment?: ExerciseEnvironment;
}

/**
 * 0ms bilingual client-side search & filtering across the 876 catalog exercises
 * merged with the user's custom exercises.
 */
export function filterExercises(
  exercises: CatalogExercise[],
  filters: ExerciseFilterOptions
): CatalogExercise[] {
  let result = exercises;

  if (filters.environment && filters.environment !== 'all') {
    result = result.filter((e) => matchesExerciseEnvironment(e, filters.environment!));
  }
  if (filters.onlyCustom) {
    result = result.filter((e) => e.isCustom);
  }
  if (filters.bodyZone && filters.bodyZone !== 'all') {
    result = result.filter((e) => e.bodyZone === filters.bodyZone);
  }
  if (filters.equipment && filters.equipment !== 'all') {
    result = result.filter((e) => e.equipment === filters.equipment);
  }
  if (filters.level && filters.level !== 'all') {
    result = result.filter((e) => e.level === filters.level);
  }

  const normalizedQuery = normalizeSearchText(filters.query || '');
  if (normalizedQuery) {
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    result = result.filter((e) => {
      const haystack = normalizeSearchText(
        `${e.name} ${e.nameEn} ${e.primaryMuscleLabel} ${e.bodyZoneLabel} ${e.equipmentLabel}`
      );
      return tokens.every((token) => haystack.includes(token));
    });
  }

  return result;
}

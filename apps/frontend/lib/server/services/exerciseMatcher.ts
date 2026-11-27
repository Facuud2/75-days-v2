import fs from 'node:fs';
import path from 'node:path';

export interface CatalogExerciseRaw {
  id: string;
  name: string;
  nameEn?: string;
  bodyZone: string;
  bodyZoneLabel?: string;
  primaryMuscle: string;
  primaryMuscleLabel?: string;
  equipment: string;
  equipmentLabel?: string;
  category: string;
  level?: string;
  mechanic?: string | null;
}

export interface MatchedSlotExercise {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string | null;
  equipment: string | null;
  targetSets: number;
  targetReps: string;
  defaultRestSec: number;
}

export interface RequestedExerciseHint {
  name: string;
  targetSets?: number;
  targetReps?: string;
  defaultRestSec?: number;
}

export type MatcherEnvironment = 'home' | 'gym' | 'outdoor' | 'mixed' | null | undefined;

let cachedCatalog: CatalogExerciseRaw[] | null = null;

export function normalizeExerciseText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MUSCLE_SYNONYMS: Record<string, string[]> = {
  pecho: ['chest'],
  chest: ['chest'],
  pectorales: ['chest'],
  espalda: ['lats', 'middle back', 'lower back', 'traps'],
  back: ['lats', 'middle back', 'lower back', 'traps'],
  dorsales: ['lats'],
  lats: ['lats'],
  trapecios: ['traps'],
  traps: ['traps'],
  hombros: ['shoulders'],
  hombro: ['shoulders'],
  shoulders: ['shoulders'],
  deltoides: ['shoulders'],
  brazos: ['biceps', 'triceps', 'forearms'],
  arms: ['biceps', 'triceps', 'forearms'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  antebrazos: ['forearms'],
  forearms: ['forearms'],
  piernas: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  pierna: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  cuadriceps: ['quadriceps'],
  quadriceps: ['quadriceps'],
  isquiotibiales: ['hamstrings'],
  femorales: ['hamstrings'],
  hamstrings: ['hamstrings'],
  gluteos: ['glutes'],
  gluteo: ['glutes'],
  glutes: ['glutes'],
  gemelos: ['calves'],
  pantorrillas: ['calves'],
  calves: ['calves'],
  aductores: ['adductors'],
  abductores: ['abductors'],
  abdominales: ['abdominals'],
  abdomen: ['abdominals'],
  abs: ['abdominals'],
  core: ['abdominals'],
  abdominals: ['abdominals'],
  'cuerpo completo': ['quadriceps', 'chest', 'lats', 'shoulders', 'abdominals'],
  'full body': ['quadriceps', 'chest', 'lats', 'shoulders', 'abdominals'],
  'tren superior': ['chest', 'lats', 'shoulders', 'biceps', 'triceps'],
  'upper body': ['chest', 'lats', 'shoulders', 'biceps', 'triceps'],
  'tren inferior': ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  'lower body': ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  empuje: ['chest', 'shoulders', 'triceps'],
  push: ['chest', 'shoulders', 'triceps'],
  traccion: ['lats', 'middle back', 'biceps'],
  tiron: ['lats', 'middle back', 'biceps'],
  pull: ['lats', 'middle back', 'biceps'],
};

export function expandFocusMuscles(focusMuscles: string[] = []): Set<string> {
  const expanded = new Set<string>();
  for (const raw of focusMuscles) {
    const norm = normalizeExerciseText(raw);
    if (!norm) continue;
    const direct = MUSCLE_SYNONYMS[norm];
    if (direct) {
      direct.forEach((m) => expanded.add(m));
      continue;
    }
    let matched = false;
    for (const [key, targets] of Object.entries(MUSCLE_SYNONYMS)) {
      if (norm.includes(key) || key.includes(norm)) {
        targets.forEach((m) => expanded.add(m));
        matched = true;
      }
    }
    if (!matched) {
      expanded.add(norm);
    }
  }
  return expanded;
}

export function loadExerciseCatalog(): CatalogExerciseRaw[] {
  if (cachedCatalog) return cachedCatalog;

  const candidates = [
    path.join(process.cwd(), 'public', 'data', 'exercises.es.json'),
    path.join(process.cwd(), 'apps', 'frontend', 'public', 'data', 'exercises.es.json'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
        exercises?: CatalogExerciseRaw[];
      };
      cachedCatalog = Array.isArray(parsed.exercises) ? parsed.exercises : [];
      return cachedCatalog;
    }
  }

  cachedCatalog = [];
  return cachedCatalog;
}

export function scoreEnvironmentCompatibility(
  equipment: string,
  environment: MatcherEnvironment
): number {
  const eq = normalizeExerciseText(equipment || '');
  if (!environment || environment === 'mixed') return 0;

  if (environment === 'home') {
    if (eq === 'body only' || eq === 'none') return 30;
    if (eq === 'dumbbell' || eq === 'bands' || eq === 'kettlebells' || eq === 'exercise ball') {
      return 22;
    }
    if (eq === 'other' || eq === 'medicine ball' || eq === 'foam roll') return 8;
    if (eq === 'barbell' || eq === 'e z curl bar') return -18;
    if (eq === 'machine' || eq === 'cable') return -45;
    return 0;
  }

  if (environment === 'outdoor') {
    if (eq === 'body only' || eq === 'none') return 35;
    if (eq === 'bands') return 20;
    if (eq === 'dumbbell' || eq === 'kettlebells') return -12;
    if (eq === 'barbell' || eq === 'machine' || eq === 'cable' || eq === 'e z curl bar') {
      return -50;
    }
    return 0;
  }

  // gym
  if (eq === 'barbell' || eq === 'dumbbell' || eq === 'cable' || eq === 'machine') return 18;
  if (eq === 'e z curl bar' || eq === 'kettlebells' || eq === 'body only') return 10;
  return 0;
}

function scoreNameMatch(queryNorm: string, exercise: CatalogExerciseRaw): number {
  const nameEs = normalizeExerciseText(exercise.name);
  const nameEn = normalizeExerciseText(exercise.nameEn || '');

  if (nameEs === queryNorm || nameEn === queryNorm) return 120;
  if (nameEs.includes(queryNorm) || (nameEn && nameEn.includes(queryNorm))) return 85;
  if (queryNorm.includes(nameEs) && nameEs.length >= 6) return 75;

  const queryTokens = queryNorm.split(' ').filter((t) => t.length >= 2);
  if (queryTokens.length === 0) return 0;

  const targetTokens = new Set(
    `${nameEs} ${nameEn}`.split(' ').filter((t) => t.length >= 2)
  );

  let overlap = 0;
  for (const token of queryTokens) {
    if (targetTokens.has(token)) {
      overlap += 1;
    } else {
      for (const candidate of targetTokens) {
        if (candidate.startsWith(token) || token.startsWith(candidate)) {
          overlap += 0.65;
          break;
        }
      }
    }
  }

  const ratio = overlap / queryTokens.length;
  return Math.round(ratio * 70);
}

export function matchExercisesForSlot(params: {
  requestedExercises?: RequestedExerciseHint[];
  focusMuscles?: string[];
  environment?: MatcherEnvironment;
  maxExercises?: number;
  catalogOverride?: CatalogExerciseRaw[];
}): MatchedSlotExercise[] {
  const catalog = params.catalogOverride ?? loadExerciseCatalog();
  if (catalog.length === 0) return [];

  const maxExercises = Math.min(12, Math.max(1, params.maxExercises ?? 5));
  const targetMuscles = expandFocusMuscles(params.focusMuscles ?? []);
  const usedIds = new Set<string>();
  const matched: MatchedSlotExercise[] = [];

  // 1. Match explicit exercises requested by the AI
  for (const req of params.requestedExercises ?? []) {
    if (matched.length >= maxExercises) break;
    const queryNorm = normalizeExerciseText(req.name);
    if (!queryNorm) continue;

    let best: CatalogExerciseRaw | null = null;
    let bestScore = -Infinity;

    for (const ex of catalog) {
      if (usedIds.has(ex.id)) continue;
      const nameScore = scoreNameMatch(queryNorm, ex);
      if (nameScore < 20) continue;

      const envScore = scoreEnvironmentCompatibility(ex.equipment, params.environment);
      const muscleBonus =
        targetMuscles.size > 0 && targetMuscles.has(normalizeExerciseText(ex.primaryMuscle))
          ? 12
          : 0;
      const categoryBonus = ex.category === 'strength' ? 6 : 0;
      const total = nameScore + envScore + muscleBonus + categoryBonus;

      if (total > bestScore) {
        bestScore = total;
        best = ex;
      }
    }

    if (best && bestScore >= 18) {
      usedIds.add(best.id);
      matched.push({
        exerciseId: best.id,
        exerciseName: best.name,
        primaryMuscle: best.primaryMuscle || null,
        equipment: best.equipment || null,
        targetSets: Math.min(10, Math.max(1, Math.round(req.targetSets ?? 3))),
        targetReps: (req.targetReps || '8-12').trim().slice(0, 24),
        defaultRestSec: Math.min(300, Math.max(15, Math.round(req.defaultRestSec ?? 90))),
      });
    }
  }

  // 2. If we still have no exercises (or focus-only slot), fill deterministically by focusMuscles
  const desiredCount =
    (params.requestedExercises?.length ?? 0) > 0
      ? Math.min(maxExercises, params.requestedExercises!.length)
      : Math.min(maxExercises, 4);

  if (matched.length < desiredCount && targetMuscles.size > 0) {
    const candidates = catalog
      .filter((ex) => {
        if (usedIds.has(ex.id)) return false;
        const m = normalizeExerciseText(ex.primaryMuscle);
        return targetMuscles.has(m);
      })
      .map((ex) => {
        const envScore = scoreEnvironmentCompatibility(ex.equipment, params.environment);
        const strengthBonus = ex.category === 'strength' ? 25 : ex.category === 'plyometrics' ? 8 : -20;
        const compoundBonus = ex.mechanic === 'compound' ? 12 : 4;
        const levelBonus = ex.level === 'beginner' ? 8 : ex.level === 'intermediate' ? 5 : 0;
        return {
          ex,
          score: envScore + strengthBonus + compoundBonus + levelBonus,
        };
      })
      .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));

    // Spread across target muscles when multiple muscles are requested
    const muscleOrder = Array.from(targetMuscles);
    let muscleIdx = 0;

    while (matched.length < desiredCount && candidates.length > 0) {
      const wantedMuscle = muscleOrder[muscleIdx % muscleOrder.length];
      let pickIdx = candidates.findIndex(
        (c) => normalizeExerciseText(c.ex.primaryMuscle) === wantedMuscle && !usedIds.has(c.ex.id)
      );
      if (pickIdx === -1) {
        pickIdx = candidates.findIndex((c) => !usedIds.has(c.ex.id));
      }
      if (pickIdx === -1) break;

      const [picked] = candidates.splice(pickIdx, 1);
      usedIds.add(picked.ex.id);
      matched.push({
        exerciseId: picked.ex.id,
        exerciseName: picked.ex.name,
        primaryMuscle: picked.ex.primaryMuscle || null,
        equipment: picked.ex.equipment || null,
        targetSets: 3,
        targetReps: '8-12',
        defaultRestSec: 90,
      });
      muscleIdx += 1;
    }
  }

  return matched;
}

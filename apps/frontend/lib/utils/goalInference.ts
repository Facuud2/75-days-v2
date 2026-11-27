export type InferredCadence = 'daily' | 'weekly' | 'monthly';
export type InferredMeasurementType = 'boolean' | 'count' | 'numeric';

export type DynamicMetricSource =
  | 'workout_minutes'
  | 'workout_distance_km'
  | 'workout_steps'
  | 'workout_sessions'
  | 'workout_calories'
  | 'nutrition_calories'
  | 'nutrition_protein_g'
  | 'nutrition_carbs_g'
  | 'nutrition_fat_g'
  | 'nutrition_fiber_g'
  | 'nutrition_sugar_g'
  | 'weight_loss_kg'
  | 'weight_target_kg';

export interface InferredGoalMeasurement {
  cadence: InferredCadence;
  measurementType: InferredMeasurementType;
  targetValue: number;
  targetUnit: string | null;
  metricSource: DynamicMetricSource | null;
  sportFilter?: 'walking' | 'running' | 'cycling' | 'swimming' | 'strength' | 'yoga' | null;
}

export interface UnitPreset {
  unit: string;
  label: string;
  measurementType: 'count' | 'numeric';
  defaultTarget: number;
}

export const UNIT_PRESETS: readonly UnitPreset[] = [
  { unit: 'veces', label: 'veces', measurementType: 'count', defaultTarget: 3 },
  { unit: 'sesiones', label: 'sesiones', measurementType: 'count', defaultTarget: 4 },
  { unit: 'km', label: 'km', measurementType: 'numeric', defaultTarget: 5 },
  { unit: 'pasos', label: 'pasos', measurementType: 'numeric', defaultTarget: 8000 },
  { unit: 'min', label: 'min', measurementType: 'numeric', defaultTarget: 30 },
  { unit: 'L', label: 'L', measurementType: 'numeric', defaultTarget: 2.5 },
  { unit: 'págs', label: 'págs', measurementType: 'numeric', defaultTarget: 10 },
  { unit: 'kg', label: 'kg', measurementType: 'numeric', defaultTarget: 2 },
  { unit: 'kcal', label: 'kcal', measurementType: 'numeric', defaultTarget: 2000 },
  { unit: 'g prot', label: 'g prot', measurementType: 'numeric', defaultTarget: 140 },
  { unit: 'g carbs', label: 'g carbs', measurementType: 'numeric', defaultTarget: 200 },
  { unit: 'horas', label: 'horas', measurementType: 'numeric', defaultTarget: 8 },
] as const;

/**
 * Parses numbers formatted with dot/comma thousands or decimal separators.
 * Examples: "8.000" -> 8000, "10,000" -> 10000, "3.7" -> 3.7, "3,5" -> 3.5, "8k" -> 8000.
 */
export function parseFlexibleNumber(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;

  const kMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*k$/i);
  if (kMatch) {
    const base = Number(kMatch[1].replace(',', '.'));
    return Number.isFinite(base) && base > 0 ? Math.round(base * 1000) : null;
  }

  // Thousands separator pattern like 8.000 or 10,000 or 12.500
  if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) {
    const digits = cleaned.replace(/[.,]/g, '');
    const parsed = Number(digits);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const normalized = cleaned.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function roundDynamicValue(value: number): number {
  return Math.round(value * 100) / 100;
}

export function detectCadenceFromText(text: string): InferredCadence {
  const lower = text.toLowerCase();
  if (
    /\b(por\s+mes|al\s+mes|cada\s+mes|mensual(?:es)?|\/\s*mes)\b/i.test(lower)
  ) {
    return 'monthly';
  }
  if (
    /\b(por\s+semana|a\s+la\s+semana|cada\s+semana|semanal(?:es)?|\/\s*sem(?:ana)?|x\s*sem(?:ana)?)\b/i.test(
      lower
    )
  ) {
    return 'weekly';
  }
  return 'daily';
}

export function detectSportFilter(
  text: string
): 'walking' | 'running' | 'cycling' | 'swimming' | 'strength' | 'yoga' | null {
  const lower = text.toLowerCase();
  if (/\b(caminar|caminata|walking|pasos)\b/i.test(lower)) return 'walking';
  if (/\b(correr|running|trote|trotar|maratón|carrera)\b/i.test(lower)) return 'running';
  if (/\b(bici|bicicleta|ciclismo|cycling|pedalear)\b/i.test(lower)) return 'cycling';
  if (/\b(nadar|natación|swimming|pileta)\b/i.test(lower)) return 'swimming';
  if (/\b(yoga|pilates|estiramiento)\b/i.test(lower)) return 'yoga';
  if (/\b(pesas|gimnasio|gym|fuerza|musculación|strength)\b/i.test(lower)) return 'strength';
  return null;
}

export function detectMetricSource(
  title: string,
  description?: string | null,
  targetUnit?: string | null
): {
  metricSource: DynamicMetricSource | null;
  sportFilter: 'walking' | 'running' | 'cycling' | 'swimming' | 'strength' | 'yoga' | null;
} {
  const combined = `${title} ${description ?? ''}`.toLowerCase();
  const unit = (targetUnit ?? '').trim().toLowerCase();
  const sportFilter = detectSportFilter(combined);

  // Weight goals
  if (
    unit === 'kg' ||
    /\b(peso|bajar\s+de\s+peso|adelgazar|perder\s+\d|bajar\s+\d)\b/i.test(combined)
  ) {
    if (/\b(bajar|perder|reducir|menos|descender)\b/i.test(combined)) {
      return { metricSource: 'weight_loss_kg', sportFilter: null };
    }
    if (/\b(peso|pesar|llegar\s+a|alcanzar)\b/i.test(combined) && /\bkg\b/i.test(combined + ' ' + unit)) {
      return { metricSource: 'weight_target_kg', sportFilter: null };
    }
  }

  // Nutrition goals
  if (
    /\b(proteína|proteina|proteínas|proteinas|protein)\b/i.test(combined) ||
    unit === 'g prot' ||
    unit === 'g proteína'
  ) {
    return { metricSource: 'nutrition_protein_g', sportFilter: null };
  }
  if (
    /\b(carbohidrato|carbohidratos|carbs|hidratos)\b/i.test(combined) ||
    unit === 'g carbs'
  ) {
    return { metricSource: 'nutrition_carbs_g', sportFilter: null };
  }
  if (
    /\b(grasa|grasas|lípidos|lipidos|fat)\b/i.test(combined) ||
    unit === 'g grasas'
  ) {
    return { metricSource: 'nutrition_fat_g', sportFilter: null };
  }
  if (/\b(fibra|fiber)\b/i.test(combined) || unit === 'g fibra') {
    return { metricSource: 'nutrition_fiber_g', sportFilter: null };
  }
  if (/\b(azúcar|azucar|sugar)\b/i.test(combined) && (unit === 'g' || /\d+\s*g\b/i.test(combined))) {
    return { metricSource: 'nutrition_sugar_g', sportFilter: null };
  }
  if (
    /\b(kcal|calorías|calorias)\b/i.test(combined) ||
    unit === 'kcal' ||
    unit === 'cal'
  ) {
    if (/\b(quemar|gastar|actividad|entrenamiento|ejercicio|correr|caminar|bici)\b/i.test(combined)) {
      return { metricSource: 'workout_calories', sportFilter };
    }
    return { metricSource: 'nutrition_calories', sportFilter: null };
  }

  // Workout / activity goals
  if (/\b(pasos|steps)\b/i.test(combined) || unit === 'pasos' || unit === 'steps') {
    return { metricSource: 'workout_steps', sportFilter: sportFilter ?? 'walking' };
  }
  if (
    unit === 'km' ||
    unit === 'kms' ||
    /\b(\d+(?:[.,]\d+)?\s*(?:km|kilómetros|kilometros))\b/i.test(combined)
  ) {
    return { metricSource: 'workout_distance_km', sportFilter };
  }
  if (
    (unit === 'min' || unit === 'minutos') &&
    /\b(entren|ejerc|gym|gimnasio|correr|running|caminar|caminata|bici|ciclismo|cardio|fuerza|yoga|natación|deporte|actividad\s+física)\b/i.test(
      combined
    )
  ) {
    return { metricSource: 'workout_minutes', sportFilter };
  }
  if (
    (unit === 'sesiones' || unit === 'entrenamientos' || unit === 'veces') &&
    /\b(entren|ejerc|gym|gimnasio|correr|running|caminar|caminata|bici|ciclismo|cardio|fuerza|yoga|natación|deporte|actividad\s+física)\b/i.test(
      combined
    )
  ) {
    return { metricSource: 'workout_sessions', sportFilter };
  }

  return { metricSource: null, sportFilter: null };
}

interface PatternRule {
  regex: RegExp;
  measurementType: 'count' | 'numeric';
  unit: string;
  forceCadence?: InferredCadence;
}

const PATTERN_RULES: PatternRule[] = [
  // Steps: "8.000 pasos", "10k pasos", "10000 steps"
  {
    regex: /(\d+(?:[.,]\d+)*(?:\s*k)?)\s*(?:pasos|steps)\b/i,
    measurementType: 'numeric',
    unit: 'pasos',
  },
  // Distance: "5 km", "4,2 kilómetros", "20 kms"
  {
    regex: /(\d+(?:[.,]\d+)?)\s*(?:kms?|kil[oó]metros?)\b/i,
    measurementType: 'numeric',
    unit: 'km',
  },
  // Water / liquids: "3.7L", "3 litros", "2,5 l", "2000 ml"
  {
    regex: /(\d+(?:[.,]\d+)?)\s*(?:litros?|lts?|l)\b/i,
    measurementType: 'numeric',
    unit: 'L',
  },
  {
    regex: /(\d+(?:[.,]\d+)*)\s*(?:ml|mililitros?)\b/i,
    measurementType: 'numeric',
    unit: 'ml',
  },
  // Weight: "bajar 3 kg", "2.5 kilos"
  {
    regex: /(\d+(?:[.,]\d+)?)\s*(?:kgs?|kilos?|kilogramos?)\b/i,
    measurementType: 'numeric',
    unit: 'kg',
  },
  // Calories: "2000 kcal", "1800 calorías"
  {
    regex: /(\d+(?:[.,]\d+)*)\s*(?:kcals?|calor[ií]as?)\b/i,
    measurementType: 'numeric',
    unit: 'kcal',
  },
  // Macros in grams: "150g de proteína", "200 g carbohidratos"
  {
    regex: /(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos?)\s*(?:de\s+)?(?:prote[ií]nas?|protein)\b/i,
    measurementType: 'numeric',
    unit: 'g prot',
  },
  {
    regex: /(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos?)\s*(?:de\s+)?(?:carbohidratos?|carbs|hidratos)\b/i,
    measurementType: 'numeric',
    unit: 'g carbs',
  },
  {
    regex: /(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos?)\s*(?:de\s+)?(?:grasas?|l[ií]pidos?)\b/i,
    measurementType: 'numeric',
    unit: 'g grasas',
  },
  {
    regex: /(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos?)\s*(?:de\s+)?(?:fibra|fiber)\b/i,
    measurementType: 'numeric',
    unit: 'g fibra',
  },
  // Reading pages: "10 págs", "20 páginas"
  {
    regex: /(\d+(?:[.,]\d+)*)\s*(?:p[aá]gs?\.?|p[aá]ginas?|pages?)\b/i,
    measurementType: 'numeric',
    unit: 'págs',
  },
  // Hours (fasting / sleep / study): "12 horas", "8 hs", "16h"
  {
    regex: /(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?|hs)\b/i,
    measurementType: 'numeric',
    unit: 'horas',
  },
  // Countable sessions/times: "4 veces", "6 sesiones", "4 fotos", "3 comidas", "5 días por semana"
  {
    regex: /(\d+)\s*(?:sesiones?)\b/i,
    measurementType: 'count',
    unit: 'sesiones',
  },
  {
    regex: /(\d+)\s*(?:fotos?)\b/i,
    measurementType: 'count',
    unit: 'fotos',
  },
  {
    regex: /(\d+)\s*(?:veces)\b/i,
    measurementType: 'count',
    unit: 'veces',
  },
  {
    regex: /(\d+)\s*(?:comidas?|recetas?|platos?)\b/i,
    measurementType: 'count',
    unit: 'comidas',
  },
  {
    regex: /(\d+)\s*(?:vasos?)\b/i,
    measurementType: 'count',
    unit: 'vasos',
  },
  {
    regex: /(\d+)\s*(?:d[ií]as?)\s*(?:por\s+semana|a\s+la\s+semana|semanal(?:es)?|\/\s*sem)/i,
    measurementType: 'count',
    unit: 'días',
    forceCadence: 'weekly',
  },
  // Minutes: "45 min", "30 minutos" (kept after countable sessions so "6 sesiones de 45 min" picks 6 sesiones)
  {
    regex: /(\d+(?:[.,]\d+)?)\s*(?:min(?:utos?)?)\b/i,
    measurementType: 'numeric',
    unit: 'min',
  },
];

/**
 * Infers cadence, measurementType, targetValue, targetUnit, and metricSource
 * from a goal's natural-language title and optional description.
 * Returns null if the goal looks like a plain boolean check.
 */
export function inferGoalMeasurement(
  title: string,
  description?: string | null
): InferredGoalMeasurement | null {
  const cleanTitle = (title ?? '').trim();
  const cleanDesc = (description ?? '').trim();
  if (!cleanTitle && !cleanDesc) return null;

  const combined = `${cleanTitle} ${cleanDesc}`.trim();

  // Avoid false positives like "75 días" or "Ayuno 12/12" matching wrong numbers when title has "75 days"
  const sanitizedForNumeric = combined.replace(/\b75\s*d[ií]as?\b/gi, '');
  const detectedCadence = detectCadenceFromText(combined);

  // Check title first, then combined text so primary intent in title wins
  const textsToScan = [cleanTitle.replace(/\b75\s*d[ií]as?\b/gi, ''), sanitizedForNumeric];

  for (const candidateText of textsToScan) {
    if (!candidateText.trim()) continue;
    for (const rule of PATTERN_RULES) {
      const match = candidateText.match(rule.regex);
      if (!match) continue;
      const value = parseFlexibleNumber(match[1]);
      if (value === null || value <= 0) continue;

      // Avoid turning "1 vez al día" into count 1 when it's effectively boolean
      if (rule.measurementType === 'count' && value === 1 && !rule.forceCadence && detectedCadence === 'daily') {
        continue;
      }

      const cadence = rule.forceCadence ?? detectedCadence;
      const targetValue =
        rule.measurementType === 'count' ? Math.max(1, Math.round(value)) : roundDynamicValue(value);
      const { metricSource, sportFilter } = detectMetricSource(cleanTitle, cleanDesc, rule.unit);

      return {
        cadence,
        measurementType: rule.measurementType,
        targetValue,
        targetUnit: rule.unit,
        metricSource,
        sportFilter,
      };
    }
  }

  return null;
}

/**
 * Computes an ergonomic +/- increment step based on measurementType, targetValue, and unit.
 */
export function getSmartStep(
  measurementType: string | undefined,
  targetValue: number,
  targetUnit?: string | null
): number {
  if (measurementType === 'count') return 1;
  const unit = (targetUnit ?? '').trim().toLowerCase();
  if (unit === 'pasos' || unit === 'steps') {
    if (targetValue >= 5000) return 1000;
    return 500;
  }
  if (unit === 'kcal' || unit === 'cal' || unit === 'ml') {
    if (targetValue >= 1000) return 250;
    return 100;
  }
  if (unit === 'l' || unit === 'litros') return 0.5;
  if (unit === 'kg') return 0.5;
  if (unit === 'km') return targetValue <= 5 ? 0.5 : 1;
  if (targetValue <= 2) return 0.25;
  if (targetValue <= 5) return 0.5;
  if (targetValue <= 25) return 1;
  if (targetValue <= 100) return 5;
  if (targetValue <= 500) return 25;
  if (targetValue <= 2500) return 100;
  return 500;
}

export function formatMetricValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = roundDynamicValue(value);
  if (Math.abs(rounded) >= 1000 && Number.isInteger(rounded)) {
    return rounded.toLocaleString('es-AR');
  }
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatMetricReadout(
  currentValue: number,
  targetValue: number,
  unit?: string | null
): string {
  const suffix = unit?.trim() ? ` ${unit.trim()}` : '';
  return `${formatMetricValue(currentValue)} / ${formatMetricValue(targetValue)}${suffix}`;
}

/**
 * Generates a stable key for persisting per-goal UI preferences (such as custom +/- step factors).
 */
export function getGoalStepKey(goal: {
  templateId?: string | null;
  title?: string | null;
  cadence?: string | null;
}): string {
  const cadence = (goal.cadence || 'daily').toLowerCase();
  const normalizedTitle = (goal.title || '').trim().toLowerCase();
  if (normalizedTitle) {
    return `${cadence}:${normalizedTitle}`;
  }
  return goal.templateId ? `tpl:${goal.templateId}` : `${cadence}:default`;
}

/**
 * Returns ergonomic quick-select increment presets around the smart/current step.
 * Examples:
 *  - 0.5 -> [0.25, 0.5, 1, 2]
 *  - 1000 -> [250, 500, 1000, 2000]
 *  - count -> [1, 2, 5, 10]
 */
export function getStepPresets(
  measurementType: string | undefined,
  targetValue: number,
  targetUnit?: string | null,
  currentStep?: number | null
): number[] {
  const safeTarget = targetValue > 0 ? targetValue : 1;
  const baseStep = getSmartStep(measurementType, safeTarget, targetUnit);

  let candidates: number[];
  if (measurementType === 'count') {
    candidates = [1, 2, 5, 10];
  } else if (baseStep < 1) {
    candidates = [0.25, 0.5, 1, 2];
  } else if (baseStep <= 2) {
    candidates = [0.5, 1, 2, 5];
  } else if (baseStep <= 10) {
    candidates = [1, 5, 10, 25];
  } else if (baseStep <= 50) {
    candidates = [5, 10, 25, 50];
  } else if (baseStep <= 250) {
    candidates = [50, 100, 250, 500];
  } else if (baseStep <= 500) {
    candidates = [250, 500, 1000, 2000];
  } else {
    candidates = [500, 1000, 2000, 2500];
  }

  const merged = new Set<number>(candidates);
  if (currentStep && Number.isFinite(currentStep) && currentStep > 0) {
    merged.add(roundDynamicValue(currentStep));
  }
  return Array.from(merged)
    .filter((v) => v > 0)
    .sort((a, b) => a - b)
    .slice(0, 5);
}

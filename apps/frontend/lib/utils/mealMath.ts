export interface MealItemBaseDensity {
  caloriesPerG: number;
  proteinPerG: number;
  carbPerG: number;
  fatPerG: number;
  fiberPerG: number;
  sugarPerG: number;
}

export interface DetectedMealItem {
  id: string;
  name: string;
  estimatedGrams: number;
  /** Internal values kept at full floating-point precision; round only at display/save boundary. */
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  baseDensity?: MealItemBaseDensity;
}

export interface MealMacroTotals {
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
}

export function roundMacro(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 10) / 10;
}

export function formatCaloriesDisplay(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

/**
 * Attaches exact unrounded per-gram densities to a detected item so repeated
 * manual gram edits (e.g. 115g -> 5g -> 200g) never suffer cumulative rounding drift.
 */
export function attachBaseDensity(item: DetectedMealItem): DetectedMealItem {
  const grams = Number(item.estimatedGrams) || 0;
  if (grams <= 0) {
    return {
      ...item,
      fiberG: Number(item.fiberG) || 0,
      sugarG: Number(item.sugarG) || 0,
    };
  }

  return {
    ...item,
    fiberG: Number(item.fiberG) || 0,
    sugarG: Number(item.sugarG) || 0,
    baseDensity: {
      caloriesPerG: Math.max(0, (Number(item.calories) || 0) / grams),
      proteinPerG: Math.max(0, (Number(item.proteinG) || 0) / grams),
      carbPerG: Math.max(0, (Number(item.carbG) || 0) / grams),
      fatPerG: Math.max(0, (Number(item.fatG) || 0) / grams),
      fiberPerG: Math.max(0, (Number(item.fiberG) || 0) / grams),
      sugarPerG: Math.max(0, (Number(item.sugarG) || 0) / grams),
    },
  };
}

/**
 * Sums unrounded floating-point nutrients across all items first, rounding ONLY
 * the final aggregate totals for display and persistence.
 */
export function computeMealTotals(
  items: ReadonlyArray<
    Pick<DetectedMealItem, 'calories' | 'proteinG' | 'carbG' | 'fatG'> & {
      fiberG?: number;
      sugarG?: number;
    }
  >,
  portionMultiplier = 1
): MealMacroTotals {
  const safeMultiplier =
    Number.isFinite(portionMultiplier) && portionMultiplier > 0 ? portionMultiplier : 1;

  let calories = 0;
  let proteinG = 0;
  let carbG = 0;
  let fatG = 0;
  let fiberG = 0;
  let sugarG = 0;

  for (const item of items) {
    calories += (Number(item.calories) || 0) * safeMultiplier;
    proteinG += (Number(item.proteinG) || 0) * safeMultiplier;
    carbG += (Number(item.carbG) || 0) * safeMultiplier;
    fatG += (Number(item.fatG) || 0) * safeMultiplier;
    fiberG += (Number(item.fiberG) || 0) * safeMultiplier;
    sugarG += (Number(item.sugarG) || 0) * safeMultiplier;
  }

  return {
    calories: Math.round(Math.max(0, calories)),
    proteinG: roundMacro(proteinG),
    carbG: roundMacro(carbG),
    fatG: roundMacro(fatG),
    fiberG: roundMacro(fiberG),
    sugarG: roundMacro(sugarG),
  };
}

/**
 * Scales an item's nutrients proportionally using its unrounded baseDensity
 * (preserving full floating-point accuracy internally without intermediate rounding).
 */
export function scaleMealItemByGrams(
  item: DetectedMealItem,
  nextGrams: number
): DetectedMealItem {
  const clampedGrams = Math.max(0, Math.min(5000, Number(nextGrams) || 0));
  const withDensity = item.baseDensity ? item : attachBaseDensity(item);
  const density = withDensity.baseDensity;

  if (!density) {
    return {
      ...withDensity,
      estimatedGrams: clampedGrams,
    };
  }

  return {
    ...withDensity,
    estimatedGrams: clampedGrams,
    calories: Math.max(0, density.caloriesPerG * clampedGrams),
    proteinG: Math.max(0, density.proteinPerG * clampedGrams),
    carbG: Math.max(0, density.carbPerG * clampedGrams),
    fatG: Math.max(0, density.fatPerG * clampedGrams),
    fiberG: Math.max(0, density.fiberPerG * clampedGrams),
    sugarG: Math.max(0, density.sugarPerG * clampedGrams),
  };
}

/**
 * Updates a single nutrient field manually and refreshes its per-gram density
 * so subsequent gram changes scale from the user's manual value.
 */
export function updateMealItemNutrient(
  item: DetectedMealItem,
  field: 'calories' | 'proteinG' | 'carbG' | 'fatG' | 'fiberG' | 'sugarG',
  rawNumeric: number
): DetectedMealItem {
  const safeVal = Math.max(0, Number.isFinite(rawNumeric) ? rawNumeric : 0);
  const updated: DetectedMealItem = {
    ...item,
    [field]: safeVal,
  };
  return attachBaseDensity(updated);
}

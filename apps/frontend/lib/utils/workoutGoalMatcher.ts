export type WorkoutEnvironment = 'home' | 'gym' | 'outdoor';
export type GoalEnvironmentRequirement = 'indoor' | 'outdoor' | 'any';

export interface ExerciseGoalCandidate {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  measurementType: string;
  targetValue: number;
  targetUnit?: string | null;
  currentValue: number;
  completed: boolean;
}

export interface WorkoutForSync {
  id: string;
  sport: string;
  durationMin: number;
  environment?: string | null;
  linkedGoalId?: string | null;
}

export interface ExerciseGoalClassification {
  isExerciseGoal: boolean;
  environmentReq: GoalEnvironmentRequirement;
  requiredMinutes: number;
}

export interface ComputedGoalUpdate {
  goalId: string;
  title: string;
  completed: boolean;
  currentValue: number;
  accumulatedMinutes: number;
  requiredMinutes: number;
}

export const DEFAULT_REQUIRED_WORKOUT_MINUTES = 45;

const NON_EXERCISE_REGEX =
  /\b(agua|litros|hidrat|leer|lectura|pág|págs|libro|dieta|comer|comida|alcohol|foto|progreso|meditar|dormir|sueño)\b/i;

const EXERCISE_KEYWORD_REGEX =
  /\b(entrenamiento|ejercicio|actividad física|gimnasio|gym|indoor|outdoor|aire libre|en casa|cardio|fuerza|correr|running|caminar|caminata|bici|ciclismo|natación|yoga|workout|training|deporte|sesiones|pasos)\b/i;

const OUTDOOR_GOAL_REGEX =
  /\b(aire libre|outdoor|exterior|segundo entrenamiento|calle|parque|pasos)\b/i;

const INDOOR_GOAL_REGEX =
  /\b(indoor|en casa|home|gimnasio|gym|primer entrenamiento)\b/i;

const EXERCISE_ICONS = new Set([
  'dumbbell',
  'sun',
  'footprints',
  'bike',
  'activity',
  'flame',
  'zap',
]);

/**
 * Classifies whether a daily/period goal represents an exercise goal,
 * its environment requirement (indoor/outdoor/any), and required minutes.
 */
export function classifyExerciseGoal(goal: {
  title: string;
  description?: string | null;
  icon?: string | null;
  measurementType?: string;
  targetValue?: number;
  targetUnit?: string | null;
}): ExerciseGoalClassification {
  const combined = `${goal.title} ${goal.description ?? ''}`.trim();
  const hasExerciseKeyword = EXERCISE_KEYWORD_REGEX.test(combined);
  const hasNonExerciseKeyword = NON_EXERCISE_REGEX.test(combined);
  const hasExerciseIcon = Boolean(goal.icon && EXERCISE_ICONS.has(goal.icon));

  const isExerciseGoal =
    hasExerciseKeyword || (hasExerciseIcon && !hasNonExerciseKeyword);

  if (!isExerciseGoal) {
    return {
      isExerciseGoal: false,
      environmentReq: 'any',
      requiredMinutes: DEFAULT_REQUIRED_WORKOUT_MINUTES,
    };
  }

  let environmentReq: GoalEnvironmentRequirement = 'any';
  if (OUTDOOR_GOAL_REGEX.test(combined)) {
    environmentReq = 'outdoor';
  } else if (INDOOR_GOAL_REGEX.test(combined)) {
    environmentReq = 'indoor';
  }

  let requiredMinutes = DEFAULT_REQUIRED_WORKOUT_MINUTES;
  const isMinutesGoal =
    goal.measurementType === 'numeric' &&
    Boolean(goal.targetUnit && /^min/i.test(goal.targetUnit.trim()));

  if (isMinutesGoal && typeof goal.targetValue === 'number' && goal.targetValue > 0) {
    requiredMinutes = goal.targetValue;
  } else {
    const minMatch = combined.match(/(\d+)\s*(?:min|minutos|minuto)\b/i);
    if (minMatch) {
      const parsed = Number(minMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        requiredMinutes = parsed;
      }
    }
  }

  return {
    isExerciseGoal: true,
    environmentReq,
    requiredMinutes,
  };
}

/**
 * Maps a workout's explicit environment (`home`, `gym`, `outdoor`) or sport
 * to its effective indoor/outdoor category.
 * Both `home` and `gym` count as `indoor`.
 */
export function resolveEffectiveEnvironment(
  sport: string,
  environment?: string | null
): 'indoor' | 'outdoor' {
  if (environment === 'home' || environment === 'gym') return 'indoor';
  if (environment === 'outdoor') return 'outdoor';
  if (sport === 'running' || sport === 'walking' || sport === 'cycling') {
    return 'outdoor';
  }
  return 'indoor';
}

/**
 * Picks the best automatic exercise goal for a workout based on environment.
 * Returns null if no eligible goal matches.
 */
export function pickAutomaticGoalForWorkout(
  workout: Pick<WorkoutForSync, 'sport' | 'environment'>,
  classifiedGoals: Array<{
    goal: ExerciseGoalCandidate;
    classification: ExerciseGoalClassification;
  }>
): { goal: ExerciseGoalCandidate; classification: ExerciseGoalClassification } | null {
  const effectiveEnv = resolveEffectiveEnvironment(
    workout.sport,
    workout.environment
  );

  if (effectiveEnv === 'outdoor') {
    return (
      classifiedGoals.find((g) => g.classification.environmentReq === 'outdoor') ??
      classifiedGoals.find((g) => g.classification.environmentReq === 'any') ??
      null
    );
  }

  return (
    classifiedGoals.find((g) => g.classification.environmentReq === 'indoor') ??
    classifiedGoals.find((g) => g.classification.environmentReq === 'any') ??
    null
  );
}

/**
 * Computes accumulated workout minutes per goal and returns the list of
 * DailyGoals whose completion/currentValue state should be updated.
 */
export function computeDailyWorkoutGoalUpdates(
  workouts: WorkoutForSync[],
  goals: ExerciseGoalCandidate[]
): ComputedGoalUpdate[] {
  const classifiedGoals = goals
    .map((goal) => ({
      goal,
      classification: classifyExerciseGoal(goal),
    }))
    .filter((entry) => entry.classification.isExerciseGoal);

  const goalById = new Map(goals.map((g) => [g.id, g]));
  const classificationById = new Map(
    classifiedGoals.map((entry) => [entry.goal.id, entry.classification])
  );

  const minutesByGoalId = new Map<string, number>();
  for (const entry of classifiedGoals) {
    minutesByGoalId.set(entry.goal.id, 0);
  }

  for (const w of workouts) {
    let targetGoalId: string | null = null;

    if (w.linkedGoalId && goalById.has(w.linkedGoalId)) {
      targetGoalId = w.linkedGoalId;
    } else {
      const matched = pickAutomaticGoalForWorkout(w, classifiedGoals);
      if (matched) {
        targetGoalId = matched.goal.id;
      }
    }

    if (targetGoalId) {
      const prev = minutesByGoalId.get(targetGoalId) ?? 0;
      minutesByGoalId.set(
        targetGoalId,
        prev + Math.max(0, Number(w.durationMin) || 0)
      );
    }
  }

  const updates: ComputedGoalUpdate[] = [];
  for (const [goalId, accumulatedMinutes] of minutesByGoalId.entries()) {
    const goal = goalById.get(goalId);
    if (!goal) continue;

    const classification = classificationById.get(goalId);
    const requiredMinutes =
      classification?.requiredMinutes ?? DEFAULT_REQUIRED_WORKOUT_MINUTES;

    const isNumericMinutes =
      goal.measurementType === 'numeric' &&
      Boolean(goal.targetUnit && /^min/i.test(goal.targetUnit.trim()));

    const nextCurrentValue = isNumericMinutes
      ? accumulatedMinutes
      : accumulatedMinutes >= requiredMinutes
        ? goal.targetValue || 1
        : 0;

    const nextCompleted = isNumericMinutes
      ? accumulatedMinutes >= (goal.targetValue || requiredMinutes)
      : accumulatedMinutes >= requiredMinutes;

    if (
      nextCompleted !== goal.completed ||
      nextCurrentValue !== (goal.currentValue ?? 0)
    ) {
      updates.push({
        goalId,
        title: goal.title,
        completed: nextCompleted,
        currentValue: nextCurrentValue,
        accumulatedMinutes,
        requiredMinutes,
      });
    }
  }

  return updates;
}

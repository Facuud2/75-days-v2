export type WeightGoalLevelId =
  | 'maintain'
  | 'realistic'
  | 'optimistic'
  | 'challenging'
  | 'transformative';

export type WeightGoalDirection = 'lose' | 'gain' | 'maintain';

export type WeightGoalAssessment = {
  currentWeight: number;
  targetWeight: number;
  deltaKg: number;
  absDeltaKg: number;
  percentChange: number;
  direction: WeightGoalDirection;
  levelId: WeightGoalLevelId;
  levelIndex: 0 | 1 | 2 | 3 | 4;
  label: string;
  headline: string;
  message: string;
  colorVar: string;
};

export const WEIGHT_GOAL_SEGMENTS: Array<{
  id: Exclude<WeightGoalLevelId, 'maintain'>;
  label: string;
  colorVar: string;
}> = [
  { id: 'realistic', label: 'Realista', colorVar: 'var(--status-success)' },
  { id: 'optimistic', label: 'Optimista', colorVar: 'var(--status-info)' },
  { id: 'challenging', label: 'Desafiante', colorVar: 'var(--status-warning)' },
  { id: 'transformative', label: 'Transformadora', colorVar: 'var(--status-danger)' },
];

export function assessWeightGoal(
  currentWeightKg: number,
  targetWeightKg: number
): WeightGoalAssessment {
  const currentWeight = Number(currentWeightKg.toFixed(1));
  const targetWeight = Number(targetWeightKg.toFixed(1));
  const deltaKg = Number((targetWeight - currentWeight).toFixed(1));
  const absDeltaKg = Number(Math.abs(deltaKg).toFixed(1));

  if (absDeltaKg < 0.1) {
    return {
      currentWeight,
      targetWeight,
      deltaKg: 0,
      absDeltaKg: 0,
      percentChange: 0,
      direction: 'maintain',
      levelId: 'maintain',
      levelIndex: 0,
      label: 'Equilibrio',
      headline: 'Mantenés tu peso actual',
      message:
        'Conservás tu peso mientras consolidás hábitos que perduran.',
      colorVar: 'var(--status-info)',
    };
  }

  const direction: WeightGoalDirection = deltaKg < 0 ? 'lose' : 'gain';
  const percentChange =
    currentWeight > 0
      ? Number(((absDeltaKg / currentWeight) * 100).toFixed(1))
      : 0;
  const formattedDelta = absDeltaKg.toFixed(1);
  const headline =
    direction === 'lose'
      ? `Bajás ${formattedDelta} kg`
      : `Subís ${formattedDelta} kg`;

  if (percentChange <= 5) {
    return {
      currentWeight,
      targetWeight,
      deltaKg,
      absDeltaKg,
      percentChange,
      direction,
      levelId: 'realistic',
      levelIndex: 1,
      label: 'Realista',
      headline,
      message:
        direction === 'lose'
          ? 'Un ritmo amable y sostenible para sumar confianza desde el día uno.'
          : 'Un avance gradual y saludable para construir a tu ritmo.',
      colorVar: 'var(--status-success)',
    };
  }

  if (percentChange <= 10) {
    return {
      currentWeight,
      targetWeight,
      deltaKg,
      absDeltaKg,
      percentChange,
      direction,
      levelId: 'optimistic',
      levelIndex: 2,
      label: 'Optimista',
      headline,
      message:
        direction === 'lose'
          ? 'El punto justo entre exigencia y bienestar para ver resultados reales.'
          : 'Un objetivo equilibrado para notar progreso constante cada semana.',
      colorVar: 'var(--status-info)',
    };
  }

  if (percentChange <= 16) {
    return {
      currentWeight,
      targetWeight,
      deltaKg,
      absDeltaKg,
      percentChange,
      direction,
      levelId: 'challenging',
      levelIndex: 3,
      label: 'Desafiante',
      headline,
      message:
        direction === 'lose'
          ? 'Una meta con carácter: tu constancia diaria va a marcar la diferencia.'
          : 'Un reto exigente que premia la disciplina y el enfoque diario.',
      colorVar: 'var(--status-warning)',
    };
  }

  return {
    currentWeight,
    targetWeight,
    deltaKg,
    absDeltaKg,
    percentChange,
    direction,
    levelId: 'transformative',
    levelIndex: 4,
    label: 'Transformadora',
    headline,
    message:
      direction === 'lose'
        ? 'Un cambio profundo y valiente: celebrá cada pequeño avance en el camino.'
        : 'Una transformación grande: paso a paso se construyen grandes logros.',
    colorVar: 'var(--status-danger)',
  };
}

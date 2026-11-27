import type { WorkoutEntryRecord } from '@/lib/api/health';
import { estimateWorkoutCaloriesClient } from '@/store/useHealthStore';

export type SummaryRingId = 'energy' | 'time' | 'focus';

export interface WorkoutSummaryRingMetric {
  id: SummaryRingId;
  label: string;
  shortLabel: string;
  valueDisplay: string;
  goalDisplay: string;
  ratio: number; // Unclamped >= 0 (supports > 1.0 for Apple Watch overfill laps)
  percent: number;
  isClosed: boolean;
  detailText: string;
  ariaLabel: string;
}

export interface WorkoutSummaryRingsModel {
  rings: [WorkoutSummaryRingMetric, WorkoutSummaryRingMetric, WorkoutSummaryRingMetric];
  closedCount: number;
  overallPercent: number;
  defaultDetailText: string;
}

export interface WorkoutSummaryProfileContext {
  weightKg?: number | null;
  heightCm?: number | null;
  goalMinutes?: number;
}

const CARDIO_DISTANCE_GOALS_KM: Record<string, number> = {
  running: 5,
  cycling: 15,
  walking: 4,
  swimming: 1,
  other: 5,
};

const SPORT_LABELS: Record<string, string> = {
  strength: 'Fuerza',
  running: 'Running',
  cycling: 'Ciclismo',
  walking: 'Caminata',
  swimming: 'Natación',
  yoga: 'Yoga',
  other: 'Entrenamiento',
};

const INTENSITY_META: Record<string, { label: string; ratio: number }> = {
  low: { label: 'Suave', ratio: 0.45 },
  medium: { label: 'Media', ratio: 0.75 },
  high: { label: 'Alta', ratio: 1.0 },
};

function formatNumberEs(value: number): string {
  return Math.round(value).toLocaleString('es-ES');
}

function formatDistanceKm(km: number): string {
  const rounded = Math.round(km * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
}

function formatPaceMinPerKm(minPerKm: number): string {
  const totalSec = Math.max(1, Math.round(minPerKm * 60));
  const mins = Math.floor(totalSec / 60);
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export function buildWorkoutSummaryRings(
  summary: WorkoutEntryRecord,
  profile: WorkoutSummaryProfileContext = {}
): WorkoutSummaryRingsModel {
  const goalMinutes = profile.goalMinutes && profile.goalMinutes > 0 ? profile.goalMinutes : 45;
  const weightKg = Number(profile.weightKg) > 0 ? Number(profile.weightKg) : 70;
  const heightCm = Number(profile.heightCm) > 0 ? Number(profile.heightCm) : 170;
  const sport = (summary.sport || 'strength').toLowerCase();
  const sportLabel = SPORT_LABELS[sport] || 'Entrenamiento';
  const intensityKey = (summary.intensity || 'medium').toLowerCase();
  const intensityInfo = INTENSITY_META[intensityKey] || INTENSITY_META.medium;

  const durationMin = Math.max(0, Math.round(Number(summary.durationMin) || 0));
  const caloriesBurned = Math.max(0, Math.round(Number(summary.caloriesBurned) || 0));

  // 1. Outer Ring (Rose): Energy / Calories burned vs personalized 45-min reference
  const rawTargetKcal = estimateWorkoutCaloriesClient(sport, goalMinutes, 'medium', weightKg, heightCm);
  const targetKcal = Math.max(150, Math.round(rawTargetKcal / 10) * 10);
  const energyRatio = targetKcal > 0 ? caloriesBurned / targetKcal : 0;
  const energyPercent = Math.round(energyRatio * 100);
  const kcalPerMin = durationMin > 0 ? (caloriesBurned / durationMin).toFixed(1).replace('.', ',') : '0';

  const energyRing: WorkoutSummaryRingMetric = {
    id: 'energy',
    label: 'ENERGÍA',
    shortLabel: 'KCAL',
    valueDisplay: formatNumberEs(caloriesBurned),
    goalDisplay: `/ ${formatNumberEs(targetKcal)} KCAL`,
    ratio: energyRatio,
    percent: energyPercent,
    isClosed: energyRatio >= 1,
    detailText: `~${kcalPerMin} kcal/min · Intensidad ${intensityInfo.label.toLowerCase()}`,
    ariaLabel: `Energía: ${caloriesBurned} de ${targetKcal} kilocalorías, ${energyPercent} por ciento`,
  };

  // 2. Middle Ring (Green): Active Time vs 45m 75 Days goal
  const timeRatio = durationMin / goalMinutes;
  const timePercent = Math.round(timeRatio * 100);
  const extraMin = durationMin - goalMinutes;

  const timeDetail =
    extraMin > 0
      ? `Meta 75 Days superada (+${extraMin} min extra)`
      : extraMin === 0
        ? `Meta diaria de ${goalMinutes} min cumplida`
        : `${goalMinutes - durationMin} min para meta diaria de ${goalMinutes}m`;

  const timeRing: WorkoutSummaryRingMetric = {
    id: 'time',
    label: 'TIEMPO',
    shortLabel: 'MIN',
    valueDisplay: formatNumberEs(durationMin),
    goalDisplay: `/ ${goalMinutes} MIN`,
    ratio: timeRatio,
    percent: timePercent,
    isClosed: timeRatio >= 1,
    detailText: timeDetail,
    ariaLabel: `Tiempo: ${durationMin} de ${goalMinutes} minutos, ${timePercent} por ciento`,
  };

  // 3. Inner Ring (Cyan): Strength Sets OR Cardio Distance OR Intensity
  const exercises = summary.exercises || [];
  let focusRing: WorkoutSummaryRingMetric;
  let defaultDetailText: string;

  if (exercises.length > 0) {
    let completedTotalSets = 0;
    let plannedTotalSets = 0;
    let totalReps = 0;
    let computedVolumeKg = 0;

    for (const ex of exercises) {
      for (const s of ex.sets) {
        plannedTotalSets += 1;
        if (s.completed) {
          completedTotalSets += 1;
          const reps = Number(s.reps) || 0;
          const weight = Number(s.weightKg) || 0;
          if (reps > 0) totalReps += reps;
          if (reps > 0 && weight > 0) computedVolumeKg += reps * weight;
        }
      }
    }

    const completedExercisesCount = exercises.filter(
      (ex) => ex.sets.length > 0 && ex.sets.every((s) => s.completed)
    ).length;

    const totalVolumeKg =
      Number(summary.loadVolumeKg) > 0
        ? Math.round(Number(summary.loadVolumeKg))
        : Math.round(computedVolumeKg);

    const setsTarget = plannedTotalSets > 0 ? plannedTotalSets : Math.max(1, completedTotalSets);
    const setsRatio = setsTarget > 0 ? completedTotalSets / setsTarget : 0;
    const setsPercent = Math.round(setsRatio * 100);

    const focusParts: string[] = [];
    if (totalVolumeKg > 0) focusParts.push(`${formatNumberEs(totalVolumeKg)} kg`);
    if (totalReps > 0) focusParts.push(`${formatNumberEs(totalReps)} reps`);
    focusParts.push(`${completedExercisesCount}/${exercises.length} ejerc.`);

    focusRing = {
      id: 'focus',
      label: 'SERIES',
      shortLabel: 'SERIES',
      valueDisplay: String(completedTotalSets),
      goalDisplay: `/ ${setsTarget} SERIES`,
      ratio: setsRatio,
      percent: setsPercent,
      isClosed: setsRatio >= 1 && completedTotalSets > 0,
      detailText: focusParts.join(' · '),
      ariaLabel: `Series: ${completedTotalSets} de ${setsTarget} series, ${setsPercent} por ciento`,
    };

    defaultDetailText = focusParts.join(' · ');
  } else if (Number(summary.distanceKm) > 0) {
    const distanceKm = Number(summary.distanceKm);
    const targetKm = CARDIO_DISTANCE_GOALS_KM[sport] ?? 5;
    const distanceRatio = distanceKm / targetKm;
    const distancePercent = Math.round(distanceRatio * 100);
    const paceLabel =
      durationMin > 0 ? `Ritmo ${formatPaceMinPerKm(durationMin / distanceKm)} /km` : sportLabel;

    focusRing = {
      id: 'focus',
      label: 'DISTANCIA',
      shortLabel: 'KM',
      valueDisplay: formatDistanceKm(distanceKm),
      goalDisplay: `/ ${targetKm} KM`,
      ratio: distanceRatio,
      percent: distancePercent,
      isClosed: distanceRatio >= 1,
      detailText: `${paceLabel} · ${sportLabel}`,
      ariaLabel: `Distancia: ${formatDistanceKm(distanceKm)} de ${targetKm} kilómetros, ${distancePercent} por ciento`,
    };

    defaultDetailText = `${paceLabel} · ~${kcalPerMin} kcal/min`;
  } else {
    const intensityPercent = Math.round(intensityInfo.ratio * 100);
    focusRing = {
      id: 'focus',
      label: 'INTENSIDAD',
      shortLabel: 'ESFUERZO',
      valueDisplay: intensityInfo.label,
      goalDisplay: `/ ${sportLabel.toUpperCase()}`,
      ratio: intensityInfo.ratio,
      percent: intensityPercent,
      isClosed: intensityInfo.ratio >= 1,
      detailText: `${sportLabel} · Esfuerzo ${intensityInfo.label.toLowerCase()}`,
      ariaLabel: `Intensidad: ${intensityInfo.label}, ${intensityPercent} por ciento`,
    };

    defaultDetailText = `${sportLabel} · ~${kcalPerMin} kcal/min`;
  }

  const rings: [WorkoutSummaryRingMetric, WorkoutSummaryRingMetric, WorkoutSummaryRingMetric] = [
    energyRing,
    timeRing,
    focusRing,
  ];
  const closedCount = rings.filter((r) => r.isClosed).length;
  const overallPercent = Math.round(
    (rings.reduce((acc, r) => acc + Math.min(1, Math.max(0, r.ratio)), 0) / rings.length) * 100
  );

  return {
    rings,
    closedCount,
    overallPercent,
    defaultDetailText,
  };
}

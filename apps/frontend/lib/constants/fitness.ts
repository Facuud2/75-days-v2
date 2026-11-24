import type { WorkoutRoutineRecord } from '@/lib/api/health';

export const BODY_ZONE_CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'chest', label: 'Pecho' },
  { key: 'back', label: 'Espalda' },
  { key: 'legs', label: 'Piernas' },
  { key: 'shoulders', label: 'Hombros' },
  { key: 'arms', label: 'Brazos' },
  { key: 'core', label: 'Core' },
  { key: 'cardio', label: 'Cardio' },
] as const;

export const EQUIPMENT_CHIPS = [
  { key: 'all', label: 'Todo equipo' },
  { key: 'none', label: 'Sin equipo' },
  { key: 'body only', label: 'Peso corporal' },
  { key: 'barbell', label: 'Barra' },
  { key: 'dumbbell', label: 'Mancuernas' },
  { key: 'cable', label: 'Polea' },
  { key: 'machine', label: 'Máquina' },
  { key: 'kettlebells', label: 'Kettlebell' },
  { key: 'bands', label: 'Bandas' },
] as const;

export const MUSCLE_LABELS_ES: Record<string, string> = {
  abdominals: 'Abdominales',
  abductors: 'Abductores',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Gemelos',
  chest: 'Pecho',
  forearms: 'Antebrazos',
  glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales',
  lats: 'Dorsales',
  'lower back': 'Espalda baja',
  'middle back': 'Espalda media',
  neck: 'Cuello',
  quadriceps: 'Cuádriceps',
  shoulders: 'Hombros',
  traps: 'Trapecios',
  triceps: 'Tríceps',
  strength: 'Fuerza',
  running: 'Running',
  cycling: 'Ciclismo',
  walking: 'Caminata',
  swimming: 'Natación',
  yoga: 'Yoga',
  other: 'Otro',
};

export const SPORT_LABELS_ES: Record<string, string> = {
  strength: 'Fuerza',
  running: 'Running',
  cycling: 'Ciclismo',
  walking: 'Caminata',
  swimming: 'Natación',
  yoga: 'Yoga',
  other: 'Otro',
};

export const STARTER_ROUTINES: WorkoutRoutineRecord[] = [
  {
    id: 'template-push',
    name: 'Empuje · Pecho, Hombro y Tríceps',
    description: 'Sesión clásica de empuje equilibrada para ~50 min.',
    sport: 'strength',
    exercises: [
      {
        exerciseId: 'Barbell_Bench_Press_-_Medium_Grip',
        exerciseName: 'Press de banca con barra',
        primaryMuscle: 'chest',
        equipment: 'barbell',
        order: 0,
        targetSets: 4,
        targetReps: '6-8',
        defaultRestSec: 120,
      },
      {
        exerciseId: 'Incline_Dumbbell_Press',
        exerciseName: 'Press inclinado con mancuernas',
        primaryMuscle: 'chest',
        equipment: 'dumbbell',
        order: 1,
        targetSets: 3,
        targetReps: '8-10',
        defaultRestSec: 90,
      },
      {
        exerciseId: 'Side_Lateral_Raise',
        exerciseName: 'Elevaciones laterales',
        primaryMuscle: 'shoulders',
        equipment: 'dumbbell',
        order: 2,
        targetSets: 4,
        targetReps: '12-15',
        defaultRestSec: 60,
      },
      {
        exerciseId: 'Triceps_Pushdown',
        exerciseName: 'Extensión de tríceps en polea',
        primaryMuscle: 'triceps',
        equipment: 'cable',
        order: 3,
        targetSets: 3,
        targetReps: '10-12',
        defaultRestSec: 60,
      },
    ],
  },
  {
    id: 'template-pull',
    name: 'Tirón · Espalda y Bíceps',
    description: 'Dorsales, densidad de espalda y trabajo directo de bíceps.',
    sport: 'strength',
    exercises: [
      {
        exerciseId: 'Wide-Grip_Lat_Pulldown',
        exerciseName: 'Jalón al pecho agarre ancho',
        primaryMuscle: 'lats',
        equipment: 'cable',
        order: 0,
        targetSets: 4,
        targetReps: '8-10',
        defaultRestSec: 90,
      },
      {
        exerciseId: 'Seated_Cable_Rows',
        exerciseName: 'Remo sentado en polea',
        primaryMuscle: 'middle back',
        equipment: 'cable',
        order: 1,
        targetSets: 3,
        targetReps: '10-12',
        defaultRestSec: 90,
      },
      {
        exerciseId: 'Face_Pull',
        exerciseName: 'Face Pull en polea',
        primaryMuscle: 'shoulders',
        equipment: 'cable',
        order: 2,
        targetSets: 3,
        targetReps: '12-15',
        defaultRestSec: 60,
      },
      {
        exerciseId: 'Barbell_Curl',
        exerciseName: 'Curl de bíceps con barra',
        primaryMuscle: 'biceps',
        equipment: 'barbell',
        order: 3,
        targetSets: 3,
        targetReps: '10-12',
        defaultRestSec: 60,
      },
    ],
  },
  {
    id: 'template-legs',
    name: 'Pierna Completa + Core',
    description: 'Cuádriceps, cadena posterior y estabilidad de core.',
    sport: 'strength',
    exercises: [
      {
        exerciseId: 'Barbell_Squat',
        exerciseName: 'Sentadilla con barra',
        primaryMuscle: 'quadriceps',
        equipment: 'barbell',
        order: 0,
        targetSets: 4,
        targetReps: '6-8',
        defaultRestSec: 150,
      },
      {
        exerciseId: 'Romanian_Deadlift',
        exerciseName: 'Peso muerto rumano',
        primaryMuscle: 'hamstrings',
        equipment: 'barbell',
        order: 1,
        targetSets: 3,
        targetReps: '8-10',
        defaultRestSec: 120,
      },
      {
        exerciseId: 'Leg_Press',
        exerciseName: 'Prensa de piernas',
        primaryMuscle: 'quadriceps',
        equipment: 'machine',
        order: 2,
        targetSets: 3,
        targetReps: '10-12',
        defaultRestSec: 90,
      },
      {
        exerciseId: 'Plank',
        exerciseName: 'Plancha abdominal',
        primaryMuscle: 'abdominals',
        equipment: 'body only',
        order: 3,
        targetSets: 3,
        targetReps: '45-60s',
        defaultRestSec: 60,
      },
    ],
  },
];

export function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatMuscleLabel(muscle?: string | null): string {
  if (!muscle) return 'General';
  return MUSCLE_LABELS_ES[muscle.toLowerCase()] || muscle;
}

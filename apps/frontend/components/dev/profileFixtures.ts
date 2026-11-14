import type {
  ChallengeSummary,
  HealthSummary,
  ProfileAchievement,
  QuestSummary,
} from '@/components/profile/types';

/**
 * Fixtures de break-ui para el perfil. Mismo shape que los datos que arma
 * `app/profile/page.tsx` a partir del store y de la API, así que los
 * componentes de perfil no saben de dónde vienen.
 *
 * Valores plausibles o el límite real: un nombre de 55 caracteres, un avatar
 * inexistente, un email largo dentro de una misión, el conteo exactamente 1
 * para cazar plurales, y una lista de 1.000 para medir el render.
 */
export type DevDataset = 'demo' | 'worst' | 'empty' | 'one' | 'thousand';

const LONG_QUEST =
  'Completar bartholomew.fitzgerald@northwind-industries-holdings.example.com antes de las 21:00 y registrar cada vaso de agua en la aplicación';

export const DEV_PROFILE_NAME = 'Alejandra María de los Ángeles Wiśniewska-Kowalczyk';

function makeQuest(index: number): QuestSummary {
  return {
    id: `dev-quest-${index + 1}`,
    title: index === 0 ? LONG_QUEST : `Leer 20 páginas antes de dormir (${index + 1})`,
    description: 'Misión secundaria para sostener el hábito sin competir con el reto principal.',
    difficulty: ['Easy', 'Medium', 'Hard'][index % 3],
    durationDays: [7, 14, 21, 30][index % 4],
    icon: ['droplet', 'book', 'footprints', 'dumbbell'][index % 4],
    progress: index === 1 ? 1284 : index % 9,
    completed: false,
    completionCount: index === 1 ? 1 : 0,
  };
}

export function buildDevProfileData(
  dataset: DevDataset,
  base: {
    challenge: ChallengeSummary;
    health: HealthSummary;
    achievements: ProfileAchievement[];
  },
): { challenge: ChallengeSummary; health: HealthSummary; achievements: ProfileAchievement[] } {
  if (dataset === 'demo') return base;

  if (dataset === 'empty') {
    return {
      challenge: {
        isActive: false,
        difficulty: null,
        currentDay: 0,
        streak: 0,
        challengesCompleted: 0,
        todayGoals: [],
        activeQuests: [],
        completedQuestsCount: 0,
      },
      health: {
        currentWeight: null,
        initialWeight: null,
        goalWeight: null,
        weightLost: null,
        toGoal: null,
        bmi: null,
        bmiLabel: 'Sin datos',
        weightHistory: [],
        nutrition: null,
        workouts: [],
        isStravaConnected: false,
        todayWorkoutMinutes: null,
      },
      achievements: [],
    };
  }

  if (dataset === 'one') {
    return {
      challenge: {
        ...base.challenge,
        currentDay: 1,
        streak: 1,
        challengesCompleted: 1,
        todayGoals: base.challenge.todayGoals.slice(0, 1).length
          ? base.challenge.todayGoals.slice(0, 1)
          : [{ id: 'dev-goal-1', title: 'Leer 20 páginas', completed: false, icon: 'book' }],
        activeQuests: [makeQuest(0)],
        completedQuestsCount: 1,
      },
      health: {
        ...base.health,
        workouts: base.health.workouts.slice(0, 1),
        todayWorkoutMinutes: base.health.todayWorkoutMinutes === null ? 1 : base.health.todayWorkoutMinutes,
      },
      achievements: base.achievements.slice(0, 1),
    };
  }

  if (dataset === 'thousand') {
    return {
      challenge: {
        ...base.challenge,
        activeQuests: Array.from({ length: 1000 }, (_, index) => makeQuest(index)),
      },
      health: {
        ...base.health,
        workouts: Array.from({ length: 1000 }, (_, index) => ({
          id: `dev-workout-${index + 1}`,
          sport: ['Running', 'Fuerza', 'Natación', 'Ciclismo'][index % 4],
          notes: index === 0 ? 'Nota con una longitud realista que no debería romper la fila' : null,
          durationMin: 45 + index,
          caloriesBurned: 320 + index,
          distanceKm: index % 2 === 0 ? 5.2 : null,
        })),
        weightHistory: Array.from({ length: 365 }, (_, index) => ({
          date: new Date(2025, 0, 1 + index).toISOString().slice(0, 10),
          weight: Number((92 - index * 0.05).toFixed(2)),
        })),
      },
      achievements: Array.from({ length: 240 }, (_, index) => ({
        ...(base.achievements[index % Math.max(1, base.achievements.length)] ?? {
          id: 'dev',
          title: 'Primer Paso',
          description: 'Completar el primer día de un desafío.',
          unlocked: true,
          unlockedAt: null,
          progress: 1,
          total: 1,
        }),
        id: `dev-achievement-${index + 1}`,
        title: `Logro #${index + 1}`,
      })),
    };
  }

  // worst case
  return {
    challenge: {
      ...base.challenge,
      isActive: true,
      difficulty: 'Custom',
      currentDay: 74,
      streak: 1284,
      challengesCompleted: 1284,
      todayGoals: [
        { id: 'dev-goal-long', title: 'Beber 3,5 litros de agua antes de las 21:00 y registrar cada vaso en la aplicación', completed: true, icon: 'droplet' },
        { id: 'dev-goal-script', title: '<script>alert(1)</script>', completed: false, icon: 'book' },
        { id: 'dev-goal-emoji', title: '🦊 Meditar 10 minutos', completed: false, icon: 'sun' },
        { id: 'dev-goal-rtl', title: 'نور الهدى عبد الرحمن تسجيل البيانات', completed: true, icon: 'target' },
      ],
      activeQuests: [makeQuest(0), makeQuest(1)],
      completedQuestsCount: 1,
    },
    health: {
      ...base.health,
      currentWeight: 128.45,
      initialWeight: 132.8,
      goalWeight: 78,
      weightLost: 4.35,
      toGoal: 50.45,
      bmi: 45.5,
      bmiLabel: 'Obesidad',
      workouts: [
        {
          id: 'dev-workout-long',
          sport: 'Entrenamiento de fuerza con barra y mancuernas',
          notes: 'Nota extremadamente larga sobre la sesión de hoy que debería truncarse sin empujar el resto de la fila del historial',
          durationMin: 1284,
          caloriesBurned: 12840,
          distanceKm: null,
        },
        { id: 'dev-workout-null', sport: 'Natación', notes: null, durationMin: null, caloriesBurned: null, distanceKm: null },
      ],
      nutrition: base.health.nutrition
        ? {
            ...base.health.nutrition,
            consumed: 12345,
            meals: [
              {
                id: 'dev-meal-long',
                mealType: 'breakfast',
                name: 'Avena con frutos rojos, semillas de chía y un nombre que sigue creciendo hasta pasarse de la fila',
                calories: 1284,
                proteinG: 28,
                carbG: 48,
                fatG: 14,
              },
              ...base.health.nutrition.meals,
            ],
          }
        : null,
      todayWorkoutMinutes: 1284,
    },
    achievements: base.achievements.map((achievement, index) => ({
      ...achievement,
      title: index === 0
        ? 'Transformación física sostenida durante setenta y cinco días consecutivos sin fallar'
        : achievement.title,
    })),
  };
}

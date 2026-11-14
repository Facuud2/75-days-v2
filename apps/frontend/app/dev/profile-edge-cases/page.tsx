'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileSection from '@/components/profile/ProfileSection';
import ProfileChallenges from '@/components/profile/ProfileChallenges';
import ProfileHealth from '@/components/profile/ProfileHealth';
import ProfileAchievements from '@/components/profile/ProfileAchievements';
import ActivitiesSheet from '@/components/profile/ActivitiesSheet';
import AchievementsSheet from '@/components/profile/AchievementsSheet';
import ProfileEditMenu from '@/components/profile/ProfileEditMenu';
import type {
  ChallengeSummary,
  HealthSummary,
  ProfileAchievement,
  QuestSummary,
} from '@/components/profile/types';
import type { DatasetOption } from '@/components/dev/DatasetToggle';

// El toggle es chrome de desarrollo: se carga sólo en cliente para que nunca
// forme parte del bundle de una ruta de producción.
const DatasetToggle = dynamic(() => import('@/components/dev/DatasetToggle'), { ssr: false });

type Dataset = 'demo' | 'worst' | 'empty' | 'one' | 'many';

const DATASETS: DatasetOption[] = [
  { value: 'demo', label: 'Demo data' },
  { value: 'worst', label: 'Worst case (plausible extremes)' },
  { value: 'empty', label: 'Empty / no results' },
  { value: 'one', label: 'Just one row' },
  { value: 'many', label: '1,000 rows (performance stress)' },
];

const QUEST_TITLES = [
  'Beber 3,5 litros de agua al día',
  'Leer 20 páginas antes de dormir',
  'Caminar 10.000 pasos',
  'Entrenar fuerza 4 veces por semana',
  'Meditar 10 minutos',
  'Escribir un diario de gratitud',
  'Estirar 15 minutos',
  'Dormir 8 horas',
];

const LONG_QUEST =
  'Completar bartholomew.fitzgerald@northwind-industries-holdings.example.com antes de las 21:00 y registrar cada vaso de agua en la aplicación';

const MEAL_NAMES = [
  'Avena con frutos rojos y semillas de chía',
  'Pechuga de pollo con arroz integral y brócoli al vapor',
  'Yogur griego con granola y miel',
  'Tostadas integrales con palta y huevo poché',
];

const WORKOUT_NOTES = [
  'Entrenamiento de fuerza · tren superior',
  'Carrera suave por el parque',
  'Natación · 40 minutos de técnica',
  'Movilidad y estiramientos',
];

function makeQuests(count: number, completed = false): QuestSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `quest-${index + 1}`,
    title:
      index === 0 && count > 10
        ? LONG_QUEST
        : `${QUEST_TITLES[index % QUEST_TITLES.length]}${count > 20 ? ` #${index + 1}` : ''}`,
    description:
      index === 0 && count > 10
        ? 'Una actividad con un título larguísimo y una descripción que también se extiende para comprobar cómo se comporta el truncado en una fila estrecha.'
        : 'Misión secundaria para sostener el hábito sin competir con el reto principal.',
    difficulty: ['Easy', 'Medium', 'Hard'][index % 3],
    durationDays: index === 1 && count > 10 ? 365 : [7, 14, 21, 30][index % 4],
    icon: ['droplet', 'book', 'footprints', 'dumbbell'][index % 4],
    progress: completed ? [7, 14, 21, 30][index % 4] : index === 1 && count > 10 ? 1284 : index % 9,
    completed,
    completionCount: completed ? (index === 2 ? 1284 : 1) : 0,
  }));
}

function makeAchievements(count: number, unlockedCount: number): ProfileAchievement[] {
  const base = [
    {
      title: 'Primer Paso',
      description: 'Completar el primer día de un desafío.',
      total: 1,
    },
    {
      title: 'Constancia',
      description: 'Alcanzar una racha de 7 días.',
      total: 7,
    },
    {
      title: 'Disciplina',
      description: 'Completar un desafío de 75 días.',
      total: 1,
    },
    {
      title: 'Fuerza de Voluntad',
      description: 'Registrar el peso durante 10 días.',
      total: 10,
    },
    {
      title: 'Aventurero',
      description: 'Completar tu primera misión secundaria.',
      total: 1,
    },
    {
      title: 'Transformación',
      description: 'Perder tus primeros 5 kg.',
      total: 5,
    },
  ];

  return Array.from({ length: count }, (_, index) => {
    const template = base[index % base.length];
    const unlocked = index < unlockedCount;
    const progress = unlocked ? template.total : (index * 37) % (template.total + 1);

    return {
      id: index === 1 && count > 20 ? 'unknown-id' : String(index + 1),
      title:
        index === 0 && count > 20
          ? 'Transformación física sostenida durante setenta y cinco días consecutivos sin fallar'
          : `${template.title}${count > 20 ? ` #${index + 1}` : ''}`,
      description:
        index === 0 && count > 20
          ? 'Desbloqueado al completar un ciclo completo de setenta y cinco días, incluyendo los días de descanso planificados y las semanas de viaje.'
          : template.description,
      icon: '🏆',
      color: 'bg-yellow-500/20 text-yellow-500',
      unlocked,
      unlockedAt:
        unlocked
          ? index === 2 && count > 20
            ? 'not-a-date'
            : new Date(2026, index % 12, (index % 27) + 1).toISOString()
          : null,
      progress,
      total: index === 3 && count > 20 ? 0 : template.total,
    };
  });
}

function makeWeightHistory(count: number, start: number, end: number) {
  return Array.from({ length: count }, (_, index) => {
    const ratio = count <= 1 ? 0 : index / (count - 1);
    const weight = start + (end - start) * ratio + Math.sin(index / 3) * 0.35;
    const date = new Date(2025, 0, 1 + index);
    return {
      date: date.toISOString().slice(0, 10),
      weight: Number(weight.toFixed(2)),
    };
  });
}

function makeNutrition(scale: 'normal' | 'worst' | 'one') {
  const multiplier = scale === 'worst' ? 6 : scale === 'one' ? 0.001 : 1;
  return {
    consumed: Math.round(1840 * multiplier),
    dailyGoal: scale === 'one' ? 1 : 2000,
    remainingToGoal: Math.round(160 * multiplier),
    macros: {
      proteinG: Math.round(120 * multiplier),
      carbG: Math.round(210 * multiplier),
      fatG: Math.round(60 * multiplier),
      goals: {
        proteinG: 150,
        carbG: 250,
        fatG: 70,
      },
    },
    meals: Array.from({ length: scale === 'worst' ? 12 : scale === 'one' ? 1 : 2 }, (_, index) => ({
      id: `meal-${index + 1}`,
      mealType: ['breakfast', 'lunch', 'dinner', 'snack'][index % 4],
      name: index === 0 && scale === 'worst' ? `${MEAL_NAMES[0]} con un nombre que no termina nunca y sigue creciendo` : MEAL_NAMES[index % MEAL_NAMES.length],
      calories: Math.round(420 * multiplier) + index,
      proteinG: Math.round(28 * multiplier),
      carbG: Math.round(48 * multiplier),
      fatG: Math.round(14 * multiplier),
    })),
  };
}

function makeHealth(dataset: Dataset): HealthSummary {
  if (dataset === 'empty') {
    return {
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
    };
  }

  const isWorst = dataset === 'worst';
  const isOne = dataset === 'one';
  const isMany = dataset === 'many';

  return {
    currentWeight: isWorst ? 128.45 : isOne ? 80 : 72.4,
    initialWeight: isWorst ? 132.8 : isOne ? 80 : 75.6,
    goalWeight: isWorst ? 78 : isOne ? 80 : 68,
    weightLost: isWorst ? 4.35 : isOne ? 0 : 3.2,
    toGoal: isWorst ? 50.45 : isOne ? 0 : 4.4,
    bmi: isWorst ? 45.5 : isOne ? 24.2 : 24.1,
    bmiLabel: isWorst ? 'Obesidad' : 'Normal',
    weightHistory: makeWeightHistory(isMany ? 365 : isWorst ? 60 : isOne ? 1 : 12, isWorst ? 132.8 : 80, isWorst ? 124.4 : 72.4),
    nutrition: makeNutrition(isWorst ? 'worst' : isOne ? 'one' : 'normal'),
    workouts: Array.from({ length: isWorst ? 12 : isOne ? 1 : isMany ? 200 : 2 }, (_, index) => ({
      id: `workout-${index + 1}`,
      sport: ['Running', 'Fuerza', 'Natación', 'Ciclismo'][index % 4],
      notes: index === 0 && isWorst ? `${WORKOUT_NOTES[0]} con una nota extremadamente larga que debería truncarse sin empujar el resto de la fila` : WORKOUT_NOTES[index % WORKOUT_NOTES.length],
      durationMin: isWorst ? 1284 : 45 + index,
      caloriesBurned: isWorst ? 12840 : 320 + index * 12,
      distanceKm: index % 2 === 0 ? (isWorst ? 1284.5 : 5.2 + index) : null,
    })),
    isStravaConnected: !isWorst,
    todayWorkoutMinutes: isWorst ? 1284 : isOne ? 1 : 45,
  };
}

function makeChallenge(dataset: Dataset): ChallengeSummary {
  if (dataset === 'empty') {
    return {
      isActive: false,
      difficulty: null,
      currentDay: 0,
      streak: 0,
      challengesCompleted: 0,
      todayGoals: [],
      activeQuests: [],
      completedQuestsCount: 0,
    };
  }

  const isWorst = dataset === 'worst';
  const isOne = dataset === 'one';
  const isMany = dataset === 'many';

  return {
    isActive: true,
    difficulty: isWorst ? 'Custom' : isOne ? 'Soft' : 'Hard',
    currentDay: isWorst ? 74 : isOne ? 1 : 42,
    streak: isWorst ? 1284 : isOne ? 1 : 12,
    challengesCompleted: isWorst ? 1284 : isOne ? 1 : 3,
    todayGoals: Array.from({ length: isWorst ? 12 : isOne ? 1 : 6 }, (_, index) => ({
      id: `goal-${index + 1}`,
      title:
        index === 0 && isWorst
          ? 'Beber 3,5 litros de agua antes de las 21:00 y registrar cada vaso en la aplicación'
          : ['Beber 3 litros de agua', 'Leer 20 páginas', 'Caminar 10.000 pasos', 'Entrenar 45 minutos', 'Meditar 10 minutos', 'Dormir 8 horas'][index % 6],
      completed: index % 2 === 0,
      icon: ['droplet', 'book', 'footprints', 'dumbbell'][index % 4],
    })),
    activeQuests: makeQuests(isWorst ? 5 : isOne ? 1 : isMany ? 40 : 3),
    completedQuestsCount: isWorst ? 1284 : isOne ? 1 : 2,
  };
}

function makeProfile(dataset: Dataset) {
  if (dataset === 'empty') {
    return {
      name: '',
      avatarUrl: null,
      level: 1,
      memberSince: null,
      quote: null,
    };
  }

  if (dataset === 'one') {
    return {
      name: 'Jo',
      avatarUrl: null,
      level: 1,
      memberSince: null,
      quote: null,
    };
  }

  if (dataset === 'worst') {
    return {
      name: 'Alejandra María de los Ángeles Wiśniewska-Kowalczyk',
      avatarUrl: null,
      level: 128,
      memberSince: 'sept 2019',
      quote:
        'La constancia no se trata de no fallar nunca, se trata de volver al día siguiente incluso cuando el día anterior fue un desastre absoluto y las circunstancias no acompañan.',
    };
  }

  return {
    name: 'Ana García',
    avatarUrl: null,
    level: 6,
    memberSince: 'mar 2026',
    quote: 'Tu constancia también merece un lugar visible.',
  };
}

export default function ProfileEdgeCasesPage() {
  const [dataset, setDataset] = useState<Dataset>(() => {
    if (typeof window === 'undefined') return 'demo';
    const value = new URLSearchParams(window.location.search).get('data');
    return DATASETS.some((item) => item.value === value) ? (value as Dataset) : 'demo';
  });

  const selectDataset = (next: string) => {
    if (!DATASETS.some((option) => option.value === next)) return;
    const value = next as Dataset;
    setDataset(value);
    const url = new URL(window.location.href);
    url.searchParams.set('data', value);
    window.history.replaceState({}, document.title, url.toString());
  };

  const profile = useMemo(() => makeProfile(dataset), [dataset]);
  const challenge = useMemo(() => makeChallenge(dataset), [dataset]);
  const health = useMemo(() => makeHealth(dataset), [dataset]);
  const achievements = useMemo(
    () =>
      makeAchievements(
        dataset === 'empty' ? 0 : dataset === 'one' ? 1 : dataset === 'many' ? 240 : dataset === 'worst' ? 120 : 12,
        dataset === 'empty' ? 0 : dataset === 'one' ? 1 : dataset === 'many' ? 120 : dataset === 'worst' ? 37 : 4,
      ),
    [dataset],
  );

  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const retosSummary = challenge.isActive ? `Día ${challenge.currentDay}/75` : 'Sin reto activo';
  const saludSummary = [
    health.currentWeight !== null ? `${health.currentWeight} kg` : null,
    health.nutrition ? `${health.nutrition.consumed} kcal` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const logrosSummary = `${unlockedCount}/${achievements.length}`;

  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isActivitiesOpen, setIsActivitiesOpen] = useState(false);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);

  // Sólo existe en `next dev`; el build de producción sirve una página vacía.
  if (process.env.NODE_ENV !== 'development') {
    return <main className="p-8">Not available outside development.</main>;
  }

  return (
    <div className="pv2-page mx-auto w-full max-w-6xl px-4 pb-32 pt-4">
      <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        Laboratorio de datos · perfil v2 ·{' '}
        <span className="pv2-mono" style={{ color: 'var(--text-secondary)' }}>
          /dev/profile-edge-cases?data={dataset}
        </span>
      </p>

      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ProfileHeader
            name={profile.name}
            avatarUrl={profile.avatarUrl}
            level={profile.level}
            memberSince={profile.memberSince}
            quote={profile.quote}
            onEdit={() => setIsEditMenuOpen(true)}
            onAvatar={() => {}}
          />
        </aside>

        <div className="mt-3 space-y-3 lg:mt-0">
          <ProfileSection id="retos" index="01" title="Retos" summary={retosSummary} defaultOpen>
            <ProfileChallenges
              data={challenge}
              onContinue={() => {}}
              onStartChallenge={() => {}}
              onDiscoverActivities={() => setIsActivitiesOpen(true)}
              onOpenQuest={() => {}}
            />
          </ProfileSection>

          <ProfileSection id="salud" index="02" title="Salud" summary={saludSummary || 'Sin datos'} defaultOpen>
            <ProfileHealth
              data={health}
              onLogMeal={() => {}}
              onEditMeal={() => {}}
              onLogWorkout={() => {}}
              onEditWorkout={() => {}}
              onConnectStrava={() => {}}
              onSyncStrava={() => {}}
            />
          </ProfileSection>

          <ProfileSection id="logros" index="03" title="Logros" summary={achievements.length > 0 ? `${logrosSummary} desbloqueados` : 'Sin logros'} defaultOpen>
            <ProfileAchievements achievements={achievements} onOpenAll={() => setIsAchievementsOpen(true)} />
          </ProfileSection>
        </div>
      </div>

      <ActivitiesSheet
        open={isActivitiesOpen}
        onClose={() => setIsActivitiesOpen(false)}
        activeQuests={challenge.activeQuests}
        completedQuests={[]}
        availableQuests={[]}
        onSubscribe={() => {}}
        subscribingTo={null}
        onOpenQuest={() => {}}
        onCreateCustom={() => {}}
      />

      <AchievementsSheet
        open={isAchievementsOpen}
        onClose={() => setIsAchievementsOpen(false)}
        achievements={achievements}
      />

      <ProfileEditMenu
        open={isEditMenuOpen}
        onClose={() => setIsEditMenuOpen(false)}
        onSelect={() => setIsEditMenuOpen(false)}
      />

      <DatasetToggle selected={dataset} options={DATASETS} onSelect={selectDataset} />
    </div>
  );
}

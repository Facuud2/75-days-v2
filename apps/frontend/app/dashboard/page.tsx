'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useUIStore } from '@/store/useUIStore';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Check,
  Utensils,
  Dumbbell,
  Sun,
  Droplet,
  Book,
  Camera,
  Target,
  PlusCircle,
  Trophy,
  Brain,
  HeartPulse,
  CalendarRange,
  CalendarClock,
  Minus,
  Plus,
  Scale,
  Share2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEFAULT_GOALS } from '@/lib/constants/plans';
import { syncCoreStores } from '@/lib/api/sync';
import { isTutorialPending, markTutorialSeen } from '@/lib/tutorial';
import type { DevDataset } from '@/components/dev/DevDatasetPicker';
import { DEV_DATASETS } from '@/components/dev/DevDatasetPicker';
import type { ShareCardKind } from '@/lib/utils/shareCardData';
import DashboardLoading from './loading';

// Lazy-loaded modals for dashboard (vercel-react-best-practices: bundle-dynamic-imports)
const SideQuestsModal = dynamic(() => import('@/components/SideQuestsModal'), { ssr: false });
const SideQuestDetailModal = dynamic(() => import('@/components/SideQuestDetailModal'), { ssr: false });
const OnboardingTutorial = dynamic(() => import('@/components/OnboardingTutorial'), { ssr: false });
const ShareProgressModal = dynamic(() => import('@/components/ShareProgressModal'), { ssr: false });

type TabView = 'plan' | 'missions';

/**
 * Sólo dev: alterna los fixtures de break-ui sobre este mismo dashboard.
 * `next dev` lo carga en un chunk aparte; en producción el JSX de abajo no se
 * renderiza y el chunk no se referencia en el HTML servido.
 */
const DevDatasetPicker = dynamic(
  () => import('@/components/dev/DevDatasetPicker'),
  { ssr: false }
);

const IS_DEV_BUILD = process.env.NODE_ENV === 'development';

const iconMap: Record<string, any> = {
  utensils: Utensils,
  dumbbell: Dumbbell,
  sun: Sun,
  droplet: Droplet,
  book: Book,
  camera: Camera,
  brain: Brain,
  heart: HeartPulse,
  target: Target,
};

function getSmartStep(measurementType: string | undefined, targetValue: number): number {
  if (measurementType === 'count') return 1;
  if (targetValue <= 2) return 0.25;
  if (targetValue <= 5) return 0.5;
  if (targetValue <= 25) return 1;
  if (targetValue <= 100) return 5;
  return 10;
}

function formatMetricReadout(
  currentValue: number,
  targetValue: number,
  unit?: string | null
): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
  const suffix = unit?.trim() ? ` ${unit.trim()}` : '';
  return `${fmt(currentValue)} / ${fmt(targetValue)}${suffix}`;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const {
    isActive,
    currentDay,
    logs,
    periodGoals,
    startDate,
    customGoalsTemplate,
    logDailyGoal,
    logDailyGoalProgress,
    logPeriodGoalProgress,
    fetchCurrentChallenge,
    checkDailyReset,
    isLoading: isChallengeLoading
  } = useChallengeStore();
  const { quests, fetchQuests, fetchAvailableQuests, isLoading: isQuestsLoading } = useQuestStore();
  const { openPlansModal, openLogWeightModal, isTutorialOpen, openTutorial, closeTutorial } = useUIStore();

  const router = useRouter();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLog = useMemo(
    () =>
      logs[todayStr] ??
      (isActive && customGoalsTemplate?.length > 0
        ? {
            date: todayStr,
            status: 'pending' as const,
            goals: customGoalsTemplate
              .filter((g) => (g.cadence || 'daily') === 'daily')
              .map((g, idx) => ({
                ...g,
                id: `template-${idx}`,
                completed: false,
                currentValue: 0,
              })),
          }
        : undefined),
    [logs, todayStr, isActive, customGoalsTemplate]
  );
  const [isSideQuestsModalOpen, setIsSideQuestsModalOpen] = useState(false);
  const [selectedSideQuest, setSelectedSideQuest] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabView>('plan');
  const [shareModal, setShareModal] = useState<{ open: boolean; initialKind: ShareCardKind }>({
    open: false,
    initialKind: 'daily',
  });

  // ── break-ui · dataset del laboratorio (sólo dev) ──────────────────────────
  // El estado por defecto deja la página exactamente como se diseñó; los demás
  // datasets sólo reemplazan los valores derivados del challenge y las quests.
  const [devDataset, setDevDataset] = useState<DevDataset>(() => {
    if (!IS_DEV_BUILD || typeof window === 'undefined') return 'demo';
    const value = new URLSearchParams(window.location.search).get('data') as DevDataset | null;
    return value && DEV_DATASETS.includes(value) ? value : 'demo';
  });

  const hasCheckedReset = React.useRef(false);

  useEffect(() => {
    if (hasCheckedReset.current || !user) return;
    hasCheckedReset.current = true;

    // Fase 2 (Patrón /api/sync de appManifestV2): sincroniza reto + daily reset + misiones en 1 round-trip
    (async () => {
      await syncCoreStores({ includeProfile: false });
      const current = useChallengeStore.getState();
      if (!current.isActive) {
        if (user.onboardingCompleted !== true) router.push('/onboarding');
      }
    })();
  }, [user, router]);

  useEffect(() => {
    if (!isChallengeLoading && isActive && todayLog && user?.id && isTutorialPending(user.id)) {
      openTutorial();
    }
  }, [isChallengeLoading, isActive, todayLog, user?.id, openTutorial]);

  const handleDismissTutorial = useCallback(() => {
    markTutorialSeen(user?.id);
    closeTutorial();
  }, [user?.id, closeTutorial]);

  const renderGoalItem = useCallback((goal: any) => {
    const IconComponent = iconMap[goal.icon || 'target'] || Target;
    const measurementType = goal.measurementType || 'boolean';
    const targetValue = typeof goal.targetValue === 'number' && goal.targetValue > 0 ? goal.targetValue : 1;
    const currentValue =
      typeof goal.currentValue === 'number'
        ? goal.currentValue
        : goal.completed
          ? targetValue
          : 0;
    const isQuantified = measurementType !== 'boolean';
    const pct = Math.min(100, Math.round((currentValue / targetValue) * 100));
    const step = getSmartStep(measurementType, targetValue);
    const isTemplatePlaceholder = String(goal.id).startsWith('template-');

    const handleToggle = () => {
      if (isTemplatePlaceholder) return;
      void logDailyGoal(todayStr, goal.id, !goal.completed).catch(() => {});
    };

    const handleDelta = (e: React.MouseEvent, delta: number) => {
      e.stopPropagation();
      if (isTemplatePlaceholder) return;
      void logDailyGoalProgress(todayStr, goal.id, { delta }).catch(() => {});
    };

    return (
      <div
        key={goal.id}
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        aria-pressed={goal.completed}
        className={`group cursor-pointer w-full text-left bg-rose-950/20 border rounded-2xl px-3.5 py-3 sm:p-5 flex flex-col gap-3 transition-all duration-200 min-h-14 ${goal.completed
          ? 'border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50 hover:bg-rose-500/10'
          : 'border-[#361726] hover:border-rose-500/50 hover:bg-rose-950/40'
          }`}
      >
        <div className="flex items-center gap-3 sm:gap-5">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${goal.completed
            ? 'bg-rose-500/20 text-rose-500'
            : 'bg-rose-950/60 text-rose-500/70 group-hover:text-rose-500'
            }`}>
            <IconComponent size={20} strokeWidth={1.5} className="sm:w-6 sm:h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-base sm:text-lg ${goal.description ? 'mb-0.5 sm:mb-1' : ''} transition-colors ${goal.completed ? 'text-white/70 line-through' : 'text-white'}`}>
              {goal.title}
            </h3>
            {goal.description ? (
              <p className={`text-sm transition-colors ${goal.completed ? 'text-white/50' : 'text-white/60'}`}>
                {goal.description}
              </p>
            ) : null}
          </div>

          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 group-active:scale-90 ${goal.completed
            ? 'bg-rose-500 border-rose-500 shadow-[0_0_15px_var(--color-rose-500)] group-hover:bg-rose-400 group-hover:border-rose-400'
            : 'border-rose-950/40 group-hover:border-rose-500/50'
            }`}>
            {goal.completed && <Check size={16} className="text-white" strokeWidth={3} />}
          </div>
        </div>

        {isQuantified && (
          <div className="flex items-center gap-3 pl-0 sm:pl-[68px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium tabular-nums">
                <span className={goal.completed ? 'text-emerald-400 font-semibold' : 'text-white/75'}>
                  {formatMetricReadout(currentValue, targetValue, goal.targetUnit)}
                </span>
                <span className="text-white/45">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${goal.completed ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => handleDelta(e, -step)}
                disabled={currentValue <= 0}
                aria-label={`Restar ${step} a ${goal.title}`}
                className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-white transition-transform active:scale-90 cursor-pointer"
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelta(e, step)}
                aria-label={`Sumar ${step} a ${goal.title}`}
                className="h-8 w-8 rounded-lg border border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 flex items-center justify-center text-rose-300 transition-transform active:scale-90 cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }, [todayStr, logDailyGoal, logDailyGoalProgress]);

  const renderPeriodGoalItem = useCallback((pg: any) => {
    const IconComponent = iconMap[pg.icon || 'target'] || Target;
    const isCompleted = pg.status === 'success';
    const isFailed = pg.status === 'fail';
    const targetValue = typeof pg.targetValue === 'number' && pg.targetValue > 0 ? pg.targetValue : 1;
    const currentValue = typeof pg.currentValue === 'number' ? pg.currentValue : 0;
    const pct = Math.min(100, Math.round((currentValue / targetValue) * 100));
    const step = getSmartStep(pg.measurementType, targetValue);

    const handleToggle = () => {
      if (isFailed) return;
      void logPeriodGoalProgress(pg.id, { completed: !isCompleted }).catch(() => {});
    };

    const handleDelta = (e: React.MouseEvent, delta: number) => {
      e.stopPropagation();
      if (isFailed) return;
      void logPeriodGoalProgress(pg.id, { delta }).catch(() => {});
    };

    const accentBorder =
      pg.cadence === 'monthly'
        ? isCompleted
          ? 'border-violet-400/40 bg-violet-500/10'
          : 'border-violet-500/25 hover:border-violet-400/50 bg-violet-950/15'
        : isCompleted
          ? 'border-sky-400/40 bg-sky-500/10'
          : 'border-sky-500/25 hover:border-sky-400/50 bg-sky-950/15';

    const accentBar =
      isCompleted
        ? 'bg-emerald-500'
        : pg.cadence === 'monthly'
          ? 'bg-violet-400'
          : 'bg-sky-400';

    return (
      <div
        key={pg.id}
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        aria-pressed={isCompleted}
        className={`group cursor-pointer w-full text-left border rounded-2xl px-3.5 py-3 sm:p-5 flex flex-col gap-3 transition-all duration-200 ${accentBorder}`}
      >
        <div className="flex items-center gap-3 sm:gap-5">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isCompleted
            ? 'bg-emerald-500/20 text-emerald-400'
            : pg.cadence === 'monthly'
              ? 'bg-violet-500/15 text-violet-300'
              : 'bg-sky-500/15 text-sky-300'
            }`}>
            <IconComponent size={20} strokeWidth={1.5} className="sm:w-6 sm:h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold text-base sm:text-lg transition-colors ${isCompleted ? 'text-white/75 line-through' : 'text-white'}`}>
                {pg.title}
              </h3>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${pg.cadence === 'monthly' ? 'bg-violet-500/20 text-violet-300' : 'bg-sky-500/20 text-sky-300'}`}>
                {pg.cadence === 'monthly' ? `Mes ${pg.periodNumber}` : `Sem ${pg.periodNumber}`}
              </span>
            </div>
            {pg.description ? (
              <p className={`text-sm mt-0.5 transition-colors ${isCompleted ? 'text-white/50' : 'text-white/60'}`}>
                {pg.description}
              </p>
            ) : null}
          </div>

          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 group-active:scale-90 ${isCompleted
            ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.45)]'
            : 'border-white/20 group-hover:border-white/50'
            }`}>
            {isCompleted && <Check size={16} className="text-white" strokeWidth={3} />}
          </div>
        </div>

        {pg.measurementType !== 'boolean' && (
          <div className="flex items-center gap-3 pl-0 sm:pl-[68px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium tabular-nums">
                <span className={isCompleted ? 'text-emerald-400 font-semibold' : 'text-white/80'}>
                  {formatMetricReadout(currentValue, targetValue, pg.targetUnit)}
                </span>
                <span className="text-white/45">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${accentBar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => handleDelta(e, -step)}
                disabled={currentValue <= 0 || isFailed}
                aria-label={`Restar ${step} a ${pg.title}`}
                className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-white transition-transform active:scale-90 cursor-pointer"
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelta(e, step)}
                disabled={isFailed}
                aria-label={`Sumar ${step} a ${pg.title}`}
                className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${pg.cadence === 'monthly'
                  ? 'border-violet-400/30 bg-violet-500/20 hover:bg-violet-500/30 text-violet-200'
                  : 'border-sky-400/30 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200'
                  }`}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }, [logPeriodGoalProgress]);

  // Stale-While-Revalidate: solo muestra el esqueleto completo en el primer arranque en frío sin datos en caché
  if (isChallengeLoading && !todayLog) {
    return <DashboardLoading />;
  }

  if (!isActive) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <div className="rounded-3xl border border-rose-950/40 bg-rose-950/20 p-8 shadow-lg">
          <Target className="mx-auto mb-4 h-10 w-10 text-rose-400" strokeWidth={1.5} aria-hidden="true" />
          <h1 className="text-2xl font-bold text-white">No tienes un desafío activo</h1>
          <p className="mt-2 text-sm text-white/60">
            Elige un plan para comenzar tu reto de 75 días y seguir tus tareas diarias.
          </p>
          <button
            type="button"
            onClick={openPlansModal}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-400 px-6 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-rose-300"
          >
            Elegir un plan
          </button>
        </div>
      </div>
    );
  }

  // ── Fixture de dev ────────────────────────────────────────────────────────
  // Cada dataset cambia sólo los datos que la página ya renderiza; con 'demo'
  // todo queda exactamente como vino del store.
  const isWorst = devDataset === 'worst';
  const isThousand = devDataset === 'thousand';
  const isOne = devDataset === 'one';
  const isEmpty = devDataset === 'empty';

  // ── Datos de la página (normalmente del store) ────────────────────────────
  // `devGoals` y `devQuests` son el único punto de entrada del fixture: mismas
  // formas que `todayLog.goals` y `quests`, así que todo lo que sigue no sabe
  // si está mirando datos de demo o un caso límite.
  const rawGoals = todayLog?.goals || [];
  const devGoals: typeof todayLog.goals = isEmpty
    ? []
    : isWorst
      ? [
          {
            id: 'dev-goal-long',
            title: 'Beber 3,5 litros de agua antes de las 21:00 y registrar cada vaso en la aplicación',
            completed: true,
            description: 'Hidratación · recordatorio cada 45 minutos mientras entrenás',
            icon: 'droplet',
          },
          {
            id: 'dev-goal-script',
            title: '<script>alert(1)</script>',
            completed: false,
            description: 'Texto literal que no debe ejecutarse como HTML',
            icon: 'book',
          },
          {
            id: 'dev-goal-emoji',
            title: '🦊 Meditar 10 minutos',
            completed: false,
            description: '',
            icon: 'sun',
          },
          {
            id: 'dev-goal-rtl',
            title: 'نور الهدى عبد الرحمن تسجيل البيانات',
            completed: true,
            description: 'RTL · texto árabe dentro de una fila LTR',
            icon: 'target',
          },
        ] as typeof todayLog.goals
      : isOne
        ? rawGoals.slice(0, 1)
        : isThousand && rawGoals.length > 0
          ? Array.from({ length: 1000 }, (_, index) => ({
              ...rawGoals[index % rawGoals.length],
              id: `dev-goal-${index + 1}`,
              title: `${rawGoals[index % rawGoals.length].title} #${index + 1}`,
            }))
          : rawGoals;

  const devLog =
    devDataset === 'demo'
      ? todayLog
      : {
          ...todayLog,
          goals: devGoals,
          status: (isEmpty || devGoals.some((goal) => !goal.completed) ? 'pending' : 'success') as typeof todayLog.status,
        };

  const rawQuests = quests || [];
  const devQuests: typeof quests = isEmpty
    ? []
    : isWorst
      ? [
          {
            ...(rawQuests[0] || { id: 'dev-quest-long', userId: '', title: '', description: null, difficulty: 'Medium', durationDays: 365, icon: null, startedAt: '', currentRun: null }),
            id: 'dev-quest-long',
            title:
              'Completar bartholomew.fitzgerald@northwind-industries-holdings.example.com antes de las 21:00 y registrar cada vaso de agua en la aplicación',
            progress: 1284,
            durationDays: 365,
            completed: false,
            completionCount: 0,
          },
          {
            ...(rawQuests[rawQuests.length - 1] || { id: 'dev-quest-one', userId: '', title: '', description: null, difficulty: 'Easy', durationDays: 7, icon: null, startedAt: '', currentRun: null }),
            id: 'dev-quest-one',
            title: 'Leer 20 páginas antes de dormir',
            progress: 1,
            durationDays: 7,
            completed: false,
            completionCount: 1,
          },
        ]
      : isOne
        ? rawQuests.slice(0, 1)
        : isThousand && rawQuests.length > 0
          ? (Array.from({ length: 1000 }, (_, index) => ({
              ...rawQuests[index % rawQuests.length],
              id: `dev-quest-${index + 1}`,
            })) as typeof quests)
          : rawQuests;

  const completedTasks = (devLog?.goals || []).filter(g => g.completed).length;
  const totalTasks = devLog?.goals?.length || 0;
  const remainingTasks = totalTasks - completedTasks;
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const now = new Date();

  // Separate base plan goals from custom goals
  const allDefaultTitles = new Set(
    Object.values(DEFAULT_GOALS).flatMap(goals => goals.map(g => g.title.toLowerCase()))
  );

  const baseGoals = (devLog?.goals || []).filter(g => allDefaultTitles.has(g.title.toLowerCase()));
  const customGoals = (devLog?.goals || []).filter(g => !allDefaultTitles.has(g.title.toLowerCase()));

  // Determine current active plan name mapped to UI strings
  const currentPlanName = useChallengeStore.getState().difficulty || 'Activo';

  // Active weekly and monthly goals for the current challenge period (relative to startDate)
  const currentWeekNumber = Math.floor((Math.max(1, currentDay) - 1) / 7) + 1;
  const currentMonthNumber = Math.floor((Math.max(1, currentDay) - 1) / 30) + 1;

  const currentWeeklyGoals = (periodGoals || []).filter(
    (pg) => pg.cadence === 'weekly' && pg.periodNumber === currentWeekNumber
  );

  const currentMonthlyGoals = (periodGoals || []).filter(
    (pg) => pg.cadence === 'monthly' && pg.periodNumber === currentMonthNumber
  );

  const completedWeeklyCount = currentWeeklyGoals.filter((g) => g.status === 'success').length;
  const completedMonthlyCount = currentMonthlyGoals.filter((g) => g.status === 'success').length;

  return (
    <div className="dashboard-page grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 animate-in fade-in">

      {/* Left Column */}
      <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-4">

        {/* RESUMEN DEL DÍA: une avance del desafío y estado de las tareas */}
        <section data-tour="daily-summary" className="bg-rose-950/20 border border-rose-950/40 rounded-3xl p-4 sm:p-6 shadow-lg" aria-labelledby="today-summary-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-rose-500 text-[10px] font-bold tracking-[0.2em] uppercase">Resumen de hoy</p>
              <h2 id="today-summary-title" className="mt-1 text-sm font-semibold text-white/70">Día actual</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShareModal({ open: true, initialKind: 'challenge' })}
                aria-label="Compartir progreso del reto"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              >
                <Share2 className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                <span>Compartir</span>
              </button>
              <Link
                href="/calendar"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              >
                <CalendarRange className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                <span>Calendario</span>
              </Link>
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-5xl font-bold tracking-tighter text-white tabular-nums sm:text-7xl">{currentDay}</span>
            <span className="text-xl font-bold text-white/40 sm:text-2xl">/ 75 días</span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs font-medium text-white/60">
              <span>Progreso del desafío</span>
              <span>{Math.round((currentDay / 75) * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full bg-rose-500 transition-all duration-250 ease-out"
                style={{ width: `${(currentDay / 75) * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-rose-500 text-[10px] font-bold tracking-[0.2em] uppercase">Estado diario</p>
                <h3 className="mt-1 text-xl font-bold uppercase tracking-tight text-white">
                  {progress === 100 ? 'Completado' : 'En progreso'}
                </h3>
              </div>

              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center sm:h-20 sm:w-20">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-label={`${progress}% de tareas completadas`} role="img">
                  <path
                    className="text-white/5"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    className={`transition-all duration-250 ease-out ${progress === 100 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-500'}`}
                    strokeDasharray={`${progress}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <span className={`absolute text-xs font-bold sm:text-sm ${progress === 100 ? 'text-emerald-600 dark:text-emerald-500' : 'text-white'}`}>
                  {progress}%
                </span>
              </div>
            </div>
            <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-white/60">
              {totalTasks === 0
                ? 'Tu plan actual se enfoca en metas semanales o mensuales.'
                : remainingTasks === 0
                  ? '¡Todas las tareas diarias completadas por hoy! Gran trabajo.'
                  : `${remainingTasks} tareas diarias restantes para terminar el día.`}
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShareModal({ open: true, initialKind: 'daily' })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white active:scale-[0.98]"
              >
                <Share2 className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                <span>Compartir estado de hoy</span>
              </button>
            </div>
            {(currentWeeklyGoals.length > 0 || currentMonthlyGoals.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {currentWeeklyGoals.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 tabular-nums">
                    <CalendarRange size={12} aria-hidden="true" />
                    Sem {currentWeekNumber}: {completedWeeklyCount}/{currentWeeklyGoals.length}
                  </span>
                )}
                {currentMonthlyGoals.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300 tabular-nums">
                    <CalendarClock size={12} aria-hidden="true" />
                    Mes {currentMonthNumber}: {completedMonthlyCount}/{currentMonthlyGoals.length}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                <Scale size={17} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Peso de hoy</p>
                <p className="text-sm font-bold text-white tabular-nums truncate">
                  {devLog?.weight ? `${devLog.weight} kg` : 'Sin registrar'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openLogWeightModal}
              className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/25 active:scale-95"
            >
              <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>{devLog?.weight ? 'Actualizar' : 'Registrar'}</span>
            </button>
          </div>
        </section>

      </div>

      {/* Right Column */}
      <div className="lg:col-span-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 sm:mb-8 gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold text-rose-400 tracking-tight">Tareas de Hoy</h1>
            <span className="text-white/60 text-sm font-medium capitalize">
              {format(now, "EEEE, d 'de' MMMM", { locale: es })}
            </span>
          </div>

          {/* Pills Toggle */}
          <div className="flex w-full sm:w-auto bg-rose-950/20 p-1 rounded-2xl border border-rose-950/40">
            <button
              onClick={() => setActiveTab('plan')}
              className={`flex-1 sm:flex-none min-h-11 px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'plan'
                ? 'bg-rose-400 text-zinc-950 shadow-lg shadow-rose-500/20'
                : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              Plan Activo
            </button>
            <button
              data-tour="missions-tab"
              onClick={() => setActiveTab('missions')}
              className={`flex-1 sm:flex-none min-h-11 px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'missions'
                ? 'bg-rose-400 text-zinc-950 shadow-lg shadow-rose-500/20'
                : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              Misiones
              {(devQuests || []).filter(q => !q.completed).length > 0 && (
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${activeTab === 'missions' ? 'bg-white text-rose-500' : 'bg-rose-500/20 text-rose-500'
                  }`}>
                  {(devQuests || []).filter(q => !q.completed).length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div data-tour="daily-tasks" className="space-y-6 sm:space-y-8 min-h-[280px] sm:min-h-[400px]">
          {activeTab === 'plan' ? (
            /* TAB: PLAN ACTIVO */
            <>
              {currentPlanName === 'Custom' ? (
                /* PLAN CUSTOM: all goals are personal */
                <div>
                    <h2 className="text-sm font-bold tracking-widest text-emerald-300 uppercase mb-4 flex items-center gap-2">
                    <PlusCircle size={16} /> Metas Personalizadas
                  </h2>
                  <div className="space-y-3">
                    {devLog.goals.map(renderGoalItem)}
                  </div>
                </div>
              ) : (
                <>
                  {/* TAREAS DEL PLAN BASE (Soft / Medium / Hard) */}
                  <div>
                    <h2 className="text-sm font-bold tracking-widest text-rose-300 uppercase mb-4 flex items-center gap-2">
                      <Target size={16} /> Plan {currentPlanName}
                      </h2>
                    <div className="space-y-3">
                      {baseGoals.length > 0 ? (
                        baseGoals.map(renderGoalItem)
                      ) : (
                        <p className="text-white/40 text-sm italic p-4 bg-white/5 rounded-2xl border border-white/5">
                          No hay tareas base para este plan.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* METAS PERSONALIZADAS (extra goals on non-custom plans) */}
                  {customGoals.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold tracking-widest text-emerald-300 uppercase mb-4 flex items-center gap-2">
                        <PlusCircle size={16} /> Metas Personalizadas
                      </h2>
                      <div className="space-y-3">
                        {customGoals.map(renderGoalItem)}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* SECCIÓN APILADA: METAS SEMANALES */}
              {currentWeeklyGoals.length > 0 && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h2 className="text-sm font-bold tracking-widest text-sky-300 uppercase flex items-center gap-2">
                      <CalendarRange size={16} /> Esta Semana (Semana {currentWeekNumber})
                    </h2>
                    <span className="text-xs font-semibold text-sky-300/80 tabular-nums">
                      {completedWeeklyCount}/{currentWeeklyGoals.length} completadas
                    </span>
                  </div>
                  <div className="space-y-3">
                    {currentWeeklyGoals.map(renderPeriodGoalItem)}
                  </div>
                </div>
              )}

              {/* SECCIÓN APILADA: METAS MENSUALES */}
              {currentMonthlyGoals.length > 0 && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h2 className="text-sm font-bold tracking-widest text-violet-300 uppercase flex items-center gap-2">
                      <CalendarClock size={16} /> Este Mes (Mes {currentMonthNumber})
                    </h2>
                    <span className="text-xs font-semibold text-violet-300/80 tabular-nums">
                      {completedMonthlyCount}/{currentMonthlyGoals.length} completadas
                    </span>
                  </div>
                  <div className="space-y-3">
                    {currentMonthlyGoals.map(renderPeriodGoalItem)}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* TAB: MISIONES */
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold tracking-widest text-emerald-300 uppercase flex items-center gap-2">
                  <Trophy size={16} /> Misiones Secundarias
                </h2>
                <button
                  data-tour="new-mission-btn"
                  onClick={() => setIsSideQuestsModalOpen(true)}
                  className="text-xs font-bold text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 transition-colors px-4 py-2 rounded-xl flex items-center gap-2"
                >
                  <PlusCircle size={14} /> Nueva Misión
                </button>
              </div>

              <div className="space-y-4">
                {isQuestsLoading && devQuests.length === 0 && devDataset === 'demo' ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="pv2-skeleton w-8 h-8 rounded-full" />
                    <div className="pv2-skeleton w-40 h-4 mt-4" />
                  </div>
                ) : devQuests.length > 0 ? (
                  devQuests.map(quest => (
                    <button
                      key={quest.id}
                      type="button"
                      onClick={() => setSelectedSideQuest(quest)}
                      aria-label={`Abrir misión ${quest.title}: ${quest.progress} de ${quest.durationDays} días, dificultad ${quest.difficulty}`}
                      aria-haspopup="dialog"
                      className="side-quest-card group w-full text-left bg-rose-950/20 border rounded-2xl p-5 transition-all duration-200" data-completed={quest.completed ? 'true' : 'false'}
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${quest.completed
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-rose-950/60 text-emerald-500/70 group-hover:text-emerald-500'
                          }`}>
                          <Trophy size={24} strokeWidth={1.5} />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-bold text-lg transition-colors ${quest.completed ? 'text-white/70 line-through' : 'text-white'}`}>
                              {quest.title}
                            </h3>
                            {quest.completed && (
                              <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                Completada
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-semibold text-white/40">
                              Dificultad: <span className={
                                quest.difficulty === 'Easy' ? 'text-emerald-400' :
                                  quest.difficulty === 'Medium' ? 'text-amber-400' : 'text-red-400'
                              }>{quest.difficulty}</span>
                            </span>
                            <span className="text-xs font-semibold text-white/40">
                              Progreso: <span className="text-white">{quest.progress}</span> / {quest.durationDays}
                            </span>
                            <span className="text-xs font-semibold text-white/40">
                              Completada: <span className="text-emerald-300">{quest.completionCount} {quest.completionCount === 1 ? 'vez' : 'veces'}</span>
                            </span>
                          </div>
                        </div>

                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 ease-out ${quest.completed
                          ? 'bg-emerald-500 border-emerald-500 scale-125 shadow-[0_0_15px_var(--color-emerald-500)]'
                          : 'border-rose-950/40 group-hover:border-emerald-500/50 group-active:scale-75 scale-100'
                          }`}>
                          {quest.completed && <Check size={16} className="text-white" strokeWidth={3} />}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {!quest.completed && (
                        <div className="mt-4 flex flex-col gap-1.5">
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-200 ease-out"
                              style={{ width: `${(quest.progress / quest.durationDays) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
                    <Trophy className="mx-auto w-12 h-12 text-white/20 mb-3" />
                    <p className="text-white/60 mb-4">No tienes misiones activas.</p>
                    <button
                      onClick={() => setIsSideQuestsModalOpen(true)}
                      className="px-6 py-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20 transition-colors font-medium border border-rose-500/20"
                    >
                      Buscar Nueva Misión
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* break-ui · toggle de datasets (sólo dev). El componente entero se
          reemplaza por `undefined` en producción, así que webpack elimina el
          import dinámico y su chunk no se genera ni se referencia. */}
      {IS_DEV_BUILD && (
        <DevDatasetPicker
          selected={devDataset}
          onSelect={setDevDataset}
          positionClassName="bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6"
        />
      )}

      {isSideQuestsModalOpen && (
        <SideQuestsModal
          onClose={() => setIsSideQuestsModalOpen(false)}
        />
      )}
      {selectedSideQuest && (
        <SideQuestDetailModal quest={selectedSideQuest} onClose={() => setSelectedSideQuest(null)} />
      )}
      {isTutorialOpen && (
        <OnboardingTutorial
          isOpen={isTutorialOpen}
          userName={user?.name}
          planDifficulty={currentPlanName}
          onStepChange={(stepId) => {
            if (stepId === 'missions-create') {
              setActiveTab('missions');
            } else if (stepId === 'daily-tasks' || stepId === 'daily-summary') {
              setActiveTab('plan');
            }
          }}
          onSkip={handleDismissTutorial}
          onComplete={handleDismissTutorial}
        />
      )}
      {shareModal.open && (
        <ShareProgressModal
          open={shareModal.open}
          onClose={() => setShareModal((prev) => ({ ...prev, open: false }))}
          initialKind={shareModal.initialKind}
          dailySource={{
            date: todayStr,
            dayNumber: Math.max(1, currentDay),
            goals: devLog?.goals || [],
          }}
        />
      )}
    </div>
  );
}

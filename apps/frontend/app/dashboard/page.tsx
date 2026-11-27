'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useUIStore } from '@/store/useUIStore';
import InlineMetricEditor from '@/components/InlineMetricEditor';
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
  ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  const {
    quests,
    fetchQuests,
    fetchAvailableQuests,
    toggleTask,
    progressQuest,
    isLoading: isQuestsLoading,
  } = useQuestStore();
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
  const [isInitialSyncing, setIsInitialSyncing] = useState(() => !isActive);

  useEffect(() => {
    if (hasCheckedReset.current || !user) return;
    hasCheckedReset.current = true;

    // Fase 2 (Patrón /api/sync de appManifestV2): sincroniza reto + daily reset + misiones en 1 round-trip
    (async () => {
      try {
        await syncCoreStores({ includeProfile: false });
        const current = useChallengeStore.getState();
        if (!current.isActive) {
          if (user.onboardingCompleted !== true) router.push('/onboarding');
        }
      } finally {
        setIsInitialSyncing(false);
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
        className={`w-full text-left dashboard-card px-3 py-2.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3 min-h-12 sm:min-h-14 ${goal.completed
          ? ''
          : 'hover:border-rose-500/50'
          }`}
      >
        <div
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
          className="group cursor-pointer flex items-center gap-3 sm:gap-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg"
        >
          <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-colors ${goal.completed
            ? 'bg-rose-500/20 text-rose-500'
            : 'bg-[var(--surface-inset)] text-rose-400/70 group-hover:text-rose-500'
            }`}>
            <IconComponent size={18} strokeWidth={1.6} className="sm:w-6 sm:h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-[15px] leading-snug sm:text-lg ${goal.description ? 'mb-0.5 sm:mb-1' : ''} transition-colors ${goal.completed ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
              {goal.title}
            </h3>
            {goal.description ? (
              <p className={`text-xs sm:text-sm transition-colors ${goal.completed ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>
                {goal.description}
              </p>
            ) : null}
          </div>

          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 group-active:scale-90 ${goal.completed
            ? 'bg-rose-500 border-rose-500 shadow-[0_0_15px_var(--color-rose-500)] group-hover:bg-rose-400 group-hover:border-rose-400'
            : 'border-rose-950/40 group-hover:border-rose-500/50'
            }`}>
            {goal.completed && <Check size={14} className="text-white sm:w-4 sm:h-4" strokeWidth={3} />}
          </div>
        </div>

        {isQuantified && (
          <div className="pl-0 sm:pl-[68px]" onClick={(e) => e.stopPropagation()}>
            <InlineMetricEditor
              currentValue={currentValue}
              targetValue={targetValue}
              targetUnit={goal.targetUnit}
              measurementType={measurementType}
              isCompleted={goal.completed}
              compact
              onDelta={(delta) =>
                void logDailyGoalProgress(todayStr, goal.id, { delta }).catch(() => {})
              }
              onSetValue={(value) =>
                void logDailyGoalProgress(todayStr, goal.id, { currentValue: value }).catch(() => {})
              }
            />
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
        className={`w-full text-left border rounded-2xl px-3.5 py-3 sm:p-5 flex flex-col gap-3 transition-colors duration-200 ${accentBorder}`}
      >
        <div
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
          className="group cursor-pointer flex items-center gap-3 sm:gap-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg"
        >
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
              <h3 className={`font-semibold text-base sm:text-lg transition-colors ${isCompleted ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
                {pg.title}
              </h3>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${pg.cadence === 'monthly' ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300' : 'bg-sky-500/20 text-sky-700 dark:text-sky-300'}`}>
                {pg.cadence === 'monthly' ? `Mes ${pg.periodNumber}` : `Sem ${pg.periodNumber}`}
              </span>
            </div>
            {pg.description ? (
              <p className={`text-sm mt-0.5 transition-colors ${isCompleted ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>
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
          <div className="pl-0 sm:pl-[68px]" onClick={(e) => e.stopPropagation()}>
            <InlineMetricEditor
              currentValue={currentValue}
              targetValue={targetValue}
              targetUnit={pg.targetUnit}
              measurementType={pg.measurementType}
              isCompleted={isCompleted}
              isFailed={isFailed}
              compact
              onDelta={(delta) => {
                if (isFailed) return;
                void logPeriodGoalProgress(pg.id, { delta }).catch(() => {});
              }}
              onSetValue={(value) => {
                if (isFailed) return;
                void logPeriodGoalProgress(pg.id, { currentValue: value }).catch(() => {});
              }}
            />
          </div>
        )}
      </div>
    );
  }, [logPeriodGoalProgress]);

  // Stale-While-Revalidate: solo muestra el esqueleto completo en el primer arranque en frío sin datos en caché
  if ((isChallengeLoading || isInitialSyncing) && !todayLog) {
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

  const activeQuests = (devQuests || []).filter(q => !q.completed);
  const isQuestDoneToday = (q: (typeof activeQuests)[number]) => {
    if (q.todayCompleted) return true;
    const tasks = q.currentRun?.tasks ?? [];
    const dailyTasks = tasks.filter(t => t.frequency === 'daily');
    return dailyTasks.length > 0 && dailyTasks.every(t => t.completed);
  };
  const pendingQuestsToday = activeQuests.filter(q => !isQuestDoneToday(q));
  const completedQuestsTodayCount = activeQuests.length - pendingQuestsToday.length;

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
    <div className="dashboard-page grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 animate-in fade-in">

      {/* Left Column */}
      <div className="min-w-0 space-y-3 sm:space-y-6 lg:col-span-4">

        {/* RESUMEN DEL DÍA: une avance del desafío y estado de las tareas */}
        <section data-tour="daily-summary" className="dashboard-card p-3.5 sm:p-6 shadow-lg" aria-labelledby="today-summary-title">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-rose-500 text-[10px] font-bold tracking-[0.16em] uppercase whitespace-nowrap">Resumen de hoy</p>
              <h2 id="today-summary-title" className="mt-0.5 text-xs sm:text-sm font-semibold text-[var(--text-secondary)]">Día actual</h2>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShareModal({ open: true, initialKind: 'daily' })}
                aria-label="Compartir progreso"
                className="hit-44 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              >
                <Share2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-400" aria-hidden="true" />
                <span>Compartir</span>
              </button>
            </div>
          </div>

          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-[28px] leading-none font-bold tracking-[-0.03em] text-[var(--text-primary)] tabular-nums whitespace-nowrap sm:text-6xl">{currentDay}</span>
            <span className="text-sm font-semibold text-[var(--text-muted)] sm:text-xl whitespace-nowrap">/ 75 días</span>
          </div>

          <div className="mt-2.5 sm:mt-4 space-y-1.5 sm:space-y-2">
            <div className="flex justify-between text-[11px] sm:text-xs font-medium text-[var(--text-secondary)] tabular-nums">
              <span>Progreso del desafío</span>
              <span>{Math.round((currentDay / 75) * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-inset)]">
              <div
                className="h-full bg-rose-500 transition-all duration-250 ease-out"
                style={{ width: `${(currentDay / 75) * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-3.5 border-t border-white/10 pt-3.5 sm:mt-5 sm:pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-rose-500 text-[10px] font-bold tracking-[0.16em] uppercase">Estado diario</p>
                <h3 className="mt-0.5 text-base sm:text-xl font-bold uppercase tracking-tight text-white">
                  {progress === 100 ? 'Completado' : 'En progreso'}
                </h3>
              </div>

              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center sm:h-16 sm:w-16">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-label={`${progress}% de tareas completadas`} role="img">
                  <path
                    className="text-white/5"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                  />
                  <path
                    className={`transition-all duration-250 ease-out ${progress === 100 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-500'}`}
                    strokeDasharray={`${progress}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                  />
                </svg>
                <span className={`absolute text-[11px] font-bold tabular-nums sm:text-sm ${progress === 100 ? 'text-emerald-600 dark:text-emerald-500' : 'text-white'}`}>
                  {progress}%
                </span>
              </div>
            </div>
            <p className="mt-1.5 sm:mt-2.5 text-xs sm:text-sm leading-snug text-[var(--text-secondary)]">
              {totalTasks === 0
                ? 'Tu plan actual se enfoca en metas semanales o mensuales.'
                : remainingTasks === 0
                  ? '¡Todas las tareas diarias completadas por hoy! Gran trabajo.'
                  : remainingTasks === 1
                    ? '1 tarea diaria restante para terminar el día.'
                    : `${remainingTasks} tareas diarias restantes para terminar el día.`}
            </p>
            {(() => {
              const calcHorizonPct = (
                items: Array<{
                  completed?: boolean;
                  status?: string;
                  measurementType?: string;
                  currentValue?: number;
                  targetValue?: number;
                }>
              ) => {
                if (items.length === 0) return 0;
                const totalRatio = items.reduce((acc, item) => {
                  const isDone = item.completed === true || item.status === 'success';
                  if (isDone) return acc + 1;
                  if (
                    item.measurementType &&
                    item.measurementType !== 'boolean' &&
                    typeof item.targetValue === 'number' &&
                    item.targetValue > 0
                  ) {
                    const cur = typeof item.currentValue === 'number' ? item.currentValue : 0;
                    return acc + Math.min(1, Math.max(0, cur / item.targetValue));
                  }
                  return acc;
                }, 0);
                return Math.round((totalRatio / items.length) * 100);
              };

              const dailyGoalsList = devLog?.goals || [];
              const dailyPct = calcHorizonPct(dailyGoalsList);
              const weeklyPct = calcHorizonPct(currentWeeklyGoals);
              const monthlyPct = calcHorizonPct(currentMonthlyGoals);

              return (
                <div className="mt-3 space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-[var(--text-muted)] uppercase tracking-wider">Progreso multi-horizonte</span>
                  </div>
                  {dailyGoalsList.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="text-[var(--text-secondary)] font-medium">Hoy (Diario)</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">{dailyPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--progress-track,rgba(148,163,184,0.22))] overflow-hidden">
                        <div className="h-full rounded-full bg-rose-500 transition-all duration-300" style={{ width: `${dailyPct}%` }} />
                      </div>
                    </div>
                  )}
                  {currentWeeklyGoals.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 font-medium">
                          <CalendarRange size={12} aria-hidden="true" />
                          Semana {currentWeekNumber} ({completedWeeklyCount}/{currentWeeklyGoals.length})
                        </span>
                        <span className="font-bold text-sky-700 dark:text-sky-300">{weeklyPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--progress-track,rgba(148,163,184,0.22))] overflow-hidden">
                        <div className="h-full rounded-full bg-sky-500 transition-all duration-300" style={{ width: `${weeklyPct}%` }} />
                      </div>
                    </div>
                  )}
                  {currentMonthlyGoals.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300 font-medium">
                          <CalendarClock size={12} aria-hidden="true" />
                          Mes {currentMonthNumber} ({completedMonthlyCount}/{currentMonthlyGoals.length})
                        </span>
                        <span className="font-bold text-violet-700 dark:text-violet-300">{monthlyPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--progress-track,rgba(148,163,184,0.22))] overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500 transition-all duration-300" style={{ width: `${monthlyPct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="mt-3.5 border-t border-white/10 pt-3 sm:mt-5 sm:pt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-rose-500/15 text-rose-400">
                <Scale size={15} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Peso de hoy</p>
                <p className="text-[13px] sm:text-sm font-bold text-[var(--text-primary)] tabular-nums truncate">
                  {devLog?.weight ? `${devLog.weight} kg` : 'Sin registrar'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openLogWeightModal}
              className="hit-44 inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-lg sm:rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-200 transition-colors hover:bg-rose-500/25 active:scale-95"
            >
              <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
              <span>{devLog?.weight ? 'Actualizar' : 'Registrar'}</span>
            </button>
          </div>
        </section>

      </div>

      {/* Right Column */}
      <div className="lg:col-span-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-3 sm:mb-6 gap-2.5 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-rose-400 tracking-tight">Tareas de Hoy</h1>
            <span className="text-[var(--text-secondary)] text-xs sm:text-sm font-medium capitalize">
              {format(now, "EEEE, d 'de' MMMM", { locale: es })}
            </span>
          </div>

          {/* Pills Toggle */}
          <div className="flex w-full sm:w-auto bg-[var(--surface-inset)] p-1 rounded-xl sm:rounded-2xl border border-[var(--border-subtle)]">
            <button
              onClick={() => setActiveTab('plan')}
              className={`flex-1 sm:flex-none min-h-9 sm:min-h-11 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'plan'
                ? 'bg-rose-400 text-zinc-950 shadow-lg shadow-rose-500/20'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
                }`}
            >
              Plan Activo
            </button>
            <button
              data-tour="missions-tab"
              onClick={() => setActiveTab('missions')}
              className={`flex-1 sm:flex-none min-h-9 sm:min-h-11 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab === 'missions'
                ? 'bg-rose-400 text-zinc-950 shadow-lg shadow-rose-500/20'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
                }`}
            >
              Misiones
              {pendingQuestsToday.length > 0 ? (
                <span
                  className={`min-w-4 h-4 sm:min-w-5 sm:h-5 px-1 inline-flex items-center justify-center rounded-full text-[10px] sm:text-[11px] font-extrabold tabular-nums ${activeTab === 'missions'
                    ? 'bg-neutral-950 text-amber-300'
                    : 'bg-amber-400 text-neutral-950 shadow-sm shadow-amber-500/30'
                    }`}
                >
                  {pendingQuestsToday.length}
                  <span className="sr-only"> misiones pendientes hoy</span>
                </span>
              ) : activeQuests.length > 0 ? (
                <span
                  className={`w-4 h-4 sm:w-5 sm:h-5 inline-flex items-center justify-center rounded-full ${activeTab === 'missions'
                    ? 'bg-neutral-950/15 text-neutral-950'
                    : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  title="Misiones al día"
                >
                  <Check size={11} strokeWidth={3} />
                  <span className="sr-only">Misiones secundarias al día</span>
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <div data-tour="daily-tasks" className="space-y-4 sm:space-y-8 min-h-[240px] sm:min-h-[400px]">
          {activeTab === 'plan' ? (
            /* TAB: PLAN ACTIVO */
            <>
              {currentPlanName === 'Custom' ? (
                /* PLAN CUSTOM: all goals are personal */
                <div>
                    <h2 className="text-xs sm:text-sm font-bold tracking-widest text-emerald-300 uppercase mb-2.5 sm:mb-4 flex items-center gap-2">
                    <PlusCircle size={15} /> Metas Personalizadas
                  </h2>
                  <div className="ios-stagger space-y-2 sm:space-y-3">
                    {devLog.goals.map(renderGoalItem)}
                  </div>
                </div>
              ) : (
                <>
                  {/* TAREAS DEL PLAN BASE (Soft / Medium / Hard) */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold tracking-widest text-rose-700 dark:text-rose-200 uppercase mb-2.5 sm:mb-4 flex items-center gap-2">
                      <Target size={15} /> Plan {currentPlanName}
                      </h2>
                    <div className="ios-stagger space-y-2 sm:space-y-3">
                      {baseGoals.length > 0 ? (
                        baseGoals.map(renderGoalItem)
                      ) : (
                        <p className="text-white/40 text-sm italic p-4 bg-[var(--surface-inset)] rounded-2xl border border-[var(--border-subtle)]">
                          No hay tareas base para este plan.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* METAS PERSONALIZADAS (extra goals on non-custom plans) */}
                  {customGoals.length > 0 && (
                    <div>
                        <h2 className="text-xs sm:text-sm font-bold tracking-widest text-emerald-300 uppercase mb-2.5 sm:mb-4 flex items-center gap-2">
                        <PlusCircle size={15} /> Metas Personalizadas
                      </h2>
                      <div className="ios-stagger space-y-2 sm:space-y-3">
                        {customGoals.map(renderGoalItem)}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* SECCIÓN APILADA: MISIONES SECUNDARIAS ACTIVAS */}
              {activeQuests.length > 0 && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                    <h2 className="text-xs sm:text-sm font-bold tracking-widest text-amber-400 uppercase flex items-center gap-2">
                      <Trophy size={15} /> Misiones Secundarias
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-amber-400/85 tabular-nums">
                        {completedQuestsTodayCount}/{activeQuests.length} hoy
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('missions')}
                        className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] underline-offset-4 hover:underline transition-colors cursor-pointer"
                      >
                        Ver todas
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2.5 sm:space-y-3">
                    {activeQuests.map(quest => {
                      const todayDone = isQuestDoneToday(quest);
                      const tasks = quest.currentRun?.tasks ?? [];
                      const doneTasks = tasks.filter(t => t.completed).length;
                      const currentQuestDay = quest.currentRun?.currentDay ?? Math.max(1, quest.progress || 1);
                      const singleSimpleDailyTask =
                        tasks.length === 1 &&
                        tasks[0].frequency === 'daily' &&
                        (!tasks[0].periodTarget || tasks[0].periodTarget <= 1)
                          ? tasks[0]
                          : null;
                      const canQuickToggle = Boolean(singleSimpleDailyTask) || tasks.length === 0;

                      const handleQuickAction = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (singleSimpleDailyTask) {
                          void toggleTask(quest.id, singleSimpleDailyTask.id, 'toggle');
                        } else if (tasks.length === 0) {
                          void progressQuest(quest.id);
                        } else {
                          setSelectedSideQuest(quest);
                        }
                      };

                      return (
                        <div
                          key={quest.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedSideQuest(quest)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedSideQuest(quest);
                            }
                          }}
                          aria-haspopup="dialog"
                          aria-label={`Misión secundaria ${quest.title}: día ${currentQuestDay} de ${quest.durationDays}, ${todayDone ? 'completada hoy' : 'pendiente hoy'}`}
                          className={`group cursor-pointer w-full text-left border rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 flex items-center gap-3 sm:gap-4 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-amber-400 focus-visible:outline-offset-2 ${todayDone
                            ? 'border-emerald-500/35 bg-emerald-500/[0.08] hover:border-emerald-400/55'
                            : 'border-amber-500/30 bg-amber-500/[0.06] hover:border-amber-400/55 hover:bg-amber-500/[0.10]'
                            }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${todayDone
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                            }`}>
                            <Trophy size={19} strokeWidth={1.75} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={`font-semibold text-sm sm:text-base truncate transition-colors ${todayDone ? 'text-white/75 line-through' : 'text-white'}`}>
                                {quest.title}
                              </h3>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${todayDone
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/15 text-amber-300'
                                }`}>
                                {todayDone ? 'Hoy listo' : 'Pendiente hoy'}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
                              Día {currentQuestDay} de {quest.durationDays}
                              {tasks.length > 1 ? ` · ${doneTasks}/${tasks.length} tareas` : ''}
                            </p>
                          </div>

                          {canQuickToggle ? (
                            <button
                              type="button"
                              onClick={handleQuickAction}
                              aria-label={todayDone ? `Desmarcar ${quest.title} hoy` : `Marcar ${quest.title} hoy`}
                              aria-pressed={todayDone}
                              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150 cursor-pointer ${todayDone
                                ? 'bg-emerald-500 border-emerald-500 text-neutral-950 hover:bg-emerald-400'
                                : 'border-amber-400/50 text-amber-400 hover:bg-amber-400 hover:text-neutral-950 hover:border-amber-400'
                                }`}
                            >
                              <Check size={16} strokeWidth={3} />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 shrink-0 text-[var(--text-muted)] group-hover:text-amber-400 transition-colors">
                              <span className="text-xs font-semibold tabular-nums">
                                {doneTasks}/{tasks.length}
                              </span>
                              <ChevronRight size={16} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
              <div className="flex items-center justify-between gap-2 mb-3 sm:mb-5">
                <h2 className="text-xs sm:text-sm font-bold tracking-widest text-amber-400 uppercase flex items-center gap-2 min-w-0">
                  <Trophy size={15} className="shrink-0" />
                  <span className="truncate">Misiones Secundarias</span>
                </h2>
                <button
                  data-tour="new-mission-btn"
                  onClick={() => setIsSideQuestsModalOpen(true)}
                  className="hit-44 shrink-0 text-xs font-bold text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 transition-colors px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                >
                  <PlusCircle size={14} aria-hidden="true" /> Nueva Misión
                </button>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
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
                      className="side-quest-card group w-full text-left dashboard-card border rounded-xl sm:rounded-2xl px-3.5 py-3 sm:p-4 transition-all duration-200" data-completed={quest.completed ? 'true' : 'false'}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-colors ${quest.completed
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-rose-950/60 text-emerald-500/70 group-hover:text-emerald-500'
                          }`}>
                          <Trophy size={18} strokeWidth={1.6} className="sm:w-5 sm:h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5 sm:mb-1">
                            <h3 className={`font-semibold text-[15px] leading-snug sm:text-base transition-colors ${quest.completed ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
                              {quest.title}
                            </h3>
                            {quest.completed ? (
                              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full shrink-0">
                                Completada
                              </span>
                            ) : quest.todayCompleted ? (
                              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full shrink-0">
                                Hoy listo
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] sm:text-xs font-medium text-[var(--text-muted)] tabular-nums">
                            <span>
                              Dificultad:{' '}
                              <span className={
                                quest.difficulty === 'Easy' ? 'text-emerald-400 font-semibold' :
                                  quest.difficulty === 'Medium' ? 'text-amber-400 font-semibold' : 'text-red-400 font-semibold'
                              }>{quest.difficulty}</span>
                            </span>
                            <span>
                              Progreso: <span className="text-[var(--text-primary)] font-semibold">{quest.progress}</span>/{quest.durationDays} días
                            </span>
                            <span>
                              Completada: <span className="text-emerald-300 font-semibold">{quest.completionCount} {quest.completionCount === 1 ? 'vez' : 'veces'}</span>
                            </span>
                          </div>
                        </div>

                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ease-out ${quest.completed
                          ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                          : 'border-rose-950/40 group-hover:border-emerald-500/50 group-active:scale-90'
                          }`}>
                          {quest.completed && <Check size={14} className="text-white sm:w-4 sm:h-4" strokeWidth={3} />}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {!quest.completed && (
                        <div className="mt-2.5 sm:mt-3 flex flex-col gap-1">
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-200 ease-out"
                              style={{ width: `${Math.min(100, (quest.progress / quest.durationDays) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
                    <Trophy className="mx-auto w-12 h-12 text-[var(--text-muted)] mb-3" />
                    <p className="text-[var(--text-secondary)] mb-4">No tienes misiones activas.</p>
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

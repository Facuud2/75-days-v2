'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Activity,
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  History,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  FitnessOverviewResponse,
  healthService,
  TrainingPlanPayload,
  TrainingPlanRecord,
  TrainingPlanSlotRecord,
  WorkoutEntryRecord,
  WorkoutRoutineRecord,
} from '@/lib/api/health';
import { useActiveWorkoutStore } from '@/store/useActiveWorkoutStore';
import { useUIStore } from '@/store/useUIStore';
import { useHealthStore } from '@/store/useHealthStore';
import { getLocalDateString } from '@/lib/utils/date';
import {
  formatMuscleLabel,
  SPORT_LABELS_ES,
  STARTER_ROUTINES,
} from '@/lib/constants/fitness';
import TodayPlanHeroCard from '@/components/fitness/TodayPlanHeroCard';
import RoutinePreviewSheet, {
  estimateRoutineDurationMin,
} from '@/components/fitness/RoutinePreviewSheet';
import FitnessSkeleton from '@/components/fitness/FitnessSkeleton';

const RoutineBuilderSheet = dynamic(
  () => import('@/components/fitness/RoutineBuilderSheet'),
  { ssr: false }
);
const WorkoutSessionDetailSheet = dynamic(
  () => import('@/components/fitness/WorkoutSessionDetailSheet'),
  { ssr: false }
);
const AiRoutinePlannerSheet = dynamic(
  () => import('@/components/fitness/AiRoutinePlannerSheet'),
  { ssr: false }
);
const TrainingPlanBuilderSheet = dynamic(
  () => import('@/components/fitness/TrainingPlanBuilderSheet'),
  { ssr: false }
);

function getRoutineSummaryLine(routine: WorkoutRoutineRecord): string {
  const estMin = estimateRoutineDurationMin(routine);
  const muscles = Array.from(
    new Set(
      routine.exercises
        .map((e) => (e.primaryMuscle ? formatMuscleLabel(e.primaryMuscle) : ''))
        .filter(Boolean)
    )
  ).slice(0, 2);
  const countLabel = `${routine.exercises.length} ${routine.exercises.length === 1 ? 'ej.' : 'ejs.'}`;
  return muscles.length > 0
    ? `${countLabel} · ~${estMin} min · ${muscles.join(', ')}`
    : `${countLabel} · ~${estMin} min`;
}

function formatShortDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(y, m - 1, d));
  } catch {
    return dateStr;
  }
}

export default function FitnessPage() {
  const [showHistory, setShowHistory] = useState(false);
  const [overview, setOverview] = useState<FitnessOverviewResponse | null>(null);
  const [routines, setRoutines] = useState<WorkoutRoutineRecord[]>([]);
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlanRecord[]>([]);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutineRecord | null>(null);
  const [previewRoutine, setPreviewRoutine] = useState<{
    routine: WorkoutRoutineRecord;
    isSaved: boolean;
  } | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutEntryRecord | null>(null);

  // AI & Manual Dynamic Training Plan modals
  const [aiPlannerOpen, setAiPlannerOpen] = useState(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);
  const [aiEditingPlan, setAiEditingPlan] = useState<TrainingPlanRecord | null>(null);

  const [manualPlanOpen, setManualPlanOpen] = useState(false);
  const [manualEditingPlan, setManualEditingPlan] = useState<TrainingPlanRecord | null>(null);
  const [manualDraft, setManualDraft] = useState<TrainingPlanPayload | null>(null);
  const [manualExistingPlanId, setManualExistingPlanId] = useState<string | undefined>(undefined);

  const {
    isActive: hasActiveWorkout,
    openPreStartPicker,
    startFromRoutine,
    startFreeWorkout,
    startCardioWorkout,
    setMinimized,
  } = useActiveWorkoutStore();
  const openLogWorkoutModal = useUIStore((s) => s.openLogWorkoutModal);

  const today = useMemo(() => getLocalDateString(), []);
  const storeTodayStats = useHealthStore((s) => s.dailyStatsByDate[today]);
  const storeTodayWorkoutMin = storeTodayStats?.totalWorkoutMin;
  const recentWorkoutsInStore = useHealthStore((s) => s.recentWorkouts);

  const loadFitnessData = useCallback(async () => {
    try {
      const [overviewRes, routinesRes, workoutsRes, plansRes] = await Promise.all([
        healthService.getFitnessOverview(today).catch(() => null),
        healthService.getRoutines().catch(() => ({ routines: [] })),
        healthService.getRecentWorkouts(30).catch(() => ({ workouts: [] })),
        healthService.getTrainingPlans().catch(() => ({ plans: [] })),
      ]);
      if (overviewRes) setOverview(overviewRes);
      setRoutines(routinesRes.routines || []);
      setHistoryWorkouts(workoutsRes.workouts || []);
      setTrainingPlans(plansRes.plans || []);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void loadFitnessData();
  }, [loadFitnessData]);

  useEffect(() => {
    if (!recentWorkoutsInStore.length && storeTodayWorkoutMin === undefined) return;
    const timer = window.setTimeout(() => {
      void loadFitnessData();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [recentWorkoutsInStore, storeTodayWorkoutMin, loadFitnessData]);

  const activePlan = useMemo(
    () => trainingPlans.find((p) => p.isActive) ?? trainingPlans[0] ?? null,
    [trainingPlans]
  );

  const handlePlanSaved = useCallback((saved: TrainingPlanRecord) => {
    setTrainingPlans((prev) => {
      const deactivated = saved.isActive
        ? prev.map((p) => ({ ...p, isActive: false }))
        : prev;
      const exists = deactivated.some((p) => p.id === saved.id);
      return exists
        ? deactivated.map((p) => (p.id === saved.id ? saved : p))
        : [saved, ...deactivated];
    });
  }, []);

  const handlePlanDeleted = useCallback((deletedId: string) => {
    setTrainingPlans((prev) => {
      const remaining = prev.filter((p) => p.id !== deletedId);
      if (remaining.length > 0 && !remaining.some((p) => p.isActive)) {
        remaining[0] = { ...remaining[0], isActive: true };
      }
      return remaining;
    });
  }, []);

  const handleSelectActivePlan = async (planId: string) => {
    try {
      const updated = await healthService.updateTrainingPlan(planId, { isActive: true });
      handlePlanSaved(updated);
      toast.success(`Plan activo: ${updated.name}`);
    } catch {
      toast.error('No se pudo cambiar el plan activo');
    }
  };

  const handleStartSlot = (slot: TrainingPlanSlotRecord) => {
    if (hasActiveWorkout) {
      toast('Ya tenés una sesión en vivo abierta.');
      setMinimized(false);
      return;
    }

    if (slot.slotType === 'cardio') {
      startCardioWorkout(slot.sport || 'walking', slot.title);
      return;
    }

    if (slot.routineId) {
      const linked = routines.find((r) => r.id === slot.routineId);
      if (linked) {
        startFromRoutine(linked);
        return;
      }
    }

    if (slot.exercises && slot.exercises.length > 0) {
      startFreeWorkout(
        slot.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          primaryMuscle: ex.primaryMuscle ?? null,
          equipment: ex.equipment ?? null,
          targetSets: ex.targetSets ?? 3,
          defaultRestSec: ex.defaultRestSec ?? 90,
        })),
        slot.title,
        slot.environment ?? null
      );
      return;
    }

    startFreeWorkout([], slot.title, slot.environment ?? null);
  };

  const handleStartRoutine = (routine: WorkoutRoutineRecord) => {
    if (hasActiveWorkout) {
      toast('Ya tenés una sesión abierta.');
      setMinimized(false);
      return;
    }
    startFromRoutine(routine);
  };

  const handleStartFree = () => {
    if (hasActiveWorkout) {
      setMinimized(false);
      return;
    }
    openPreStartPicker();
  };

  const handleDeleteRoutine = async (id: string) => {
    if (!confirm('¿Eliminar esta rutina?')) return;
    try {
      await healthService.deleteRoutine(id);
      setRoutines((prev) => prev.filter((r) => r.id !== id));
      toast.success('Rutina eliminada');
    } catch {
      toast.error('No se pudo eliminar la rutina');
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    if (!confirm('¿Eliminar este entrenamiento del historial?')) return;
    try {
      await healthService.deleteWorkout(id);
      setHistoryWorkouts((prev) => prev.filter((w) => w.id !== id));
      setSelectedWorkout((prev) => (prev?.id === id ? null : prev));
      toast.success('Entrenamiento eliminado');
      void loadFitnessData();
    } catch {
      toast.error('No se pudo eliminar el entrenamiento');
    }
  };

  const handleRepeatWorkout = (workout: WorkoutEntryRecord) => {
    if (!workout.exercises || workout.exercises.length === 0) {
      openLogWorkoutModal(true);
      return;
    }
    startFromRoutine({
      id: `template-repeat-${workout.id}`,
      name: workout.title || 'Sesión repetida',
      sport: workout.sport || 'strength',
      exercises: workout.exercises.map((ex, idx) => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        primaryMuscle: ex.primaryMuscle,
        equipment: ex.equipment,
        order: idx,
        targetSets: Math.max(1, ex.sets?.length || 3),
        defaultRestSec: 90,
      })),
    });
  };

  const todayMinutes = Math.max(
    overview?.todayMinutes ?? 0,
    storeTodayStats?.totalWorkoutMin ?? 0
  );
  const requiredMin = overview?.requiredWorkoutMin ?? 45;
  const progressPct = Math.min(100, Math.round((todayMinutes / requiredMin) * 100));
  const dailyDone = todayMinutes >= requiredMin;

  const ringRadius = 30;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - progressPct / 100);

  const maxMuscleSets = useMemo(() => {
    if (!overview?.muscleDistribution?.length) return 1;
    return Math.max(1, ...overview.muscleDistribution.map((m) => m.sets));
  }, [overview]);

  const hasSavedRoutines = routines.length > 0;
  const recentPreview = historyWorkouts.slice(0, 3);

  if (loading && !overview && routines.length === 0 && !storeTodayStats) {
    return <FitnessSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      {/* Compact Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent-text)]">
            {showHistory ? 'Progreso' : 'Entrenamiento'}
          </p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--text-primary)]">
            {showHistory ? 'Historial' : 'Fitness'}
          </h1>
        </div>

        {showHistory && (
          <button
            type="button"
            onClick={() => setShowHistory(false)}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-inset)] active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
        )}
      </div>

      {/* MAIN VIEW */}
      {!showHistory && (
        <div className="space-y-5">
          {/* Hero Daily Balance Card (Progress Ring + Single Focused Primary CTA) */}
          <section
            aria-label="Meta diaria de entrenamiento"
            className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--text-muted)]">Meta de hoy</p>
                <div className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                    {todayMinutes}
                  </span>
                  <span className="text-sm font-medium text-[var(--text-muted)]">
                    / {requiredMin} min
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      dailyDone
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-[var(--accent-fill)]/15 text-[var(--accent-text)]'
                    }`}
                  >
                    {dailyDone ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Cumplido
                      </>
                    ) : (
                      `Faltan ${requiredMin - todayMinutes} min`
                    )}
                  </span>
                  {overview?.weekly && (
                    <span className="text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
                      {overview.weekly.workouts} ses. · {overview.weekly.minutes}m (7d)
                    </span>
                  )}
                </div>
              </div>

              {/* Clean Circular Progress Ring */}
              <div className="relative flex h-[74px] w-[74px] shrink-0 items-center justify-center">
                <svg className="h-[74px] w-[74px] -rotate-90" viewBox="0 0 74 74" aria-hidden="true">
                  <circle
                    cx="37"
                    cy="37"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-[var(--progress-track)]"
                  />
                  <circle
                    cx="37"
                    cy="37"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringDashOffset}
                    className={`transition-[stroke-dashoffset] duration-500 ease-out ${
                      dailyDone ? 'text-emerald-500' : 'text-[var(--accent-fill)]'
                    }`}
                  />
                </svg>
                <span className="absolute text-sm font-bold text-[var(--text-primary)] tabular-nums">
                  {progressPct}%
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartFree}
              className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill)] px-4 text-sm font-bold text-[var(--on-accent)] shadow-sm transition-transform active:scale-[0.98] hover:bg-[var(--accent-fill-hover)]"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{hasActiveWorkout ? 'Seguir sesión en vivo' : 'Entrenar ahora'}</span>
            </button>
          </section>

          {/* 3-Column Quick Actions Row */}
          <section aria-label="Acciones rápidas" className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => openLogWorkoutModal(true)}
              className="flex min-h-[74px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2 transition-colors hover:bg-[var(--surface-inset)] active:scale-95"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 dark:text-amber-400">
                <History className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-primary)]">Registrar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAiInitialPrompt(undefined);
                setAiEditingPlan(activePlan);
                setAiPlannerOpen(true);
              }}
              className="flex min-h-[74px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2 transition-colors hover:bg-[var(--surface-inset)] active:scale-95"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500 dark:text-rose-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-primary)]">Plan IA</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="flex min-h-[74px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2 transition-colors hover:bg-[var(--surface-inset)] active:scale-95"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-inset)] text-[var(--text-secondary)]">
                <BarChart3 className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-primary)]">Historial</span>
            </button>
          </section>

          {/* Dynamic AI-First / Manual Training Plan Hero */}
          <TodayPlanHeroCard
            plans={trainingPlans}
            activePlan={activePlan}
            onOpenAiPlanner={(opts) => {
              setAiInitialPrompt(opts?.initialPrompt);
              setAiEditingPlan(opts?.editActivePlan ? activePlan : null);
              setAiPlannerOpen(true);
            }}
            onOpenManualBuilder={(plan) => {
              setManualEditingPlan(plan ?? null);
              setManualDraft(null);
              setManualExistingPlanId(plan?.id);
              setManualPlanOpen(true);
            }}
            onSelectActivePlan={handleSelectActivePlan}
            onStartSlot={handleStartSlot}
          />

          {/* Saved Routines (Compact Rows — tap for preview, Play for instant start) */}
          {hasSavedRoutines && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Mis rutinas
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoutine(null);
                    setBuilderOpen(true);
                  }}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 text-xs font-bold text-[var(--accent-text)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {routines.map((routine) => (
                  <article
                    key={routine.id}
                    className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2 pl-3 transition-colors hover:border-[var(--border-control)]/50"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewRoutine({ routine, isSaved: true })}
                      className="flex min-h-[48px] min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-fill)]/12 text-[var(--accent-text)]">
                        <Dumbbell className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">
                          {routine.name}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)] tabular-nums">
                          {getRoutineSummaryLine(routine)}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartRoutine(routine)}
                      aria-label={`Empezar ${routine.name}`}
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[var(--accent-fill)]/15 text-[var(--accent-text)] transition-all hover:bg-[var(--accent-fill)] hover:text-[var(--on-accent)] active:scale-95"
                    >
                      <Play className="h-4 w-4 fill-current" />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Starter / Quick Routines (Compact Rows) */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {hasSavedRoutines ? 'Plantillas sugeridas' : 'Rutinas rápidas'}
              </h2>
              {!hasSavedRoutines && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoutine(null);
                    setBuilderOpen(true);
                  }}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 text-xs font-bold text-[var(--accent-text)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear manual
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTER_ROUTINES.map((tpl) => (
                <article
                  key={tpl.id}
                  className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2 pl-3 transition-colors hover:border-[var(--border-control)]/50"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewRoutine({ routine: tpl, isSaved: false })}
                    className="flex min-h-[48px] min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-inset)] text-[var(--accent-text)]">
                      <Dumbbell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {tpl.name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)] tabular-nums">
                        {getRoutineSummaryLine(tpl)}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartRoutine(tpl)}
                    aria-label={`Empezar ${tpl.name}`}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[var(--accent-fill)]/15 text-[var(--accent-text)] transition-all hover:bg-[var(--accent-fill)] hover:text-[var(--on-accent)] active:scale-95"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                </article>
              ))}
            </div>
          </section>

          {/* Compact Recent Sessions Preview */}
          {recentPreview.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Recientes
                </h2>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-0.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Ver todo
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="divide-y divide-[var(--divider)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                {recentPreview.map((workout) => (
                  <button
                    key={workout.id}
                    type="button"
                    onClick={() => setSelectedWorkout(workout)}
                    className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-inset)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-inset)] text-[var(--accent-text)]">
                        <Flame className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {workout.title || SPORT_LABELS_ES[workout.sport] || workout.sport}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {formatShortDate(workout.date)} · {Math.round(workout.caloriesBurned)} kcal
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] tabular-nums">
                      <span>{workout.durationMin} min</span>
                      <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* HISTORY & PROGRESS VIEW */}
      {showHistory && (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3.5">
              <p className="text-[11px] font-medium text-[var(--text-muted)]">Sesiones (7d)</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                {overview?.weekly.workouts ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3.5">
              <p className="text-[11px] font-medium text-[var(--text-muted)]">Minutos (7d)</p>
              <p className="mt-1 text-2xl font-bold text-[var(--accent-text)] tabular-nums">
                {overview?.weekly.minutes ?? 0}m
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3.5">
              <p className="text-[11px] font-medium text-[var(--text-muted)]">Peso movido</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {overview?.weekly.volumeKg ?? 0}{' '}
                <span className="text-xs font-medium">kg</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3.5">
              <p className="text-[11px] font-medium text-[var(--text-muted)]">Calorías est.</p>
              <p className="mt-1 text-2xl font-bold text-amber-500 dark:text-amber-400 tabular-nums">
                {overview?.weekly.caloriesBurned ?? 0}
              </p>
            </div>
          </section>

          {overview &&
            (overview.muscleDistribution.length > 0 || overview.topLifts.length > 0) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {overview.muscleDistribution.length > 0 && (
                  <section className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                    <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      <Activity className="h-4 w-4 text-[var(--accent-text)]" />
                      Series por músculo (7 días)
                    </h2>
                    <div className="mt-3 space-y-2.5">
                      {overview.muscleDistribution.map((item) => (
                        <div key={item.muscle}>
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-[var(--text-primary)]">
                              {formatMuscleLabel(item.muscle)}
                            </span>
                            <span className="font-bold text-[var(--text-muted)] tabular-nums">
                              {item.sets} {item.sets === 1 ? 'serie' : 'series'}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--progress-track)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent-fill)]"
                              style={{
                                width: `${Math.round((item.sets / maxMuscleSets) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {overview.topLifts.length > 0 && (
                  <section className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                    <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      <Award className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      Tus mejores pesos (30 días)
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {overview.topLifts.map((lift) => (
                        <li
                          key={lift.exerciseId}
                          className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-inset)] px-3 py-2 text-xs"
                        >
                          <span className="truncate font-semibold text-[var(--text-primary)]">
                            {lift.exerciseName}
                          </span>
                          <span className="shrink-0 font-bold text-amber-500 dark:text-amber-400 tabular-nums">
                            Máx. {lift.maxWeightKg} kg
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Sesiones recientes
            </h2>
            {loading ? (
              <div className="h-24 animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]" />
            ) : historyWorkouts.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Aún no tenés entrenamientos registrados
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Empezá tu primera sesión desde Fitness o armá tu plan con IA.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowHistory(false);
                    setAiInitialPrompt(undefined);
                    setAiEditingPlan(null);
                    setAiPlannerOpen(true);
                  }}
                  className="mt-3 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--accent-fill)] px-4 text-xs font-bold text-[var(--on-accent)]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Crear plan con IA
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {historyWorkouts.map((workout) => (
                  <article
                    key={workout.id}
                    className="flex items-center gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1.5 transition-transform duration-100 ease-out has-[button[data-session-trigger]:active]:scale-[0.985]"
                  >
                    <button
                      type="button"
                      data-session-trigger
                      onClick={() => setSelectedWorkout(workout)}
                      className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left touch-manipulation select-none sm:hover:bg-[var(--surface-inset)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">
                            {workout.title || SPORT_LABELS_ES[workout.sport] || workout.sport}
                          </h3>
                          {workout.source === 'strava' && (
                            <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-500 dark:text-orange-400">
                              Strava
                            </span>
                          )}
                          {workout.source === 'tracker' && (
                            <span className="rounded-md bg-[var(--accent-fill)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
                              En vivo
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] tabular-nums">
                          <span>{formatShortDate(workout.date)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {workout.durationMin} min
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Flame className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                            {Math.round(workout.caloriesBurned)} kcal
                          </span>
                          {workout.loadVolumeKg ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <Dumbbell className="h-3.5 w-3.5" />
                              {Math.round(workout.loadVolumeKg)} kg
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteWorkout(workout.id)}
                      aria-label="Eliminar entrenamiento"
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[var(--text-muted)] transition-transform duration-100 ease-out active:scale-95 touch-manipulation select-none sm:hover:bg-red-500/10 sm:hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Routine Preview Sheet (Workout Details) */}
      <RoutinePreviewSheet
        routine={previewRoutine?.routine ?? null}
        isSavedRoutine={previewRoutine?.isSaved ?? false}
        onClose={() => setPreviewRoutine(null)}
        onStart={handleStartRoutine}
        onEdit={(routine) => {
          setEditingRoutine(routine);
          setBuilderOpen(true);
        }}
        onDelete={handleDeleteRoutine}
      />

      {/* AI Dynamic Routine Planner Sheet */}
      <AiRoutinePlannerSheet
        isOpen={aiPlannerOpen}
        initialPrompt={aiInitialPrompt}
        editingPlan={aiEditingPlan}
        onClose={() => {
          setAiPlannerOpen(false);
          setAiInitialPrompt(undefined);
        }}
        onPlanSaved={handlePlanSaved}
        onEditDraftManually={(draft, existingId) => {
          setAiPlannerOpen(false);
          setManualEditingPlan(null);
          setManualDraft(draft);
          setManualExistingPlanId(existingId);
          setManualPlanOpen(true);
        }}
      />

      {/* Manual Daily/Weekly Training Plan Builder Sheet */}
      <TrainingPlanBuilderSheet
        isOpen={manualPlanOpen}
        initialPlan={manualEditingPlan}
        initialDraft={manualDraft}
        existingPlanId={manualExistingPlanId}
        savedRoutines={routines}
        onClose={() => setManualPlanOpen(false)}
        onSaved={handlePlanSaved}
        onDeleted={handlePlanDeleted}
        onSwitchToAi={() => {
          setManualPlanOpen(false);
          setAiInitialPrompt(undefined);
          setAiEditingPlan(null);
          setAiPlannerOpen(true);
        }}
      />

      {/* Individual Strength Routine Builder Sheet */}
      <RoutineBuilderSheet
        isOpen={builderOpen}
        initialRoutine={editingRoutine}
        onClose={() => setBuilderOpen(false)}
        onSaved={(saved) => {
          setRoutines((prev) => {
            const exists = prev.some((r) => r.id === saved.id);
            return exists
              ? prev.map((r) => (r.id === saved.id ? saved : r))
              : [saved, ...prev];
          });
        }}
      />

      <WorkoutSessionDetailSheet
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        onRepeat={handleRepeatWorkout}
        onDelete={handleDeleteWorkout}
      />
    </div>
  );
}

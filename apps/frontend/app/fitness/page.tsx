'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  Edit3,
  Flame,
  History,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AuthGuard from '@/components/AuthGuard';
import {
  FitnessOverviewResponse,
  healthService,
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
import RoutineBuilderSheet from '@/components/fitness/RoutineBuilderSheet';
import WorkoutSessionDetailSheet from '@/components/fitness/WorkoutSessionDetailSheet';

export default function FitnessPage() {
  const [showHistory, setShowHistory] = useState(false);
  const [overview, setOverview] = useState<FitnessOverviewResponse | null>(null);
  const [routines, setRoutines] = useState<WorkoutRoutineRecord[]>([]);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutineRecord | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutEntryRecord | null>(null);

  const {
    isActive: hasActiveWorkout,
    openPreStartPicker,
    startFromRoutine,
    setMinimized,
  } = useActiveWorkoutStore();
  const openLogWorkoutModal = useUIStore((s) => s.openLogWorkoutModal);

  const today = useMemo(() => getLocalDateString(), []);
  const storeTodayStats = useHealthStore((s) => s.dailyStatsByDate[today]);
  const storeTodayWorkoutMin = storeTodayStats?.totalWorkoutMin;
  const recentWorkoutsInStore = useHealthStore((s) => s.recentWorkouts);

  const loadFitnessData = useCallback(async () => {
    try {
      const [overviewRes, routinesRes, workoutsRes] = await Promise.all([
        healthService.getFitnessOverview(today).catch(() => null),
        healthService.getRoutines().catch(() => ({ routines: [] })),
        healthService.getRecentWorkouts(30).catch(() => ({ workouts: [] })),
      ]);
      if (overviewRes) setOverview(overviewRes);
      setRoutines(routinesRes.routines || []);
      setHistoryWorkouts(workoutsRes.workouts || []);
    } finally {
      setLoading(false);
    }
  }, [today]);

  // Initial load + delayed sync when optimistic store updates settle in DB
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

  const handleStartRoutine = (routine: WorkoutRoutineRecord) => {
    if (hasActiveWorkout) {
      toast('Ya tienes una sesión abierta.');
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
      openLogWorkoutModal();
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

  // Combine optimistic client minutes with server overview so progress updates at 0ms
  const todayMinutes = Math.max(
    overview?.todayMinutes ?? 0,
    storeTodayStats?.totalWorkoutMin ?? 0
  );
  const requiredMin = overview?.requiredWorkoutMin ?? 45;
  const progressPct = Math.min(100, Math.round((todayMinutes / requiredMin) * 100));
  const dailyDone = todayMinutes >= requiredMin;

  const maxMuscleSets = useMemo(() => {
    if (!overview?.muscleDistribution?.length) return 1;
    return Math.max(1, ...overview.muscleDistribution.map((m) => m.sets));
  }, [overview]);

  const hasSavedRoutines = routines.length > 0;

  return (
    <AuthGuard>
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-6">
        {/* Top Hub Header + History Icon Shortcut */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-400">
              Entrenamiento diario
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">
              {showHistory ? 'Historial' : 'Fitness'}
            </h1>
          </div>

          {showHistory ? (
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3.5 text-xs font-bold text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              aria-label="Ver historial de entrenamientos"
              title="Historial"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/90 text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white active:scale-95"
            >
              <History className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* MAIN VIEW: ENTRENAR */}
        {!showHistory && (
          <div className="space-y-6">
            {/* Compact 75 Days Goal Bar + 2 Clear Everyday Paths */}
            <section className="rounded-3xl border border-zinc-800/90 bg-zinc-900/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      dailyDone
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-600/15 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {dailyDone ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Flame className="h-5 w-5" />
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-zinc-400">Meta de hoy</p>
                    <p className="text-base font-bold text-white tabular-nums">
                      {todayMinutes} / {requiredMin} min
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                    dailyDone
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  {dailyDone ? 'Cumplido' : `Faltan ${requiredMin - todayMinutes} min`}
                </span>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    dailyDone ? 'bg-emerald-500' : 'bg-rose-600'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Single primary CTA: Start or resume a live workout */}
              <button
                type="button"
                onClick={handleStartFree}
                className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl bg-rose-600 px-4 py-3 text-left text-[#ffffff] shadow-lg shadow-rose-600/20 transition-transform active:scale-[0.98] hover:bg-rose-700"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <Play className="h-4 w-4 fill-current" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold leading-tight">
                      {hasActiveWorkout ? 'Seguir sesión en vivo' : 'Iniciar sesión en vivo'}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-white/85">
                      {hasActiveWorkout
                        ? 'Volver al cronómetro activo'
                        : 'Cronómetro, series y descanso en tiempo real'}
                    </span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/80" />
              </button>
            </section>

            {/* Clearly separated secondary path: Log a past / already-finished workout */}
            <button
              type="button"
              onClick={() => openLogWorkoutModal()}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/50 px-4 py-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900 active:scale-[0.99]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 dark:text-amber-400">
                  <History className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-bold text-white">
                    ¿Ya entrenaste antes? Registrar actividad pasada
                  </span>
                  <span className="mt-0.5 block text-[11px] text-zinc-400">
                    Cargar cardio, deporte o una sesión que ya terminaste
                  </span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
            </button>

            {/* Saved Routines (only shown when user has created routines) */}
            {hasSavedRoutines && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">Mis rutinas</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRoutine(null);
                      setBuilderOpen(true);
                    }}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600/15 px-3 text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-600 hover:text-[#ffffff] active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva rutina
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {routines.map((routine) => (
                    <article
                      key={routine.id}
                      className="flex flex-col justify-between rounded-3xl border border-zinc-800/90 bg-zinc-900/60 p-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-white">
                              {routine.name}
                            </h3>
                            {routine.description && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
                                {routine.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoutine(routine);
                                setBuilderOpen(true);
                              }}
                              aria-label={`Editar ${routine.name}`}
                              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRoutine(routine.id)}
                              aria-label={`Eliminar ${routine.name}`}
                              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                          {routine.exercises.map((e) => e.exerciseName).join(' · ')}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-zinc-400 tabular-nums">
                          {routine.exercises.length}{' '}
                          {routine.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartRoutine(routine)}
                          className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-700/70 bg-zinc-800 px-4 text-xs font-bold text-white transition-transform active:scale-95 hover:bg-zinc-700"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          Empezar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Starter Templates — immediately visible above the fold for new users */}
            <section className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-white">
                    {hasSavedRoutines ? 'Plantillas sugeridas' : 'Rutinas listas para hoy'}
                  </h2>
                  {!hasSavedRoutines && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRoutine(null);
                        setBuilderOpen(true);
                      }}
                      className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs font-bold text-white transition-colors hover:border-rose-600/50 active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      Crear mía
                    </button>
                  )}
                </div>
                {!hasSavedRoutines && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Elige una para empezar en 1 toque o arma la tuya.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {STARTER_ROUTINES.map((tpl) => (
                  <article
                    key={tpl.id}
                    className="flex flex-col justify-between rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-white">{tpl.name}</h3>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRoutine(tpl);
                            setBuilderOpen(true);
                          }}
                          aria-label={`Personalizar ${tpl.name}`}
                          title="Personalizar y guardar como propia"
                          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">{tpl.description}</p>
                      <ul className="mt-3 space-y-1 text-[11px] text-zinc-300">
                        {tpl.exercises.map((ex) => (
                          <li key={ex.exerciseId} className="truncate">
                            · {ex.exerciseName}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartRoutine(tpl)}
                      className="mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-zinc-700/70 bg-zinc-800 text-xs font-bold text-white transition-transform active:scale-[0.98] hover:bg-zinc-700"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Empezar rutina
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* HISTORIAL Y PROGRESO */}
        {showHistory && (
          <div className="space-y-6">
            {/* Weekly Metrics */}
            <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4">
                <p className="text-[11px] font-medium text-zinc-400">Sesiones (7 días)</p>
                <p className="mt-1 text-2xl font-bold text-white tabular-nums">
                  {overview?.weekly.workouts ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4">
                <p className="text-[11px] font-medium text-zinc-400">Minutos (7 días)</p>
                <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {overview?.weekly.minutes ?? 0}m
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4">
                <p className="text-[11px] font-medium text-zinc-400">Peso movido</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {overview?.weekly.volumeKg ?? 0} <span className="text-xs font-medium">kg</span>
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4">
                <p className="text-[11px] font-medium text-zinc-400">Calorías est.</p>
                <p className="mt-1 text-2xl font-bold text-amber-500 dark:text-amber-400 tabular-nums">
                  {overview?.weekly.caloriesBurned ?? 0}
                </p>
              </div>
            </section>

            {/* Muscle Distribution & Top PRs */}
            {overview &&
              (overview.muscleDistribution.length > 0 || overview.topLifts.length > 0) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {overview.muscleDistribution.length > 0 && (
                    <section className="rounded-3xl border border-zinc-800/90 bg-zinc-900/60 p-4">
                      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
                        <Activity className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        Series por músculo (7 días)
                      </h2>
                      <div className="mt-3 space-y-2.5">
                        {overview.muscleDistribution.map((item) => (
                          <div key={item.muscle}>
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-zinc-200">
                                {formatMuscleLabel(item.muscle)}
                              </span>
                              <span className="font-bold text-zinc-400 tabular-nums">
                                {item.sets} {item.sets === 1 ? 'serie' : 'series'}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-rose-600"
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
                    <section className="rounded-3xl border border-zinc-800/90 bg-zinc-900/60 p-4">
                      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
                        <Award className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                        Tus mejores pesos (30 días)
                      </h2>
                      <ul className="mt-3 space-y-2">
                        {overview.topLifts.map((lift) => (
                          <li
                            key={lift.exerciseId}
                            className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950/60 px-3 py-2 text-xs"
                          >
                            <span className="truncate font-semibold text-white">
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

            {/* Timeline of Recent Workouts */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-white">Sesiones recientes</h2>
              {loading ? (
                <div className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60" />
              ) : historyWorkouts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center">
                  <p className="text-sm font-semibold text-white">
                    Aún no tienes entrenamientos registrados
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Empieza tu primera sesión desde Entrenar o anota una actividad rápida.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {historyWorkouts.map((workout) => (
                    <article
                      key={workout.id}
                      className="flex items-center gap-1 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-1.5 transition-transform duration-100 ease-out has-[button[data-session-trigger]:active]:scale-[0.985]"
                    >
                      <button
                        type="button"
                        data-session-trigger
                        onClick={() => setSelectedWorkout(workout)}
                        className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left touch-manipulation select-none sm:hover:bg-zinc-800/45"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-white">
                              {workout.title || SPORT_LABELS_ES[workout.sport] || workout.sport}
                            </h3>
                            {workout.source === 'strava' && (
                              <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-500 dark:text-orange-400">
                                Strava
                              </span>
                            )}
                            {workout.source === 'tracker' && (
                              <span className="rounded-md bg-rose-600/15 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                Sesión guiada
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400 tabular-nums">
                            <span>{workout.date}</span>
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

                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteWorkout(workout.id)}
                        aria-label="Eliminar entrenamiento"
                        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-500 transition-transform duration-100 ease-out active:scale-95 touch-manipulation select-none sm:hover:bg-red-500/10 sm:hover:text-red-400"
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
    </AuthGuard>
  );
}

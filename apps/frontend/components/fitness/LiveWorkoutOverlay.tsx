'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  Bike,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Minus,
  Pencil,
  Plus,
  Smartphone,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  Waves,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useActiveWorkoutStore } from '@/store/useActiveWorkoutStore';
import { estimateWorkoutCaloriesClient, useHealthStore } from '@/store/useHealthStore';
import { useWakeLock } from '@/hooks/useWakeLock';
import { healthService, WorkoutEntryRecord } from '@/lib/api/health';
import type { CatalogExercise } from '@/lib/api/exerciseCatalog';
import { getLocalDateString } from '@/lib/utils/date';
import { formatDurationClock, formatMuscleLabel } from '@/lib/constants/fitness';
import ExerciseCatalogBrowser from './ExerciseCatalogBrowser';

function playRestCompleteCue() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([120, 70, 120]);
    }
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio feedback is best-effort
  }
}

const SET_TYPE_CYCLE: Array<'normal' | 'warmup' | 'dropset' | 'failure'> = [
  'normal',
  'warmup',
  'dropset',
  'failure',
];

const SET_TYPE_NAME: Record<string, string> = {
  normal: 'Serie normal',
  warmup: 'Calentamiento (W)',
  dropset: 'Dropset (D)',
  failure: 'Al fallo (F)',
};

function getSetBadge(setType: string, setNumber: number) {
  if (setType === 'warmup')
    return { label: 'W', cls: 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30' };
  if (setType === 'dropset')
    return { label: 'D', cls: 'bg-sky-500/15 text-sky-500 dark:text-sky-400 border-sky-500/30' };
  if (setType === 'failure')
    return { label: 'F', cls: 'bg-rose-600/15 text-rose-600 dark:text-rose-400 border-rose-600/30' };
  return { label: String(setNumber), cls: 'bg-zinc-900 text-zinc-200 border-zinc-800' };
}

const CARDIO_QUICK_ACTIVITIES = [
  { sport: 'walking', label: 'Caminar', subtitle: 'Paseo o caminata rápida', icon: Activity },
  { sport: 'running', label: 'Trotar / Correr', subtitle: 'Aire libre o cinta', icon: Footprints },
  { sport: 'cycling', label: 'Ciclismo', subtitle: 'Bici de calle o fija', icon: Bike },
  { sport: 'swimming', label: 'Natación', subtitle: 'Piscina o aguas abiertas', icon: Waves },
  { sport: 'yoga', label: 'Yoga / Movilidad', subtitle: 'Estiramiento y core', icon: Sparkles },
  { sport: 'other', label: 'Actividad libre', subtitle: 'Fútbol, baile, deporte...', icon: Flame },
] as const;

export default function LiveWorkoutOverlay() {
  const {
    isActive,
    isMinimized,
    isPreStartPickerOpen,
    sessionMode,
    startedAt,
    title,
    sport,
    intensity,
    distanceKm,
    notes,
    exercises,
    restEndsAt,
    restDurationSec,
    keepScreenAwake,
    closePreStartPicker,
    startCardioWorkout,
    startFreeWorkout,
    setMinimized,
    setTitle,
    setIntensity,
    setDistanceKm,
    setNotes,
    setKeepScreenAwake,
    addExercises,
    removeExercise,
    updateExerciseRest,
    addSet,
    removeSet,
    updateSet,
    toggleSetComplete,
    hydratePreviousSets,
    adjustRestTimer,
    clearRestTimer,
    discardWorkout,
    buildSubmissionPayload,
  } = useActiveWorkoutStore();

  const fetchProfileBundle = useHealthStore((s) => s.fetchProfileBundle);
  const profileData = useHealthStore((s) => s.profileData);

  const [now, setNow] = useState(() => Date.now());
  const [preStartTab, setPreStartTab] = useState<'cardio' | 'strength'>('cardio');
  const [preStartTitle, setPreStartTitle] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);
  const [overrideDurationMin, setOverrideDurationMin] = useState<number>(1);
  const [isFinishing, setIsFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<WorkoutEntryRecord | null>(null);

  const hydratedIdsRef = useRef<Set<string>>(new Set());
  const restNotifiedRef = useRef<number | null>(null);

  const isVisible = isActive && !isMinimized;
  const wakeLock = useWakeLock(isVisible && keepScreenAwake);

  useEffect(() => {
    if (!isActive) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    if (!isVisible && !completedSummary && !isPreStartPickerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isVisible, completedSummary, isPreStartPickerOpen]);

  useEffect(() => {
    if (!isPreStartPickerOpen) return;
    setPreStartTitle('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreStartPicker();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isPreStartPickerOpen, closePreStartPicker]);

  useEffect(() => {
    if (!isActive || exercises.length === 0) return;
    const missingIds = [
      ...new Set(
        exercises
          .map((e) => e.exerciseId)
          .filter((id) => !hydratedIdsRef.current.has(id))
      ),
    ];
    if (missingIds.length === 0) return;

    missingIds.forEach((id) => hydratedIdsRef.current.add(id));

    healthService
      .getLastSetsBatch(missingIds)
      .then((res) => {
        if (res?.lastByExercise) {
          hydratePreviousSets(res.lastByExercise);
        }
      })
      .catch(() => {});
  }, [isActive, exercises, hydratePreviousSets]);

  useEffect(() => {
    if (!isActive) {
      hydratedIdsRef.current.clear();
      setConfirmDiscard(false);
      setIsFinishConfirmOpen(false);
    }
  }, [isActive]);

  const restRemainingSec = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (restEndsAt && restRemainingSec === 0 && restNotifiedRef.current !== restEndsAt) {
      restNotifiedRef.current = restEndsAt;
      playRestCompleteCue();
      toast.success('¡Descanso terminado! Siguiente serie', { duration: 2500 });
      clearRestTimer();
    }
  }, [restEndsAt, restRemainingSec, clearRestTimer]);

  const elapsedSec = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const elapsedMin = Math.floor(elapsedSec / 60);

  const liveMetrics = useMemo(() => {
    let completedSets = 0;
    let totalSets = 0;
    let volumeKg = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        totalSets += 1;
        if (s.completed) {
          completedSets += 1;
          if (s.setType !== 'warmup') {
            const w = Number(s.weightKg) || 0;
            const r = Number(s.reps) || 0;
            if (w > 0 && r > 0) volumeKg += w * r;
          }
        }
      }
    }
    return {
      completedSets,
      totalSets,
      volumeKg: Math.round(volumeKg),
    };
  }, [exercises]);

  const handleAddPicked = (picked: CatalogExercise[]) => {
    addExercises(
      picked.map((ex) => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        primaryMuscle: ex.primaryMuscle,
        equipment: ex.equipment,
        targetSets: 3,
        defaultRestSec: 90,
      }))
    );
    setIsPickerOpen(false);
  };

  const handleOpenFinishConfirm = () => {
    const today = getLocalDateString();
    const previewPayload = buildSubmissionPayload(today);
    const hasExercisesLogged = Boolean(previewPayload.exercises && previewPayload.exercises.length > 0);
    if (sessionMode !== 'cardio' && !hasExercisesLogged && elapsedSec < 30) {
      toast.error('Marca al menos una serie antes de terminar.');
      return;
    }
    setOverrideDurationMin(Math.max(1, Math.round(elapsedSec / 60) || 1));
    setIsFinishConfirmOpen(true);
  };

  const handleConfirmFinish = async () => {
    const today = getLocalDateString();
    const payload = {
      ...buildSubmissionPayload(today),
      durationMin: Math.max(1, Math.min(1440, Math.round(overrideDurationMin) || 1)),
    };

    setIsFinishing(true);
    try {
      const saved = await healthService.logWorkout(payload);
      setIsFinishConfirmOpen(false);
      discardWorkout();
      setCompletedSummary(saved);
      void fetchProfileBundle(today, { skipCoreProfile: true });
    } catch {
      toast.error('No se pudo guardar el entrenamiento. Reintenta.');
    } finally {
      setIsFinishing(false);
    }
  };

  // Post-workout celebration summary (Peak-End Rule)
  if (completedSummary) {
    const prs = completedSummary.personalRecords || [];
    const meetsChallenge = completedSummary.durationMin >= 45;
    return (
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-complete-title"
      >
        <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 dark:text-emerald-400">
            <Trophy className="h-8 w-8" />
          </div>
          <h2
            id="workout-complete-title"
            className="mt-4 text-center text-2xl font-bold tracking-tight text-white"
          >
            ¡Entrenamiento guardado!
          </h2>
          <p className="mt-1 text-center text-sm text-zinc-400">
            {completedSummary.title || 'Sesión de fuerza'}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 text-center">
              <Clock className="mx-auto h-4 w-4 text-rose-600 dark:text-rose-400" />
              <p className="mt-1 text-lg font-bold text-white tabular-nums">
                {completedSummary.durationMin}m
              </p>
              <p className="text-[11px] text-zinc-400">Duración</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 text-center">
              <Dumbbell className="mx-auto h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <p className="mt-1 text-lg font-bold text-white tabular-nums">
                {Math.round(completedSummary.loadVolumeKg || 0)}
              </p>
              <p className="text-[11px] text-zinc-400">Peso movido (kg)</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 text-center">
              <Flame className="mx-auto h-4 w-4 text-amber-500 dark:text-amber-400" />
              <p className="mt-1 text-lg font-bold text-white tabular-nums">
                {Math.round(completedSummary.caloriesBurned)}
              </p>
              <p className="text-[11px] text-zinc-400">kcal est.</p>
            </div>
          </div>

          {meetsChallenge && (
            <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
              Meta diaria de 45 min del reto 75 Days cumplida hoy.
            </div>
          )}

          {prs.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                <Award className="h-4 w-4" />
                {prs.length === 1
                  ? '¡Nuevo récord personal!'
                  : `¡${prs.length} nuevos récords personales!`}
              </p>
              <ul className="mt-2 space-y-1.5">
                {prs.map((pr) => (
                  <li
                    key={pr.exerciseId}
                    className="flex items-center justify-between text-xs text-white"
                  >
                    <span className="truncate font-medium">{pr.exerciseName}</span>
                    <span className="ml-2 shrink-0 font-bold text-amber-500 dark:text-amber-300 tabular-nums">
                      {pr.previousBest} → {pr.newBest} kg
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCompletedSummary(null)}
            className="mt-6 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-rose-600 text-sm font-bold text-[#ffffff] shadow-lg shadow-rose-600/20 transition-transform active:scale-[0.98] hover:bg-rose-700"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // Pre-start general exercise picker (triggered when pressing "Entrenar ahora")
  if (isPreStartPickerOpen && !isActive) {
    const handleConfirmPreStart = (picked: CatalogExercise[]) => {
      const uniqueZones = [...new Set(picked.map((ex) => ex.bodyZoneLabel))].slice(0, 2);
      const autoTitle =
        preStartTitle.trim() ||
        (uniqueZones.length > 0 ? `Sesión de ${uniqueZones.join(' y ')}` : 'Entrenamiento de hoy');

      startFreeWorkout(
        picked.map((ex) => ({
          exerciseId: ex.id,
          exerciseName: ex.name,
          primaryMuscle: ex.primaryMuscle,
          equipment: ex.equipment,
          targetSets: 3,
          defaultRestSec: 90,
        })),
        autoTitle
      );
    };

    return (
      <div
        className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 backdrop-blur-xs sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prestart-picker-title"
        onClick={closePreStartPicker}
      >
        <div
          className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-zinc-900 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-400">
                Preparar sesión
              </p>
              <h2
                id="prestart-picker-title"
                className="mt-0.5 text-lg font-bold text-white"
              >
                ¿Qué vas a hacer hoy?
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Elige una actividad simple sin equipo o selecciona ejercicios de fuerza.
              </p>
            </div>
            <button
              type="button"
              onClick={closePreStartPicker}
              aria-label="Cerrar selector de ejercicios"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode switch: Simple / Cardio vs Gym / Exercises */}
          <div className="border-b border-zinc-900 bg-zinc-900/40 px-5 py-3 space-y-2.5">
            <div
              role="tablist"
              aria-label="Tipo de entrenamiento"
              className="grid grid-cols-2 gap-1 rounded-2xl border border-zinc-800 bg-zinc-950 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={preStartTab === 'cardio'}
                onClick={() => setPreStartTab('cardio')}
                className={`min-h-10 cursor-pointer rounded-xl text-xs font-bold transition-colors ${
                  preStartTab === 'cardio'
                    ? 'bg-rose-600 text-[#ffffff]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sin equipo / Cardio
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={preStartTab === 'strength'}
                onClick={() => setPreStartTab('strength')}
                className={`min-h-10 cursor-pointer rounded-xl text-xs font-bold transition-colors ${
                  preStartTab === 'strength'
                    ? 'bg-rose-600 text-[#ffffff]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Fuerza / Ejercicios
              </button>
            </div>

            {preStartTab === 'strength' && (
              <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 focus-within:border-rose-500">
                <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <input
                  type="text"
                  maxLength={120}
                  value={preStartTitle}
                  onChange={(e) => setPreStartTitle(e.target.value)}
                  placeholder="Nombre de la sesión (opcional, ej: Pecho y bíceps)"
                  aria-label="Nombre opcional de la sesión"
                  className="w-full bg-transparent text-xs font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                />
              </label>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            {preStartTab === 'cardio' ? (
              <div className="space-y-3">
                <p className="px-1 text-xs text-zinc-400">
                  Toca una actividad para iniciar el cronómetro en vivo sin máquinas ni series.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {CARDIO_QUICK_ACTIVITIES.map((act) => {
                    const Icon = act.icon;
                    return (
                      <button
                        key={act.sport}
                        type="button"
                        onClick={() => startCardioWorkout(act.sport, act.label)}
                        className="flex min-h-[88px] cursor-pointer flex-col items-start justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5 text-left transition-colors hover:border-rose-600/60 hover:bg-zinc-900 active:scale-[0.98]"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600/15 text-rose-700 dark:text-rose-400">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="mt-2">
                          <p className="text-sm font-bold text-white">{act.label}</p>
                          <p className="text-[11px] text-zinc-400">{act.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <ExerciseCatalogBrowser
                mode="picker"
                onConfirmSelection={handleConfirmPreStart}
                confirmLabel={(count) =>
                  count > 0
                    ? `Empezar entrenamiento (${count})`
                    : 'Elige al menos 1 ejercicio'
                }
                secondaryAction={{
                  label: 'Empezar vacío',
                  onClick: () => startFreeWorkout([], preStartTitle.trim() || 'Entrenamiento libre'),
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isVisible) return null;

  const restProgressPct =
    restEndsAt && restDurationSec > 0
      ? Math.min(100, Math.max(0, (restRemainingSec / restDurationSec) * 100))
      : 0;

  return (
    <div
      className="fixed inset-0 z-[115] flex h-[100dvh] flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Entrenamiento en vivo"
    >
      {/* Top immersive sticky bar (div instead of header to avoid duplicate banner landmark) */}
      <div className="shrink-0 border-b border-zinc-900 bg-zinc-950/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimizar entrenamiento"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition-transform active:scale-95 hover:bg-zinc-800"
          >
            <ChevronDown className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-white tabular-nums">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {formatDurationClock(elapsedSec)}
            </span>
            <span className="text-[11px] font-medium text-zinc-400 tabular-nums">
              {elapsedMin}/45 min · {liveMetrics.volumeKg} kg
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenFinishConfirm}
            disabled={isFinishing}
            className="min-h-11 cursor-pointer rounded-full bg-emerald-700 px-4 text-xs font-bold text-[#ffffff] shadow-lg shadow-emerald-700/20 transition-transform active:scale-95 hover:bg-emerald-800 disabled:opacity-50"
          >
            Terminar
          </button>
        </div>

        {/* Editable session title + explicit screen-awake control */}
        <div className="mx-auto mt-3 flex max-w-2xl items-center justify-between gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-zinc-800/70 bg-zinc-900/50 px-3 py-1.5 focus-within:border-rose-500">
            <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              aria-label="Título del entrenamiento"
              className="min-h-7 min-w-0 flex-1 bg-transparent text-sm font-bold text-white placeholder:text-zinc-500 focus:outline-none"
              placeholder="Nombre de tu sesión..."
            />
          </label>

          {wakeLock.isSupported && (
            <button
              type="button"
              onClick={() => {
                const next = !keepScreenAwake;
                setKeepScreenAwake(next);
                toast(
                  next
                    ? 'Pantalla siempre encendida activada'
                    : 'Pantalla siempre encendida desactivada',
                  { duration: 1800 }
                );
              }}
              aria-pressed={keepScreenAwake}
              className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold transition-colors active:scale-95 ${
                keepScreenAwake
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>{keepScreenAwake ? 'Pantalla ON' : 'Pantalla OFF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main scrollable workout log */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4 pb-28">
          {sessionMode === 'cardio' && exercises.length === 0 ? (
            <section className="space-y-4">
              {/* Live Cardio / No-Equipment Immersion Card */}
              <div className="rounded-3xl border border-zinc-800/90 bg-zinc-900/60 p-6 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-400">
                  Actividad en curso
                </p>
                <p className="mt-2 text-5xl font-bold tracking-tight text-white tabular-nums">
                  {formatDurationClock(elapsedSec)}
                </p>
                <p className="mt-1.5 text-xs font-medium text-zinc-400 tabular-nums">
                  {elapsedMin} / 45 min para la meta de hoy · ~
                  {Math.round(
                    estimateWorkoutCaloriesClient(
                      sport,
                      Math.max(1, elapsedSec / 60),
                      intensity,
                      Number(profileData?.user?.currentWeight) || 70,
                      Number(profileData?.user?.height) || 170
                    )
                  )}{' '}
                  kcal
                </p>

                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      elapsedMin >= 45 ? 'bg-emerald-500' : 'bg-rose-600'
                    }`}
                    style={{ width: `${Math.min(100, Math.round((elapsedMin / 45) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Intensity + optional distance + notes */}
              <div className="space-y-4 rounded-3xl border border-zinc-800/90 bg-zinc-900/60 p-4">
                <div>
                  <span className="mb-2 block text-xs font-semibold text-zinc-400">
                    Intensidad percibida
                  </span>
                  <div className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
                    {(
                      [
                        { value: 'low', label: 'Suave' },
                        { value: 'medium', label: 'Moderada' },
                        { value: 'high', label: 'Intensa' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setIntensity(opt.value)}
                        className={`min-h-10 cursor-pointer rounded-xl text-xs font-bold transition-colors ${
                          intensity === opt.value
                            ? 'bg-rose-600 text-[#ffffff]'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {sport !== 'yoga' && (
                  <div>
                    <label
                      htmlFor="cardio-distance-input"
                      className="mb-1.5 block text-xs font-semibold text-zinc-400"
                    >
                      Distancia recorrida (km · opcional)
                    </label>
                    <input
                      id="cardio-distance-input"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="Ej: 4.5"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm font-semibold text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="cardio-notes-input"
                    className="mb-1.5 block text-xs font-semibold text-zinc-400"
                  >
                    Notas (opcional)
                  </label>
                  <textarea
                    id="cardio-notes-input"
                    rows={2}
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Caminata por el parque a buen ritmo..."
                    className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 text-xs font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white"
              >
                <Plus className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                ¿También harás ejercicios de fuerza? Añadir del catálogo
              </button>
            </section>
          ) : exercises.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
              <Dumbbell className="mx-auto h-10 w-10 text-rose-600 dark:text-rose-400" />
              <h3 className="mt-3 text-base font-bold text-white">
                Añade tu primer ejercicio
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                Elige del catálogo de 876 ejercicios. Guardaremos tus pesos para sugerírtelos la próxima vez.
              </p>
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="mt-5 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl bg-rose-600 px-6 text-sm font-bold text-[#ffffff] shadow-lg shadow-rose-600/25 active:scale-95 hover:bg-rose-700"
              >
                <Plus className="h-4 w-4" />
                Elegir ejercicios
              </button>
            </div>
          ) : (
            exercises.map((exercise) => (
              <section
                key={exercise.uid}
                className="rounded-3xl border border-zinc-800/90 bg-zinc-900/60 p-4"
              >
                {/* Exercise card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold leading-snug text-white">
                      {exercise.exerciseName}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span>{formatMuscleLabel(exercise.primaryMuscle)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const presets = [60, 90, 120, 150, 180];
                          const idx = presets.indexOf(exercise.restSec);
                          const next = presets[(idx + 1) % presets.length];
                          updateExerciseRest(exercise.uid, next);
                          toast(`Descanso ajustado a ${next}s`, { duration: 1400 });
                        }}
                        className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/80 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-700 tabular-nums"
                      >
                        <Timer className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        Descanso {exercise.restSec}s
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExercise(exercise.uid)}
                    aria-label={`Quitar ${exercise.exerciseName}`}
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Sets grid */}
                <div className="mt-3.5 space-y-2">
                  <div className="grid grid-cols-[42px_1fr_76px_68px_44px] items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <span className="text-center">Serie</span>
                    <span>Anterior</span>
                    <span className="text-center">kg</span>
                    <span className="text-center">Reps</span>
                    <span className="text-center">Hecho</span>
                  </div>

                  {exercise.sets.map((s) => {
                    const badge = getSetBadge(s.setType, s.setNumber);
                    return (
                      <div
                        key={s.id}
                        className={`grid grid-cols-[42px_1fr_76px_68px_44px] items-center gap-2 rounded-2xl p-1 transition-colors ${
                          s.completed ? 'bg-emerald-500/10' : 'bg-zinc-950/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const nextType =
                              SET_TYPE_CYCLE[
                                (SET_TYPE_CYCLE.indexOf(s.setType) + 1) % SET_TYPE_CYCLE.length
                              ];
                            updateSet(exercise.uid, s.id, { setType: nextType });
                            toast(SET_TYPE_NAME[nextType], { duration: 1200 });
                          }}
                          aria-label={`Tipo de serie ${s.setNumber}: ${SET_TYPE_NAME[s.setType]}`}
                          className={`flex h-11 w-[42px] cursor-pointer items-center justify-center rounded-xl border text-xs font-bold tabular-nums transition-transform active:scale-95 ${badge.cls}`}
                        >
                          {badge.label}
                        </button>

                        {s.previousLabel ? (
                          <button
                            type="button"
                            onClick={() => {
                              updateSet(exercise.uid, s.id, {
                                weightKg:
                                  s.previousWeightKg != null
                                    ? String(s.previousWeightKg)
                                    : s.weightKg,
                                reps: s.previousReps != null ? String(s.previousReps) : s.reps,
                              });
                            }}
                            className="min-h-10 cursor-pointer truncate rounded-lg px-1 text-left text-xs font-medium text-zinc-300 tabular-nums hover:bg-zinc-900"
                          >
                            {s.previousLabel}
                          </button>
                        ) : (
                          <span className="px-1 text-xs text-zinc-500" aria-hidden="true">
                            —
                          </span>
                        )}

                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min="0"
                          placeholder={
                            s.previousWeightKg != null ? String(s.previousWeightKg) : '—'
                          }
                          value={s.weightKg}
                          onChange={(e) =>
                            updateSet(exercise.uid, s.id, { weightKg: e.target.value })
                          }
                          aria-label={`Peso kg serie ${s.setNumber}`}
                          className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-2 text-center text-sm font-bold text-white tabular-nums placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                        />

                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          placeholder={s.previousReps != null ? String(s.previousReps) : '—'}
                          value={s.reps}
                          onChange={(e) =>
                            updateSet(exercise.uid, s.id, { reps: e.target.value })
                          }
                          aria-label={`Repeticiones serie ${s.setNumber}`}
                          className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-2 text-center text-sm font-bold text-white tabular-nums placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => toggleSetComplete(exercise.uid, s.id)}
                          aria-label={
                            s.completed
                              ? `Desmarcar serie ${s.setNumber}`
                              : `Completar serie ${s.setNumber}`
                          }
                          aria-pressed={s.completed}
                          className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-transform active:scale-90 ${
                            s.completed
                              ? 'bg-emerald-700 text-[#ffffff] shadow-md shadow-emerald-700/25'
                              : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
                          }`}
                        >
                          <Check className="h-5 w-5" strokeWidth={2.8} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add / remove set footer */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addSet(exercise.uid)}
                    className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/70 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900 active:scale-[0.98]"
                  >
                    <Plus className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                    Añadir serie
                  </button>
                  {exercise.sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        removeSet(exercise.uid, exercise.sets[exercise.sets.length - 1].id)
                      }
                      aria-label="Eliminar última serie"
                      className="flex min-h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:text-red-400"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </section>
            ))
          )}

          {/* Add Exercise + Session Notes + Discard */}
          <div className="space-y-3 pt-1">
            {exercises.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-600/35 bg-rose-600/10 text-sm font-bold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-600/20 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  Añadir ejercicio
                </button>

                <textarea
                  rows={2}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas opcionales de la sesión..."
                  className="w-full resize-none rounded-2xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3 text-xs text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                />
              </>
            )}

            {confirmDiscard ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
                <span className="text-xs font-semibold text-red-500 dark:text-red-300">
                  ¿Descartar este entrenamiento sin guardar?
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDiscard(false)}
                    className="min-h-10 cursor-pointer rounded-xl bg-zinc-900 px-3 text-xs font-semibold text-zinc-300"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      discardWorkout();
                      toast('Entrenamiento descartado');
                    }}
                    className="min-h-10 cursor-pointer rounded-xl bg-red-600 px-3 text-xs font-bold text-[#ffffff]"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-2xl text-xs font-semibold text-zinc-400 hover:bg-red-500/5 hover:text-red-400"
              >
                Descartar entrenamiento
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Rest Timer Pill in Thumb Zone */}
      {restEndsAt && restRemainingSec > 0 && (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md">
          <div className="mx-auto max-w-2xl">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-rose-600 transition-[width] duration-1000 ease-linear"
                style={{ width: `${restProgressPct}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-semibold text-zinc-400">Descanso</span>
                <span className="text-lg font-bold text-white tabular-nums">
                  {formatDurationClock(restRemainingSec)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustRestTimer(-15)}
                  className="min-h-10 cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800 px-2.5 text-xs font-bold text-white active:scale-95"
                >
                  -15s
                </button>
                <button
                  type="button"
                  onClick={() => adjustRestTimer(15)}
                  className="min-h-10 cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800 px-2.5 text-xs font-bold text-white active:scale-95"
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={clearRestTimer}
                  className="min-h-10 cursor-pointer rounded-xl bg-rose-600 px-3 text-xs font-bold text-[#ffffff] active:scale-95"
                >
                  Saltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safe Finish Confirmation Sheet (prevents accidental tap from ending a live workout) */}
      {isFinishConfirmOpen && (
        <div
          className="fixed inset-0 z-[128] flex items-end justify-center bg-black/80 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="finish-confirm-title"
          onClick={() => setIsFinishConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-[28px] border border-zinc-800 bg-zinc-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="finish-confirm-title" className="text-lg font-bold text-white">
              ¿Guardar y terminar sesión?
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              {sessionMode === 'cardio' && exercises.length === 0
                ? `${title || 'Actividad'} · ${formatDurationClock(elapsedSec)} transcurridos.`
                : `Completaste ${liveMetrics.completedSets} de ${liveMetrics.totalSets} series (${liveMetrics.volumeKg} kg).`}
            </p>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
              <span className="text-xs font-semibold text-zinc-300">Duración a guardar (min)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideDurationMin((v) => Math.max(1, v - 5))}
                  aria-label="Restar 5 minutos"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-800 text-white"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1440}
                  value={overrideDurationMin}
                  onChange={(e) => setOverrideDurationMin(Number(e.target.value))}
                  aria-label="Minutos totales"
                  className="w-14 bg-transparent text-center text-base font-bold text-white tabular-nums focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setOverrideDurationMin((v) => Math.min(1440, v + 5))}
                  aria-label="Sumar 5 minutos"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-800 text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsFinishConfirmOpen(false)}
                className="min-h-12 flex-1 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                Seguir entrenando
              </button>
              <button
                type="button"
                disabled={isFinishing}
                onClick={handleConfirmFinish}
                className="min-h-12 flex-1 cursor-pointer rounded-xl bg-emerald-700 text-sm font-bold text-[#ffffff] shadow-lg shadow-emerald-700/20 hover:bg-emerald-800 disabled:opacity-50"
              >
                {isFinishing ? 'Guardando...' : 'Guardar sesión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Picker Modal */}
      {isPickerOpen && (
        <div
          className="fixed inset-0 z-[125] flex items-end justify-center bg-black/80 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Seleccionar ejercicios"
          onClick={() => setIsPickerOpen(false)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-4">
              <h3 className="text-base font-bold text-white">Añadir ejercicios</h3>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                aria-label="Cerrar selector"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4">
              <ExerciseCatalogBrowser
                mode="picker"
                onConfirmSelection={handleAddPicked}
                onClosePicker={() => setIsPickerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

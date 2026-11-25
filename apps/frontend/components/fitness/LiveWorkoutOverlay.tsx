'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Award,
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Home,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  Trees,
  Trophy,
  Waves,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useActiveWorkoutStore } from '@/store/useActiveWorkoutStore';
import { estimateWorkoutCaloriesClient, useHealthStore } from '@/store/useHealthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useWakeLock } from '@/hooks/useWakeLock';
import { healthService, WorkoutEntryRecord } from '@/lib/api/health';
import { loadExerciseCatalog, type CatalogExercise } from '@/lib/api/exerciseCatalog';
import { getLocalDateString } from '@/lib/utils/date';
import { formatDurationClock } from '@/lib/constants/fitness';
import ExerciseCatalogBrowser from './ExerciseCatalogBrowser';
import ExerciseDetailSheet from './ExerciseDetailSheet';
import WorkoutHudHeader from './WorkoutHudHeader';
import ActiveExerciseCard from './ActiveExerciseCard';
import CardioLiveView from './CardioLiveView';
import RestTimerPill from './RestTimerPill';

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

const OUTDOOR_QUICK_ACTIVITIES = [
  { sport: 'walking', label: 'Caminar', subtitle: 'Paseo o caminata al aire libre', icon: Activity },
  { sport: 'running', label: 'Trotar / Correr', subtitle: 'Trote o carrera en calle o parque', icon: Footprints },
  { sport: 'cycling', label: 'Ciclismo', subtitle: 'Bicicleta en ruta o ciudad', icon: Bike },
  { sport: 'swimming', label: 'Natación', subtitle: 'Piscina o aguas abiertas', icon: Waves },
  { sport: 'yoga', label: 'Yoga / Movilidad', subtitle: 'Estiramiento y movilidad al aire libre', icon: Sparkles },
  { sport: 'other', label: 'Actividad libre', subtitle: 'Fútbol, senderismo, patín...', icon: Flame },
] as const;

export default function LiveWorkoutOverlay() {
  const {
    isActive,
    isMinimized,
    isPreStartPickerOpen,
    sessionMode,
    environment,
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
    updateExerciseNotes,
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
  const [preStartStep, setPreStartStep] = useState<'environment' | 'exercise'>('environment');
  const [preStartEnv, setPreStartEnv] = useState<'gym' | 'home' | 'outdoor' | null>(null);
  const [preStartTitle, setPreStartTitle] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);
  const [overrideDurationMin, setOverrideDurationMin] = useState<number>(1);
  const [isFinishing, setIsFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<WorkoutEntryRecord | null>(null);
  const [catalogMap, setCatalogMap] = useState<Map<string, CatalogExercise>>(() => new Map());
  const [imageBaseUrl, setImageBaseUrl] = useState<string | undefined>(undefined);
  const [inspectedExercise, setInspectedExercise] = useState<CatalogExercise | null>(null);

  const hydratedIdsRef = useRef<Set<string>>(new Set());
  const restNotifiedRef = useRef<number | null>(null);

  const isVisible = isActive && !isMinimized;
  const wakeLock = useWakeLock(isVisible && keepScreenAwake);

  useEffect(() => {
    if (!isActive || catalogMap.size > 0) return;
    let cancelled = false;
    loadExerciseCatalog()
      .then((bundle) => {
        if (cancelled) return;
        const map = new Map<string, CatalogExercise>();
        for (const item of bundle.exercises) {
          map.set(item.id, item);
        }
        setCatalogMap(map);
        setImageBaseUrl(bundle.imageBaseUrl);
      })
      .catch(() => {
        // Catalog images are optional during active workout
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, catalogMap.size]);

  useEffect(() => {
    if (!isActive) return;
    const tick = () => setNow(Date.now());
    const initId = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initId);
      window.clearInterval(id);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isVisible && !completedSummary && !isPreStartPickerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isVisible, completedSummary, isPreStartPickerOpen]);

  const handleClosePreStart = () => {
    setPreStartStep('environment');
    setPreStartEnv(null);
    setPreStartTitle('');
    closePreStartPicker();
  };

  useEffect(() => {
    if (!isPreStartPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreStartStep('environment');
        setPreStartEnv(null);
        setPreStartTitle('');
        closePreStartPicker();
      }
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
    }
  }, [isActive]);

  const showConfirmDiscard = isActive && confirmDiscard;
  const showFinishConfirm = isActive && isFinishConfirmOpen;

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
      timezoneOffset: new Date().getTimezoneOffset(),
    };

    setIsFinishing(true);
    try {
      const saved = (await healthService.logWorkout(payload)) as any;
      if (saved?.goalSync) {
        useChallengeStore.getState().applyWorkoutGoalSync(saved.goalSync);
      }
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

      const selectedEnv = preStartEnv ?? 'gym';
      setPreStartStep('environment');
      setPreStartEnv(null);
      setPreStartTitle('');
      startFreeWorkout(
        picked.map((ex) => ({
          exerciseId: ex.id,
          exerciseName: ex.name,
          primaryMuscle: ex.primaryMuscle,
          equipment: ex.equipment,
          targetSets: 3,
          defaultRestSec: 90,
        })),
        autoTitle,
        selectedEnv
      );
    };

    const ENVIRONMENT_CARDS = [
      {
        key: 'gym' as const,
        title: 'En gimnasio',
        description:
          'Máquinas de gimnasio, pesas, chalecos y ejercicios físicos como abdominales o dominadas.',
        icon: Dumbbell,
      },
      {
        key: 'home' as const,
        title: 'En casa',
        description:
          'Ejercicios sin maquinaria: abdominales, plancha, pierna, bandas y peso corporal.',
        icon: Home,
      },
      {
        key: 'outdoor' as const,
        title: 'Al aire libre',
        description: 'Actividades como trotar, caminar, ciclismo, natación y más.',
        icon: Trees,
      },
    ];

    const activeEnvMeta = ENVIRONMENT_CARDS.find((c) => c.key === preStartEnv);

    return (
      <div
        className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 backdrop-blur-xs sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prestart-picker-title"
        onClick={handleClosePreStart}
      >
        <div
          className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-zinc-900 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-400">
                {preStartStep === 'environment'
                  ? 'Paso 1 de 2 · Entorno'
                  : `Paso 2 de 2 · ${activeEnvMeta?.title ?? 'Ejercicios'}`}
              </p>
              <h2
                id="prestart-picker-title"
                className="mt-0.5 text-lg font-bold text-white"
              >
                {preStartStep === 'environment'
                  ? '¿Dónde vas a entrenar hoy?'
                  : preStartEnv === 'outdoor'
                    ? 'Elige tu actividad al aire libre'
                    : 'Elige tus ejercicios'}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                {preStartStep === 'environment'
                  ? 'Primero selecciona el lugar para mostrarte las opciones adecuadas.'
                  : activeEnvMeta?.description}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClosePreStart}
              aria-label="Cerrar selector de ejercicios"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {preStartStep === 'environment' ? (
            <div className="flex-1 overflow-y-auto overscroll-contain p-5">
              <div className="grid gap-3">
                {ENVIRONMENT_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => {
                        setPreStartEnv(card.key);
                        setPreStartStep('exercise');
                      }}
                      className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-left transition-all hover:border-rose-600/60 hover:bg-zinc-900 active:scale-[0.99]"
                    >
                      <div className="flex items-start gap-3.5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600/15 text-rose-500 transition-colors group-hover:bg-rose-600 group-hover:text-white">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-base font-bold text-white">{card.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                            {card.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-zinc-900 bg-zinc-900/40 px-5 py-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreStartStep('environment')}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Cambiar entorno</span>
                  </button>
                  {activeEnvMeta && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-600/40 bg-rose-600/15 px-3 py-1 text-xs font-bold text-rose-400">
                      <activeEnvMeta.icon className="h-3.5 w-3.5" />
                      {activeEnvMeta.title}
                    </span>
                  )}
                </div>

                {preStartEnv !== 'outdoor' && (
                  <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 focus-within:border-rose-500">
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <input
                      type="text"
                      maxLength={120}
                      value={preStartTitle}
                      onChange={(e) => setPreStartTitle(e.target.value)}
                      placeholder={
                        preStartEnv === 'home'
                          ? 'Nombre de la sesión (opcional, ej: Full body en casa)'
                          : 'Nombre de la sesión (opcional, ej: Pecho y bíceps)'
                      }
                      aria-label="Nombre opcional de la sesión"
                      className="w-full bg-transparent text-xs font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                    />
                  </label>
                )}
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-4">
                {preStartEnv === 'outdoor' ? (
                  <div className="space-y-3">
                    <p className="px-1 text-xs text-zinc-400">
                      Toca una actividad al aire libre para iniciar el cronómetro en vivo sin máquinas ni series.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {OUTDOOR_QUICK_ACTIVITIES.map((act) => {
                        const Icon = act.icon;
                        return (
                          <button
                            key={act.sport}
                            type="button"
                            onClick={() => {
                              setPreStartStep('environment');
                              setPreStartEnv(null);
                              startCardioWorkout(act.sport, act.label);
                            }}
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
                    key={preStartEnv}
                    mode="picker"
                    environment={preStartEnv ?? 'gym'}
                    onConfirmSelection={handleConfirmPreStart}
                    confirmLabel={(count) =>
                      count > 0
                        ? `Empezar entrenamiento (${count})`
                        : 'Elige al menos 1 ejercicio'
                    }
                    secondaryAction={{
                      label: 'Empezar vacío',
                      onClick: () => {
                        const selectedEnv = preStartEnv ?? 'gym';
                        const envTitle =
                          selectedEnv === 'home'
                            ? 'Entrenamiento en casa'
                            : 'Entrenamiento en gimnasio';
                        setPreStartStep('environment');
                        setPreStartEnv(null);
                        startFreeWorkout([], preStartTitle.trim() || envTitle, selectedEnv);
                      },
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!isVisible) return null;

  const estimatedKcal = Math.round(
    estimateWorkoutCaloriesClient(
      sport,
      Math.max(1, elapsedSec / 60),
      intensity,
      Number(profileData?.user?.currentWeight) || 70,
      Number(profileData?.user?.height) || 170
    )
  );

  const focusedExercise =
    exercises.find((ex) => ex.sets.some((s) => !s.completed)) || exercises[0] || null;
  const focusedExerciseUid = focusedExercise?.uid ?? null;

  let nextSetPreview: { exerciseName: string; setNumber: number } | null = null;
  for (const ex of exercises) {
    const pendingSet = ex.sets.find((s) => !s.completed);
    if (pendingSet) {
      nextSetPreview = { exerciseName: ex.exerciseName, setNumber: pendingSet.setNumber };
      break;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[115] flex h-[100dvh] flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Entrenamiento en vivo"
    >
      <WorkoutHudHeader
        elapsedSec={elapsedSec}
        elapsedMin={elapsedMin}
        estimatedKcal={estimatedKcal}
        completedSets={liveMetrics.completedSets}
        totalSets={liveMetrics.totalSets}
        volumeKg={liveMetrics.volumeKg}
        sessionMode={sessionMode}
        environment={environment}
        title={title}
        onChangeTitle={setTitle}
        onMinimize={() => setMinimized(true)}
        onOpenFinish={handleOpenFinishConfirm}
        isFinishing={isFinishing}
        wakeLockSupported={wakeLock.isSupported}
        keepScreenAwake={keepScreenAwake}
        onToggleWakeLock={setKeepScreenAwake}
      />

      {/* Main scrollable workout log */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4 pb-28">
          {sessionMode === 'cardio' && exercises.length === 0 ? (
            <CardioLiveView
              sport={sport}
              title={title}
              elapsedSec={elapsedSec}
              estimatedKcal={estimatedKcal}
              intensity={intensity}
              distanceKm={distanceKm}
              notes={notes}
              onChangeIntensity={setIntensity}
              onChangeDistanceKm={setDistanceKm}
              onChangeNotes={setNotes}
              onOpenExercisePicker={() => setIsPickerOpen(true)}
            />
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
              <ActiveExerciseCard
                key={exercise.uid}
                exercise={exercise}
                catalogEntry={catalogMap.get(exercise.exerciseId)}
                imageBaseUrl={imageBaseUrl}
                isFocused={exercise.uid === focusedExerciseUid}
                onInspectExercise={(entry) => setInspectedExercise(entry)}
                onUpdateRest={updateExerciseRest}
                onRemoveExercise={removeExercise}
                onAddSet={addSet}
                onRemoveSet={removeSet}
                onUpdateSet={updateSet}
                onToggleSetComplete={toggleSetComplete}
                onUpdateNotes={updateExerciseNotes}
              />
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

            {showConfirmDiscard ? (
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
                      setConfirmDiscard(false);
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
        <RestTimerPill
          remainingSec={restRemainingSec}
          totalSec={restDurationSec}
          nextSetPreview={nextSetPreview}
          onAdjust={adjustRestTimer}
          onSkip={clearRestTimer}
        />
      )}

      {/* Safe Finish Confirmation Sheet (prevents accidental tap from ending a live workout) */}
      {showFinishConfirm && (
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
                environment={
                  environment === 'home' ? 'home' : environment === 'gym' ? 'gym' : 'all'
                }
                onConfirmSelection={handleAddPicked}
                onClosePicker={() => setIsPickerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Technique & History Inspector */}
      <ExerciseDetailSheet
        exercise={inspectedExercise}
        imageBaseUrl={imageBaseUrl}
        onClose={() => setInspectedExercise(null)}
      />
    </div>
  );
}

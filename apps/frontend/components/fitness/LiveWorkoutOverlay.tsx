'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Feather,
  Flame,
  Gauge,
  ListChecks,
  Minus,
  Plus,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useActiveWorkoutStore } from '@/store/useActiveWorkoutStore';
import { estimateWorkoutCaloriesClient, useHealthStore } from '@/store/useHealthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useWakeLock } from '@/hooks/useWakeLock';
import { healthService, WorkoutEntryRecord } from '@/lib/api/health';
import { loadExerciseCatalog, type CatalogExercise } from '@/lib/api/exerciseCatalog';
import { getLocalDateString } from '@/lib/utils/date';
import { formatDurationClock, formatMuscleLabel } from '@/lib/constants/fitness';
import ExerciseDetailSheet from './ExerciseDetailSheet';
import WorkoutHudHeader from './WorkoutHudHeader';
import WorkoutSetupWizard from './WorkoutSetupWizard';
import ActiveExerciseCard, { type GuidedRestState } from './ActiveExerciseCard';
import CardioLiveView from './CardioLiveView';
import {
  LiveWorkoutActivityRings,
  WorkoutSummaryRingsCard,
} from './WorkoutActivityRings';
import { buildWorkoutSummaryRings } from '@/lib/utils/workoutSummaryMetrics';

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

const FEELING_OPTIONS = [
  { key: 'low', label: 'Suave', intensity: 'low' as const, icon: Feather },
  { key: 'easy', label: 'Cómodo', intensity: 'medium' as const, icon: Sparkles },
  { key: 'solid', label: 'Sólido', intensity: 'medium' as const, icon: Gauge },
  { key: 'hard', label: 'Duro', intensity: 'high' as const, icon: Flame },
  { key: 'max', label: 'Al límite', intensity: 'high' as const, icon: Zap },
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
    setIntensity,
    setDistanceKm,
    setNotes,
    setKeepScreenAwake,
    addSet,
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
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);
  const [overrideDurationMin, setOverrideDurationMin] = useState<number>(1);
  const [isFinishing, setIsFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<WorkoutEntryRecord | null>(null);
  const [catalogMap, setCatalogMap] = useState<Map<string, CatalogExercise>>(() => new Map());
  const [imageBaseUrl, setImageBaseUrl] = useState<string | undefined>(undefined);
  const [inspectedExercise, setInspectedExercise] = useState<CatalogExercise | null>(null);
  const [isListSheetOpen, setIsListSheetOpen] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [selectedFeeling, setSelectedFeeling] = useState<string>('solid');
  const [justConfirmedSetNumber, setJustConfirmedSetNumber] = useState<number | null>(null);
  const [transitionTargetIndex, setTransitionTargetIndex] = useState<number | null>(null);
  const [lastCompletedSet, setLastCompletedSet] = useState<{
    uid: string;
    setId: string;
    prevIndex: number;
  } | null>(null);

  const hydratedIdsRef = useRef<Set<string>>(new Set());
  const restNotifiedRef = useRef<number | null>(null);
  const confirmTimeoutRef = useRef<number | null>(null);

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
      setTransitionTargetIndex(null);
      setLastCompletedSet(null);
      setJustConfirmedSetNumber(null);
      setIsListSheetOpen(false);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        window.clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  const showConfirmDiscard = isActive && confirmDiscard;
  const showFinishConfirm = isActive && isFinishConfirmOpen;

  const restRemainingSec = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (restEndsAt && restRemainingSec === 0 && restNotifiedRef.current !== restEndsAt) {
      restNotifiedRef.current = restEndsAt;
      playRestCompleteCue();
      if (transitionTargetIndex !== null) {
        setActiveExerciseIndex(transitionTargetIndex);
        setTransitionTargetIndex(null);
      }
      setLastCompletedSet(null);
      toast.success('¡Descanso terminado! Siguiente serie', { duration: 2200 });
      clearRestTimer();
    }
  }, [restEndsAt, restRemainingSec, clearRestTimer, transitionTargetIndex]);

  const elapsedSec = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const elapsedMin = Math.floor(elapsedSec / 60);

  const liveMetrics = useMemo(() => {
    let completedSets = 0;
    let totalSets = 0;
    let completedReps = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        totalSets += 1;
        if (s.completed) {
          completedSets += 1;
          const parsedReps = Number.parseInt(s.reps, 10);
          if (Number.isFinite(parsedReps) && parsedReps > 0) {
            completedReps += parsedReps;
          }
        }
      }
    }
    return {
      completedSets,
      totalSets,
      completedReps,
    };
  }, [exercises]);

  const canSaveSession =
    sessionMode === 'cardio' || liveMetrics.completedSets > 0 || elapsedSec >= 30;

  const handleOpenFinishConfirm = () => {
    setConfirmDiscard(false);
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

  // Post-workout celebration summary (Peak-End Rule + Interactive Apple Activity Rings)
  if (completedSummary) {
    const summaryModel = buildWorkoutSummaryRings(completedSummary, {
      weightKg: profileData?.user?.currentWeight,
      heightCm: profileData?.user?.height,
      goalMinutes: 45,
    });
    const meetsChallenge = completedSummary.durationMin >= 45;
    const prCount = completedSummary.personalRecords?.length || 0;

    return (
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md [@media(prefers-reduced-transparency:reduce)]:bg-black/95 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-complete-title"
      >
        <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/[0.08] bg-zinc-950 p-4 shadow-2xl sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-emerald-500 dark:text-emerald-400">
                <Trophy className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                Sesión completada
              </div>
              <h2
                id="workout-complete-title"
                className="mt-1 text-[21px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[22px]"
              >
                ¡Entrenamiento guardado!
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-zinc-400">
                {completedSummary.title || 'Sesión de fuerza'}
              </p>
            </div>

            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${
                summaryModel.closedCount === 3
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-[#92E82A]'
                  : 'border border-white/[0.08] bg-zinc-900/80 text-zinc-300'
              }`}
            >
              {summaryModel.closedCount === 3 && (
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              )}
              {summaryModel.closedCount}/3 anillos
            </span>
          </div>

          <WorkoutSummaryRingsCard model={summaryModel} />

          {prCount > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              {prCount === 1
                ? `Nuevo récord personal en ${completedSummary.personalRecords?.[0]?.exerciseName}`
                : `${prCount} nuevos récords personales en esta sesión`}
            </div>
          )}

          {meetsChallenge && (
            <div className="mt-3 flex items-center gap-2.5 rounded-[14px] border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
              Meta diaria de 45 min del reto 75 Days cumplida hoy.
            </div>
          )}

          <button
            type="button"
            onClick={() => setCompletedSummary(null)}
            className="mt-4 flex min-h-12 w-full cursor-pointer select-none touch-manipulation items-center justify-center rounded-[16px] bg-rose-600 text-sm font-bold text-[#ffffff] shadow-lg shadow-rose-600/20 [-webkit-touch-callout:none] transition-transform duration-100 ease-out active:scale-[0.98] hover:bg-rose-700"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // Step-by-step pre-start setup wizard
  if (isPreStartPickerOpen && !isActive) {
    return (
      <WorkoutSetupWizard
        onClose={closePreStartPicker}
        onStartCardio={startCardioWorkout}
        onStartStrength={startFreeWorkout}
      />
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

  const clampedIndex =
    exercises.length > 0 ? Math.min(activeExerciseIndex, exercises.length - 1) : 0;
  const isStrengthWithExercises =
    !(sessionMode === 'cardio' && exercises.length === 0) && exercises.length > 0;
  const isResting = Boolean(restEndsAt && restRemainingSec > 0);
  const isExerciseTransitionRest =
    isResting && transitionTargetIndex !== null && Boolean(exercises[transitionTargetIndex]);

  // During transition rest between exercises, preview the upcoming exercise directly
  const displayedIndex =
    isExerciseTransitionRest && transitionTargetIndex !== null
      ? transitionTargetIndex
      : clampedIndex;
  const displayedExercise = exercises[displayedIndex] || null;

  const exerciseSegments = exercises.map((ex) => ({
    uid: ex.uid,
    completedSets: ex.sets.filter((s) => s.completed).length,
    totalSets: ex.sets.length,
  }));

  const handleCompleteActiveSet = (uid: string, setId: string, setNumber: number) => {
    if (justConfirmedSetNumber !== null) return;

    const currentEx = exercises[clampedIndex];
    if (!currentEx) return;

    const remainingInCurrent = currentEx.sets.filter(
      (s) => !s.completed && s.id !== setId
    );
    const nextUnfinishedAfter = exercises.findIndex(
      (ex, idx) => idx > clampedIndex && ex.sets.some((s) => !s.completed)
    );
    const fallbackUnfinished =
      nextUnfinishedAfter !== -1
        ? nextUnfinishedAfter
        : exercises.findIndex(
            (ex, idx) => idx !== clampedIndex && ex.sets.some((s) => !s.completed)
          );

    // Same-frame haptic + 420ms emerald confirmation before transitioning into rest
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(12);
      }
    } catch {
      // Haptic feedback is best-effort
    }

    setJustConfirmedSetNumber(setNumber);
    confirmTimeoutRef.current = window.setTimeout(() => {
      setJustConfirmedSetNumber(null);
      toggleSetComplete(uid, setId);
      setLastCompletedSet({ uid, setId, prevIndex: clampedIndex });

      if (remainingInCurrent.length > 0) {
        setTransitionTargetIndex(null);
      } else if (fallbackUnfinished !== -1) {
        setTransitionTargetIndex(fallbackUnfinished);
      } else {
        // Entire routine completed — skip rest and go straight to finish check-in
        setTransitionTargetIndex(null);
        clearRestTimer();
        handleOpenFinishConfirm();
      }
    }, 420);
  };

  const handleSkipRest = () => {
    if (transitionTargetIndex !== null) {
      setActiveExerciseIndex(transitionTargetIndex);
      setTransitionTargetIndex(null);
    }
    setLastCompletedSet(null);
    clearRestTimer();
  };

  const handleUndoRest = () => {
    if (!lastCompletedSet) return;
    toggleSetComplete(lastCompletedSet.uid, lastCompletedSet.setId);
    setActiveExerciseIndex(lastCompletedSet.prevIndex);
    setTransitionTargetIndex(null);
    setLastCompletedSet(null);
    clearRestTimer();
  };

  const handleJumpToExercise = (idx: number) => {
    if (confirmTimeoutRef.current) {
      window.clearTimeout(confirmTimeoutRef.current);
      setJustConfirmedSetNumber(null);
    }
    setTransitionTargetIndex(null);
    setLastCompletedSet(null);
    clearRestTimer();
    setActiveExerciseIndex(idx);
    setIsListSheetOpen(false);
  };

  const handleAddExtraSet = () => {
    if (!displayedExercise) return;
    addSet(displayedExercise.uid);
    toast.success('Serie añadida', { duration: 1500 });
  };

  let guidedRest: GuidedRestState | null = null;
  if (isResting && displayedExercise) {
    const nextPendingSet = displayedExercise.sets.find((s) => !s.completed);
    guidedRest = {
      remainingSec: restRemainingSec,
      totalSec: restDurationSec,
      isExerciseTransition: isExerciseTransitionRest,
      nextLabel: isExerciseTransitionRest
        ? `Descanso · Siguiente: ${displayedExercise.exerciseName}`
        : `Descanso · Siguiente: Serie ${nextPendingSet?.setNumber ?? ''}`,
      skipButtonLabel: isExerciseTransitionRest
        ? `Empezar ${displayedExercise.exerciseName}`
        : 'Saltar',
      canUndo: Boolean(lastCompletedSet),
      onAddSeconds: adjustRestTimer,
      onSkip: handleSkipRest,
      onUndo: handleUndoRest,
    };
  }

  const anySheetOpen = Boolean(inspectedExercise || isListSheetOpen || showFinishConfirm);

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
        sessionMode={sessionMode}
        title={title}
        exerciseSegments={isStrengthWithExercises ? exerciseSegments : []}
        activeSegmentIndex={displayedIndex}
        onMinimize={() => setMinimized(true)}
        onOpenFinish={handleOpenFinishConfirm}
        isFinishing={isFinishing}
        wakeLockSupported={wakeLock.isSupported}
        keepScreenAwake={keepScreenAwake}
        onToggleWakeLock={setKeepScreenAwake}
      />

      {/* Main Guided Execution Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <div className="mx-auto max-w-2xl pb-4">
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
            />
          ) : displayedExercise ? (
            <>
              <ActiveExerciseCard
                key={displayedExercise.uid}
                exercise={displayedExercise}
                catalogEntry={catalogMap.get(displayedExercise.exerciseId)}
                imageBaseUrl={imageBaseUrl}
                isFocused={true}
                focusMode={true}
                pausePreview={anySheetOpen}
                justConfirmedSetNumber={justConfirmedSetNumber}
                guidedRest={guidedRest}
                onInspectExercise={(entry) => setInspectedExercise(entry)}
                onToggleSetComplete={toggleSetComplete}
                onCompleteActiveSet={handleCompleteActiveSet}
                onOpenFinish={handleOpenFinishConfirm}
              />

              <LiveWorkoutActivityRings
                completedSets={liveMetrics.completedSets}
                totalSets={liveMetrics.totalSets}
                completedReps={liveMetrics.completedReps}
                elapsedSec={elapsedSec}
                estimatedKcal={estimatedKcal}
                currentExerciseName={displayedExercise.exerciseName}
                currentExerciseCompletedSets={
                  displayedExercise.sets.filter((s) => s.completed).length
                }
                currentExerciseTotalSets={displayedExercise.sets.length}
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Minimal Thumb-Zone Bottom Dock (Disciplined Frosted Glass + Safe Area) */}
      {isStrengthWithExercises && (
        <div className="shrink-0 border-t border-white/[0.08] bg-zinc-950/85 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-xl backdrop-saturate-[180%] [@media(prefers-reduced-transparency:reduce)]:bg-zinc-950 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <button
              type="button"
              onClick={handleAddExtraSet}
              className="inline-flex min-h-11 shrink-0 cursor-pointer select-none touch-manipulation items-center justify-center gap-1.5 rounded-[14px] border border-white/[0.08] bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 [-webkit-touch-callout:none] transition-transform duration-100 ease-out active:scale-[0.97] hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Añadir
            </button>

            <button
              type="button"
              onClick={() => setIsListSheetOpen(true)}
              className="inline-flex min-h-11 flex-1 cursor-pointer select-none touch-manipulation items-center justify-between rounded-[14px] border border-white/[0.08] bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 [-webkit-touch-callout:none] transition-transform duration-100 ease-out active:scale-[0.98] hover:bg-zinc-800"
            >
              <span className="inline-flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-zinc-400" strokeWidth={2} aria-hidden="true" />
                Rutina
              </span>
              <span className="text-[12px] font-bold text-zinc-400 tabular-nums">
                {displayedIndex + 1}/{exercises.length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Exercise List Sheet — iOS Inset Grouped List */}
      {isListSheetOpen && (
        <div
          className="fixed inset-0 z-[125] flex items-end justify-center bg-black/75 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exercise-list-title"
          onClick={() => setIsListSheetOpen(false)}
        >
          <div
            className="max-h-[75dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] border border-white/[0.08] bg-zinc-950 px-4 pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl sm:rounded-2xl sm:pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS Sheet Grabber */}
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-zinc-700/80 sm:hidden" aria-hidden="true" />

            <div className="flex items-center justify-between gap-2 pb-3">
              <h3 id="exercise-list-title" className="text-[17px] font-semibold tracking-[-0.015em] text-white">
                Rutina
              </h3>
              <button
                type="button"
                onClick={() => setIsListSheetOpen(false)}
                aria-label="Cerrar lista de ejercicios"
                className="flex h-11 w-11 cursor-pointer select-none touch-manipulation items-center justify-center rounded-full bg-zinc-900 text-zinc-400 [-webkit-touch-callout:none] transition-transform duration-100 active:scale-95 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="divide-y divide-white/[0.06] overflow-hidden rounded-[16px] border border-white/[0.08] bg-zinc-900/75">
              {exercises.map((ex, idx) => {
                const done = ex.sets.filter((s) => s.completed).length;
                const total = ex.sets.length;
                const allDone = total > 0 && done === total;
                const isCurrent = idx === displayedIndex;

                return (
                  <button
                    key={ex.uid}
                    type="button"
                    onClick={() => handleJumpToExercise(idx)}
                    className={`flex min-h-[56px] w-full cursor-pointer select-none touch-manipulation items-center justify-between gap-3 px-4 py-3 text-left [-webkit-touch-callout:none] transition-colors active:bg-white/[0.06] ${
                      isCurrent ? 'bg-rose-500/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-white">
                        {idx + 1}. {ex.exerciseName}
                      </p>
                      <p className="mt-0.5 text-[12px] text-zinc-400 tabular-nums">
                        {formatMuscleLabel(ex.primaryMuscle)} · {done}/{total} series
                      </p>
                    </div>

                    {allDone ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[#ffffff]">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden="true" />
                      </span>
                    ) : isCurrent ? (
                      <span className="shrink-0 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-400">
                        Actual
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Safe Finish / Discard Sheet */}
      {showFinishConfirm && (
        <div
          className="fixed inset-0 z-[128] flex items-end justify-center bg-black/80 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="finish-confirm-title"
          onClick={() => {
            setConfirmDiscard(false);
            setIsFinishConfirmOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-t-[28px] border border-zinc-800 bg-zinc-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {showConfirmDiscard ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 id="finish-confirm-title" className="text-lg font-bold text-white">
                      ¿Descartar este entrenamiento?
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                      Si lo descartas se perderá todo el progreso de esta sesión (series y tiempo registrado). Esta acción no se puede deshacer.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDiscard(false)}
                    className="min-h-12 flex-1 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDiscard(false);
                      setIsFinishConfirmOpen(false);
                      discardWorkout();
                      toast('Entrenamiento descartado');
                    }}
                    className="min-h-12 flex-1 cursor-pointer rounded-xl bg-red-600 text-sm font-bold text-[#ffffff] shadow-lg shadow-red-600/20 hover:bg-red-700"
                  >
                    Sí, descartar todo
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 id="finish-confirm-title" className="text-lg font-bold text-white">
                  ¿Cómo estuvo la sesión?
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  {sessionMode === 'cardio' && exercises.length === 0
                    ? `${title || 'Actividad'} · ${formatDurationClock(elapsedSec)} transcurridos.`
                    : `${liveMetrics.completedSets} de ${liveMetrics.totalSets} series completadas`}
                </p>

                {/* Effort / Feeling Check-in (Peak-End) */}
                {canSaveSession && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Sensación del entrenamiento">
                      {FEELING_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = selectedFeeling === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                              setSelectedFeeling(opt.key);
                              setIntensity(opt.intensity);
                            }}
                            className={`flex min-h-[60px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-[10px] font-semibold transition-all active:scale-95 ${
                              active
                                ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                                : 'border-white/[0.07] bg-zinc-900/60 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-3">
                      <span className="text-xs font-semibold text-zinc-300">Duración (min)</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOverrideDurationMin((v) => Math.max(1, v - 5))}
                          aria-label="Restar 5 minutos"
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-800 text-white active:scale-95"
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
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-800 text-white active:scale-95"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      maxLength={500}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notas opcionales de la sesión..."
                      aria-label="Notas opcionales de la sesión"
                      className="w-full resize-none rounded-2xl border border-white/[0.07] bg-zinc-900/60 px-3.5 py-2.5 text-base sm:text-xs text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                )}

                {!canSaveSession && (
                  <p className="mt-3 rounded-2xl border border-white/[0.07] bg-zinc-900/60 px-3.5 py-2.5 text-xs text-zinc-400">
                    Marca al menos una serie para poder guardar la sesión, o descártala si la iniciaste por error.
                  </p>
                )}

                <div className="mt-5 space-y-2.5">
                  <button
                    type="button"
                    disabled={isFinishing || !canSaveSession}
                    onClick={handleConfirmFinish}
                    className="min-h-12 w-full cursor-pointer rounded-xl bg-emerald-700 text-sm font-bold text-[#ffffff] shadow-lg shadow-emerald-700/20 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isFinishing ? 'Guardando...' : 'Guardar entrenamiento'}
                  </button>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDiscard(false);
                        setIsFinishConfirmOpen(false);
                      }}
                      className="min-h-11 flex-1 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                    >
                      Seguir entrenando
                    </button>
                    <button
                      type="button"
                      disabled={isFinishing}
                      onClick={() => setConfirmDiscard(true)}
                      className="min-h-11 flex-1 cursor-pointer rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-bold text-red-400 hover:bg-red-500/15 disabled:opacity-50"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              </>
            )}
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

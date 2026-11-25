'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Bike,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Home,
  Link2,
  Minus,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Trees,
  Waves,
  X,
} from 'lucide-react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useDragControls,
  useReducedMotion,
} from 'motion/react';
import toast from 'react-hot-toast';
import {
  estimateWorkoutCaloriesClient,
  useHealthStore,
} from '@/store/useHealthStore';
import { useActiveWorkoutStore } from '@/store/useActiveWorkoutStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import {
  classifyExerciseGoal,
  pickAutomaticGoalForWorkout,
} from '@/lib/utils/workoutGoalMatcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

interface LogWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD
  onSaved: () => void;
  initialData?: any;
  onDelete?: (id: string) => void;
}

const SPORT_OPTIONS = [
  { value: 'strength', label: 'Fuerza', icon: Dumbbell },
  { value: 'running', label: 'Running', icon: Footprints },
  { value: 'walking', label: 'Caminata', icon: Activity },
  { value: 'cycling', label: 'Ciclismo', icon: Bike },
  { value: 'swimming', label: 'Natación', icon: Waves },
  { value: 'yoga', label: 'Yoga', icon: Sparkles },
  { value: 'other', label: 'Otro', icon: Flame },
];

type LogEnvironment = 'all' | 'gym' | 'home' | 'outdoor';

const ENVIRONMENT_SPORTS: Record<Exclude<LogEnvironment, 'all'>, string[]> = {
  gym: ['strength', 'running', 'cycling', 'other'],
  home: ['strength', 'yoga', 'other'],
  outdoor: ['running', 'walking', 'cycling', 'swimming', 'yoga', 'other'],
};

const ENVIRONMENT_META: Record<
  LogEnvironment,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  all: { label: 'Todas', icon: Activity },
  gym: { label: 'En gimnasio', icon: Dumbbell },
  home: { label: 'En casa', icon: Home },
  outdoor: { label: 'Al aire libre', icon: Trees },
};

const DURATION_PRESETS = [20, 30, 45, 60, 90];

const INTENSITY_OPTIONS = [
  { value: 'low', label: 'Suave' },
  { value: 'medium', label: 'Moderada' },
  { value: 'high', label: 'Intensa' },
] as const;

type OptionalFieldKey = 'title' | 'distance' | 'calories' | 'notes';

export default function LogWorkoutModal(props: LogWorkoutModalProps) {
  if (!props.isOpen) return null;
  return (
    <LogWorkoutModalContent
      key={props.initialData?.id ?? 'new'}
      onClose={props.onClose}
      date={props.date}
      onSaved={props.onSaved}
      initialData={props.initialData}
      onDelete={props.onDelete}
    />
  );
}

function LogWorkoutModalContent({
  onClose,
  date,
  onSaved,
  initialData,
  onDelete,
}: Omit<LogWorkoutModalProps, 'isOpen'>) {
  const {
    profileData,
    logWorkoutOptimistic,
    updateWorkoutOptimistic,
    deleteWorkoutOptimistic,
  } = useHealthStore();
  const openPreStartPicker = useActiveWorkoutStore((s) => s.openPreStartPicker);
  const hasActiveWorkout = useActiveWorkoutStore((s) => s.isActive);
  const setMinimized = useActiveWorkoutStore((s) => s.setMinimized);

  const dragControls = useDragControls();
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<'environment' | 'details'>(() =>
    initialData ? 'details' : 'environment'
  );
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [environment, setEnvironment] = useState<LogEnvironment>(
    () => (initialData?.environment as LogEnvironment) || 'all'
  );
  const [linkedGoalId, setLinkedGoalId] = useState<string | null>(
    () => initialData?.linkedGoalId ?? null
  );
  const dailyLog = useChallengeStore((s) => s.logs[date]);
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);
  const isPastDay = date < todayStr;

  const initialDuration = Number(initialData?.durationMin) || 45;
  const [sport, setSport] = useState<string>(() => initialData?.sport || 'strength');
  const [durationMin, setDurationMin] = useState<number>(initialDuration);
  const [showCustomDuration, setShowCustomDuration] = useState<boolean>(
    () => !DURATION_PRESETS.includes(initialDuration)
  );
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>(
    () => initialData?.intensity || 'medium'
  );
  const [title, setTitle] = useState<string>(() => initialData?.title || '');
  const [caloriesBurned, setCaloriesBurned] = useState<string>(() =>
    initialData?.isManualCalories && initialData?.caloriesBurned
      ? String(initialData.caloriesBurned)
      : ''
  );
  const [distanceKm, setDistanceKm] = useState<string>(() =>
    initialData?.distanceKm ? String(initialData.distanceKm) : ''
  );
  const [notes, setNotes] = useState<string>(() => initialData?.notes || '');
  const [activeOptionalFields, setActiveOptionalFields] = useState<
    Record<OptionalFieldKey, boolean>
  >(() => ({
    title: Boolean(initialData?.title),
    distance: Boolean(initialData?.distanceKm),
    calories: Boolean(initialData?.isManualCalories && initialData?.caloriesBurned),
    notes: Boolean(initialData?.notes),
  }));
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const dailyGoals = useMemo(() => dailyLog?.goals ?? [], [dailyLog]);
  const autoMatchedGoal = useMemo(() => {
    if (dailyGoals.length === 0) return null;
    const classified = dailyGoals
      .map((goal) => ({
        goal: {
          ...goal,
          measurementType: goal.measurementType ?? 'boolean',
          targetValue: goal.targetValue ?? 1,
          currentValue: goal.currentValue ?? 0,
        },
        classification: classifyExerciseGoal(goal),
      }))
      .filter((entry) => entry.classification.isExerciseGoal);
    return (
      pickAutomaticGoalForWorkout(
        {
          sport,
          environment: environment === 'all' ? null : environment,
        },
        classified
      )?.goal ?? null
    );
  }, [dailyGoals, sport, environment]);

  const estimatedCalories = useMemo(() => {
    const weightKg = Number(profileData?.user?.currentWeight) || 70;
    const heightCm = Number(profileData?.user?.height) || 170;
    return Math.round(
      estimateWorkoutCaloriesClient(sport, durationMin, intensity, weightKg, heightCm)
    );
  }, [sport, durationMin, intensity, profileData]);

  const visibleSports = useMemo(
    () =>
      SPORT_OPTIONS.filter((opt) =>
        environment === 'all'
          ? true
          : ENVIRONMENT_SPORTS[environment].includes(opt.value)
      ),
    [environment]
  );

  const goToDetails = (nextEnv: LogEnvironment) => {
    setEnvironment(nextEnv);
    if (nextEnv !== 'all') {
      const allowed = ENVIRONMENT_SPORTS[nextEnv];
      if (!allowed.includes(sport)) {
        setSport(allowed[0]);
      }
    }
    setStepDirection(1);
    setStep('details');
  };

  const goBackToEnvironment = () => {
    setStepDirection(-1);
    setStep('environment');
  };

  const toggleOptionalField = (key: OptionalFieldKey) => {
    setActiveOptionalFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenLiveTracker = () => {
    onClose();
    if (hasActiveWorkout) {
      setMinimized(false);
    } else {
      openPreStartPicker();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      setError('La duración debe ser mayor a 0 minutos.');
      return;
    }

    if (Math.round(durationMin) > 1440) {
      setError('La duración máxima es de 1440 minutos.');
      return;
    }

    const parsedCalories = caloriesBurned ? Number(caloriesBurned) : NaN;
    const parsedDistance = distanceKm ? Number(distanceKm) : NaN;

    const payload = {
      date,
      title: title.trim() || undefined,
      sport,
      durationMin: Math.round(durationMin),
      intensity,
      environment: environment === 'all' ? null : environment,
      linkedGoalId: linkedGoalId || null,
      notes: notes.trim() || undefined,
      caloriesBurned:
        Number.isFinite(parsedCalories) && parsedCalories > 0
          ? parsedCalories
          : undefined,
      distanceKm:
        Number.isFinite(parsedDistance) && parsedDistance > 0
          ? parsedDistance
          : undefined,
    };

    onSaved();
    onClose();

    if (initialData?.id) {
      void updateWorkoutOptimistic(initialData.id, payload).catch(() => {
        toast.error('Error al actualizar el entrenamiento.');
      });
    } else {
      void logWorkoutOptimistic(payload).catch(() => {
        toast.error('Error al guardar el entrenamiento.');
      });
    }
  };

  const handleDelete = () => {
    if (!initialData?.id || !onDelete) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este entrenamiento?')) return;

    const workoutId = initialData.id;
    onDelete(workoutId);
    onClose();
    void deleteWorkoutOptimistic(workoutId, date).catch(() => {
      toast.error('Error al eliminar el entrenamiento.');
    });
  };

  const enterTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING;
  const exitTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_EXIT_TRANSITION;
  const stepTransition = reduceMotion
    ? REDUCED_MOTION_TRANSITION
    : { type: 'spring' as const, bounce: 0, duration: 0.32 };

  const EnvBadgeIcon = ENVIRONMENT_META[environment].icon;
  const supportsDistance = sport !== 'strength' && sport !== 'yoga';

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-modal-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.2 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        drag={!isDesktop && !reduceMotion ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.06, bottom: 0.45 }}
        onDragEnd={(_, info) => {
          if (shouldDismissSheet(info.offset.y, info.velocity.y)) {
            onClose();
          }
        }}
        initial={
          reduceMotion
            ? { opacity: 0 }
            : isDesktop
              ? { opacity: 0, scale: 0.96, y: 12 }
              : { y: '100%' }
        }
        animate={
          reduceMotion
            ? { opacity: 1 }
            : isDesktop
              ? { opacity: 1, scale: 1, y: 0 }
              : { y: 0 }
        }
        exit={
          reduceMotion
            ? { opacity: 0 }
            : isDesktop
              ? { opacity: 0, scale: 0.97, y: 8, transition: exitTransition }
              : { y: '100%', transition: exitTransition }
        }
        transition={enterTransition}
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-[24px]"
      >
        {/* Drag Handle + Header */}
        <div
          onPointerDown={(e) => {
            if (!isDesktop && !reduceMotion) {
              dragControls.start(e);
            }
          }}
          className="shrink-0 touch-pan-x select-none border-b border-zinc-900 bg-zinc-900/30 px-5 pt-2.5 pb-3.5"
        >
          {!isDesktop && (
            <div className="mb-2.5 flex justify-center">
              <span
                aria-hidden="true"
                className="h-1 w-9 rounded-full bg-zinc-500/35"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {!initialData ? (
                <div className="mb-1 flex items-center gap-2">
                  {step === 'details' ? (
                    <button
                      type="button"
                      onClick={goBackToEnvironment}
                      className="-ml-1 inline-flex cursor-pointer items-center gap-0.5 rounded-lg px-1 py-0.5 text-[11px] font-bold text-rose-500 transition-transform duration-100 active:scale-95 hover:text-rose-400"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Entorno</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-500">
                      Anotar actividad
                    </span>
                  )}
                  <div className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-1 w-4 rounded-full bg-rose-500" />
                    <span
                      className={`h-1 w-4 rounded-full transition-colors duration-200 ${
                        step === 'details' ? 'bg-rose-500' : 'bg-zinc-700'
                      }`}
                    />
                  </div>
                </div>
              ) : (
                <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-rose-500">
                  Anotar actividad
                </p>
              )}

              <h2
                id="workout-modal-title"
                className="truncate text-[19px] font-bold tracking-tight text-white"
              >
                {initialData
                  ? 'Editar actividad'
                  : step === 'environment'
                    ? '¿Dónde entrenaste?'
                    : 'Ya entrené'}
              </h2>
            </div>

            <button
              type="button"
              aria-label="Cerrar registro de entrenamiento"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-zinc-900/80 text-zinc-400 transition-transform duration-100 hover:bg-zinc-800 hover:text-white active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs font-medium text-red-400">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {step === 'environment' && !initialData ? (
              <motion.div
                key="step-environment"
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: stepDirection * 24 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -24 }
                }
                transition={stepTransition}
                className="space-y-3"
              >
                <p className="text-xs leading-relaxed text-zinc-400">
                  Elige el entorno para filtrar las actividades más rápidas:
                </p>

                <div className="space-y-2.5">
                  {[
                    {
                      value: 'gym' as const,
                      label: 'En gimnasio',
                      desc: 'Pesas, máquinas, cinta o bici fija',
                      icon: Dumbbell,
                    },
                    {
                      value: 'home' as const,
                      label: 'En casa',
                      desc: 'Sin maquinaria, core, yoga o movilidad',
                      icon: Home,
                    },
                    {
                      value: 'outdoor' as const,
                      label: 'Al aire libre',
                      desc: 'Running, caminata, bici o natación',
                      icon: Trees,
                    },
                  ].map((env) => {
                    const Icon = env.icon;
                    return (
                      <button
                        key={env.value}
                        type="button"
                        onClick={() => goToDetails(env.value)}
                        className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 px-4 py-3.5 text-left transition-transform duration-100 hover:border-rose-500/50 hover:bg-zinc-900 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600/15 text-rose-500 transition-colors group-hover:bg-rose-600 group-hover:text-white">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-white">{env.label}</p>
                            <p className="mt-0.5 text-xs text-zinc-400">{env.desc}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleOpenLiveTracker}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3 text-left transition-transform duration-100 hover:border-rose-500/40 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </span>
                      <span className="text-xs font-semibold text-zinc-200">
                        {hasActiveWorkout
                          ? 'Volver a tu sesión en vivo'
                          : '¿Vas a entrenar ahora con series?'}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-rose-500">
                      Iniciar →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToDetails('all')}
                    className="w-full cursor-pointer py-1.5 text-center text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                  >
                    Ver todas las actividades
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="step-details"
                id="workout-form"
                onSubmit={handleSubmit}
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: stepDirection * 24 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: 24 }
                }
                transition={stepTransition}
                className="space-y-5"
              >
                <LayoutGroup id="log-workout-controls">
                  {/* Context Bar: Environment Chip + Optional Linked Goal */}
                  {(environment !== 'all' || dailyGoals.length > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {!initialData && environment !== 'all' && (
                        <button
                          type="button"
                          onClick={goBackToEnvironment}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400 transition-transform duration-100 active:scale-95"
                        >
                          <EnvBadgeIcon className="h-3.5 w-3.5" />
                          <span>{ENVIRONMENT_META[environment].label}</span>
                        </button>
                      )}

                      {dailyGoals.length > 0 && (
                        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 py-1">
                          <Link2 className="h-3 w-3 shrink-0 text-rose-500" />
                          <select
                            id="workout-linked-goal"
                            aria-label="Cuenta para meta"
                            value={linkedGoalId ?? ''}
                            onChange={(e) => setLinkedGoalId(e.target.value || null)}
                            disabled={isPastDay}
                            className="max-w-[175px] cursor-pointer truncate bg-transparent text-[11px] font-semibold text-zinc-200 focus:outline-none disabled:opacity-50"
                          >
                            <option value="">
                              {autoMatchedGoal
                                ? `Meta: ${autoMatchedGoal.title}`
                                : 'Sin meta asociada'}
                            </option>
                            {dailyGoals.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {isPastDay && dailyGoals.length > 0 && (
                    <p className="-mt-3 text-[11px] text-zinc-500">
                      Días anteriores no modifican la racha ni las metas del reto.
                    </p>
                  )}

                  {/* Sport Pills */}
                  <div>
                    <span className="mb-2.5 block text-xs font-semibold text-zinc-400">
                      Actividad
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {visibleSports.map((opt) => {
                        const Icon = opt.icon;
                        const active = sport === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSport(opt.value)}
                            className={`relative inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-transform duration-100 active:scale-95 ${
                              active
                                ? 'border-rose-500/60 text-rose-400'
                                : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="workout-sport-pill"
                                transition={
                                  reduceMotion
                                    ? REDUCED_MOTION_TRANSITION
                                    : { type: 'spring', bounce: 0.15, duration: 0.35 }
                                }
                                className="absolute inset-0 rounded-full bg-rose-600/15"
                              />
                            )}
                            <Icon className="relative z-10 h-3.5 w-3.5" />
                            <span className="relative z-10">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Duration: Single Clean Row + Collapsible Stepper */}
                  <div>
                    <div className="mb-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-400">
                          Duración
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCustomDuration((prev) => !prev)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-bold text-white tabular-nums transition-transform duration-100 active:scale-95"
                          title="Ajustar minutos exactos"
                        >
                          <Clock className="h-3 w-3 text-zinc-400" />
                          <span>{durationMin} min</span>
                        </button>
                      </div>

                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 tabular-nums">
                        <Flame className="h-3.5 w-3.5" />
                        ~{caloriesBurned ? Number(caloriesBurned) : estimatedCalories} kcal
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {DURATION_PRESETS.map((preset) => {
                        const active = durationMin === preset && !showCustomDuration;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setDurationMin(preset);
                              setShowCustomDuration(false);
                            }}
                            className={`min-h-10 flex-1 cursor-pointer rounded-xl border text-xs font-bold tabular-nums transition-transform duration-100 active:scale-95 ${
                              active
                                ? 'border-rose-600 bg-rose-600 text-white shadow-sm shadow-rose-600/20'
                                : 'border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            {preset}m
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setShowCustomDuration((prev) => !prev)}
                        className={`min-h-10 cursor-pointer rounded-xl border px-3 text-xs font-bold transition-transform duration-100 active:scale-95 ${
                          showCustomDuration || !DURATION_PRESETS.includes(durationMin)
                            ? 'border-rose-500/60 bg-rose-600/15 text-rose-400'
                            : 'border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        Otro
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {showCustomDuration && (
                        <motion.div
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 p-1.5">
                            <button
                              type="button"
                              onClick={() => setDurationMin((prev) => Math.max(5, prev - 5))}
                              aria-label="Restar 5 minutos"
                              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-zinc-800 text-white transition-transform duration-100 active:scale-90 hover:bg-zinc-700"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                inputMode="numeric"
                                min="1"
                                max="1440"
                                required
                                value={durationMin}
                                onChange={(e) => setDurationMin(Number(e.target.value))}
                                aria-label="Duración en minutos"
                                className="w-16 bg-transparent text-center text-lg font-bold text-white tabular-nums focus:outline-none"
                              />
                              <span className="text-xs font-medium text-zinc-400">min</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDurationMin((prev) => Math.min(1440, prev + 5))}
                              aria-label="Sumar 5 minutos"
                              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-zinc-800 text-white transition-transform duration-100 active:scale-90 hover:bg-zinc-700"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Intensity: iOS Segmented Control */}
                  <div>
                    <span className="mb-2.5 block text-xs font-semibold text-zinc-400">
                      Intensidad
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-1">
                      {INTENSITY_OPTIONS.map((opt) => {
                        const active = intensity === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setIntensity(opt.value)}
                            className={`relative min-h-10 cursor-pointer rounded-xl text-xs font-bold transition-colors ${
                              active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="workout-intensity-thumb"
                                transition={
                                  reduceMotion
                                    ? REDUCED_MOTION_TRANSITION
                                    : { type: 'spring', bounce: 0.12, duration: 0.32 }
                                }
                                className="absolute inset-0 rounded-xl bg-zinc-800 shadow-xs"
                              />
                            )}
                            <span className="relative z-10">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Detail Chips */}
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { key: 'title' as const, label: 'Título', show: true },
                          { key: 'distance' as const, label: 'Distancia', show: supportsDistance },
                          { key: 'calories' as const, label: 'Calorías', show: true },
                          { key: 'notes' as const, label: 'Notas', show: true },
                        ] as const
                      )
                        .filter((item) => item.show)
                        .map((item) => {
                          const active = activeOptionalFields[item.key];
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => toggleOptionalField(item.key)}
                              className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-transform duration-100 active:scale-95 ${
                                active
                                  ? 'border-zinc-700 bg-zinc-800 text-white'
                                  : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {active ? (
                                <Minus className="h-3 w-3" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                    </div>

                    <AnimatePresence initial={false}>
                      {(activeOptionalFields.title ||
                        activeOptionalFields.calories ||
                        (activeOptionalFields.distance && supportsDistance) ||
                        activeOptionalFields.notes) && (
                        <motion.div
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="space-y-2.5 overflow-hidden"
                        >
                          {activeOptionalFields.title && (
                            <input
                              type="text"
                              maxLength={120}
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              placeholder="Título (ej: Corrida en el parque)"
                              className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                            />
                          )}

                          {(activeOptionalFields.calories ||
                            (activeOptionalFields.distance && supportsDistance)) && (
                            <div className="grid grid-cols-2 gap-2.5">
                              {activeOptionalFields.calories && (
                                <div>
                                  <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                                    Calorías manuales
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    placeholder={`Auto (${estimatedCalories})`}
                                    value={caloriesBurned}
                                    onChange={(e) => setCaloriesBurned(e.target.value)}
                                    className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                                  />
                                </div>
                              )}

                              {activeOptionalFields.distance && supportsDistance && (
                                <div>
                                  <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                                    Distancia (km)
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.1"
                                    min="0.1"
                                    placeholder="0.0"
                                    value={distanceKm}
                                    onChange={(e) => setDistanceKm(e.target.value)}
                                    className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {activeOptionalFields.notes && (
                            <textarea
                              rows={2}
                              maxLength={500}
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Notas rápidas..."
                              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                            />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </LayoutGroup>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer (only when on Step 2 or editing) */}
        {(step === 'details' || Boolean(initialData)) && (
          <div className="flex shrink-0 gap-2.5 border-t border-zinc-900 bg-zinc-900/30 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {initialData && (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Eliminar entrenamiento"
                className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-red-500/30 px-4 text-sm font-semibold text-red-400 transition-transform duration-100 hover:bg-red-500/10 active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              form="workout-form"
              className="min-h-12 flex-1 cursor-pointer rounded-2xl bg-rose-600 px-4 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition-transform duration-100 hover:bg-rose-700 active:scale-[0.98]"
            >
              {initialData ? 'Actualizar actividad' : 'Guardar actividad'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Bike,
  ChevronRight,
  Dumbbell,
  Flame,
  Footprints,
  Home,
  Minus,
  Plus,
  Sparkles,
  Trees,
  Waves,
  X,
} from 'lucide-react';
import type { CatalogExercise } from '@/lib/api/exerciseCatalog';
import type { StartExerciseInput, WorkoutEnvironment } from '@/store/useActiveWorkoutStore';
import ExerciseCatalogBrowser from './ExerciseCatalogBrowser';

export interface ConfiguredExerciseItem {
  exercise: CatalogExercise;
  targetSets: number;
  targetReps: number;
  defaultRestSec: number;
}

interface WorkoutSetupWizardProps {
  onClose: () => void;
  onStartCardio: (sport: string, label: string) => void;
  onStartStrength: (
    exercises: StartExerciseInput[],
    title: string,
    environment: WorkoutEnvironment
  ) => void;
}

type WizardStep = 'environment' | 'exercises' | 'configure';

const ENVIRONMENT_OPTIONS = [
  { key: 'gym' as const, title: 'Gimnasio', icon: Dumbbell },
  { key: 'home' as const, title: 'En casa', icon: Home },
  { key: 'outdoor' as const, title: 'Al aire libre', icon: Trees },
];

const OUTDOOR_ACTIVITIES = [
  { sport: 'walking', label: 'Caminar', icon: Activity },
  { sport: 'running', label: 'Correr', icon: Footprints },
  { sport: 'cycling', label: 'Ciclismo', icon: Bike },
  { sport: 'swimming', label: 'Natación', icon: Waves },
  { sport: 'yoga', label: 'Movilidad', icon: Sparkles },
  { sport: 'other', label: 'Actividad libre', icon: Flame },
] as const;

const REST_PRESETS = [60, 90, 120, 180] as const;

export default function WorkoutSetupWizard({
  onClose,
  onStartCardio,
  onStartStrength,
}: WorkoutSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('environment');
  const [env, setEnv] = useState<WorkoutEnvironment | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [configured, setConfigured] = useState<ConfiguredExerciseItem[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeEnvMeta = ENVIRONMENT_OPTIONS.find((item) => item.key === env);

  const handleConfirmExercises = (picked: CatalogExercise[]) => {
    if (picked.length === 0) return;
    setConfigured((prev) => {
      const prevMap = new Map(prev.map((item) => [item.exercise.id, item]));
      return picked.map((ex) => {
        const existing = prevMap.get(ex.id);
        return (
          existing ?? {
            exercise: ex,
            targetSets: 3,
            targetReps: 12,
            defaultRestSec: 90,
          }
        );
      });
    });
    setStep('configure');
  };

  const updateItem = (
    exerciseId: string,
    patch: Partial<Pick<ConfiguredExerciseItem, 'targetSets' | 'targetReps' | 'defaultRestSec'>>
  ) => {
    setConfigured((prev) =>
      prev.map((item) =>
        item.exercise.id === exerciseId ? { ...item, ...patch } : item
      )
    );
  };

  const handleLaunchSession = () => {
    if (configured.length === 0 || !env) return;
    const uniqueZones = [...new Set(configured.map((c) => c.exercise.bodyZoneLabel))].slice(0, 2);
    const autoTitle =
      sessionTitle.trim() ||
      (uniqueZones.length > 0 ? `Sesión de ${uniqueZones.join(' y ')}` : 'Sesión de entrenamiento');

    onStartStrength(
      configured.map((item) => ({
        exerciseId: item.exercise.id,
        exerciseName: item.exercise.name,
        primaryMuscle: item.exercise.primaryMuscle,
        equipment: item.exercise.equipment,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        defaultRestSec: item.defaultRestSec,
      })),
      autoTitle,
      env
    );
  };

  const stepLabel =
    step === 'environment'
      ? 'Paso 1 de 3'
      : step === 'exercises'
        ? env === 'outdoor'
          ? 'Paso 2 de 2'
          : 'Paso 2 de 3'
        : 'Paso 3 de 3';

  const stepHeading =
    step === 'environment'
      ? 'Entorno'
      : step === 'exercises'
        ? env === 'outdoor'
          ? 'Actividad'
          : 'Ejercicios'
        : 'Configurar sesión';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prestart-picker-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border border-white/[0.08] bg-zinc-950 shadow-2xl sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact iOS-style Sheet Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {step !== 'environment' && (
              <button
                type="button"
                onClick={() => setStep(step === 'configure' ? 'exercises' : 'environment')}
                aria-label="Volver al paso anterior"
                className="flex h-11 w-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full text-zinc-300 transition-transform duration-100 ease-out active:scale-95 hover:bg-white/[0.06] hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2} />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-400">
                {stepLabel}
                {activeEnvMeta && step !== 'environment' ? ` · ${activeEnvMeta.title}` : ''}
              </p>
              <h2
                id="prestart-picker-title"
                className="truncate text-[17px] font-semibold text-white"
              >
                {stepHeading}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full text-zinc-400 transition-transform duration-100 ease-out active:scale-95 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Step 1: Environment (Inset Grouped List) */}
        {step === 'environment' && (
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-zinc-900/70 divide-y divide-white/[0.06]">
              {ENVIRONMENT_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setEnv(option.key);
                      setStep('exercises');
                    }}
                    className="flex min-h-[60px] w-full cursor-pointer touch-manipulation items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-100 active:bg-white/[0.06] hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-rose-600/15 text-rose-400">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span className="text-[16px] font-semibold text-white">
                        {option.title}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" strokeWidth={1.75} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Exercises or Outdoor Activity */}
        {step === 'exercises' && (
          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            {env === 'outdoor' ? (
              <div className="grid grid-cols-2 gap-2.5 pb-[env(safe-area-inset-bottom,0px)]">
                {OUTDOOR_ACTIVITIES.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.sport}
                      type="button"
                      onClick={() => onStartCardio(act.sport, act.label)}
                      className="flex min-h-[84px] cursor-pointer touch-manipulation flex-col items-start justify-between rounded-[16px] border border-white/[0.08] bg-zinc-900/70 p-3.5 text-left transition-transform duration-100 ease-out active:scale-[0.97] hover:bg-zinc-900"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-rose-600/15 text-rose-400">
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="mt-2 text-[15px] font-semibold text-white">
                        {act.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <ExerciseCatalogBrowser
                key={env}
                mode="picker"
                environment={env ?? 'gym'}
                onConfirmSelection={handleConfirmExercises}
                confirmLabel={(count) =>
                  count > 0 ? `Siguiente (${count})` : 'Elige al menos 1 ejercicio'
                }
              />
            )}
          </div>
        )}

        {/* Step 3: Clean, Airy Per-Exercise Configuration */}
        {step === 'configure' && (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
              {/* Optional Session Name */}
              <input
                type="text"
                maxLength={120}
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Nombre de la sesión (opcional)"
                aria-label="Nombre de la sesión"
                className="min-h-11 w-full rounded-[14px] bg-zinc-900/80 px-4 text-base font-medium text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20"
              />

              {/* iOS Inset Grouped List — 2-line minimal rows, zero nested borders */}
              <div className="overflow-hidden rounded-[20px] bg-zinc-900/80 divide-y divide-white/[0.06]">
                {configured.map((item) => {
                  const nextRest =
                    REST_PRESETS[
                      (REST_PRESETS.indexOf(
                        item.defaultRestSec as (typeof REST_PRESETS)[number]
                      ) +
                        1) %
                        REST_PRESETS.length
                    ] ?? 90;

                  return (
                    <div key={item.exercise.id} className="px-4 py-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-[15px] font-semibold text-white">
                          {item.exercise.name}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            updateItem(item.exercise.id, { defaultRestSec: nextRest })
                          }
                          aria-label={`Descanso de ${item.exercise.name}: ${item.defaultRestSec} segundos`}
                          className="shrink-0 cursor-pointer touch-manipulation rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-zinc-300 tabular-nums transition-transform duration-100 active:scale-95 hover:bg-white/[0.1]"
                        >
                          {item.defaultRestSec}s
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        {/* Series inline stepper */}
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-zinc-400">Series</span>
                          <div className="flex items-center rounded-full bg-white/[0.05] p-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateItem(item.exercise.id, {
                                  targetSets: Math.max(1, item.targetSets - 1),
                                })
                              }
                              aria-label={`Disminuir series de ${item.exercise.name}`}
                              className="flex h-9 w-9 cursor-pointer touch-manipulation items-center justify-center rounded-full text-zinc-300 transition-transform duration-100 active:scale-90 hover:bg-white/[0.08]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center text-[15px] font-semibold text-white tabular-nums">
                              {item.targetSets}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateItem(item.exercise.id, {
                                  targetSets: Math.min(12, item.targetSets + 1),
                                })
                              }
                              aria-label={`Aumentar series de ${item.exercise.name}`}
                              className="flex h-9 w-9 cursor-pointer touch-manipulation items-center justify-center rounded-full text-zinc-300 transition-transform duration-100 active:scale-90 hover:bg-white/[0.08]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Reps inline stepper */}
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-zinc-400">Reps</span>
                          <div className="flex items-center rounded-full bg-white/[0.05] p-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateItem(item.exercise.id, {
                                  targetReps: Math.max(1, item.targetReps - 1),
                                })
                              }
                              aria-label={`Disminuir repeticiones de ${item.exercise.name}`}
                              className="flex h-9 w-9 cursor-pointer touch-manipulation items-center justify-center rounded-full text-zinc-300 transition-transform duration-100 active:scale-90 hover:bg-white/[0.08]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={200}
                              value={item.targetReps}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                updateItem(item.exercise.id, {
                                  targetReps: Number.isNaN(parsed)
                                    ? 1
                                    : Math.min(200, Math.max(1, parsed)),
                                });
                              }}
                              aria-label={`Repeticiones objetivo de ${item.exercise.name}`}
                              className="w-9 bg-transparent text-center text-base font-semibold text-white tabular-nums focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateItem(item.exercise.id, {
                                  targetReps: Math.min(200, item.targetReps + 1),
                                })
                              }
                              aria-label={`Aumentar repeticiones de ${item.exercise.name}`}
                              className="flex h-9 w-9 cursor-pointer touch-manipulation items-center justify-center rounded-full text-zinc-300 transition-transform duration-100 active:scale-90 hover:bg-white/[0.08]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Single Primary Thumb-Zone CTA */}
            <div className="shrink-0 bg-zinc-950/95 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] pt-3">
              <button
                type="button"
                onClick={handleLaunchSession}
                className="flex min-h-12 w-full cursor-pointer touch-manipulation items-center justify-center rounded-[16px] bg-rose-600 text-[15px] font-bold text-white shadow-lg shadow-rose-600/20 transition-transform duration-100 ease-out active:scale-[0.98] hover:bg-rose-500"
              >
                Iniciar sesión
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

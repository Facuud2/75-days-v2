'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import {
  Activity,
  Award,
  Calendar,
  Clock,
  Dumbbell,
  Flame,
  Gauge,
  MapPin,
  Play,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { WorkoutEntryRecord } from '@/lib/api/health';
import { formatMuscleLabel, SPORT_LABELS_ES } from '@/lib/constants/fitness';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

interface WorkoutSessionDetailSheetProps {
  workout: WorkoutEntryRecord | null;
  onClose: () => void;
  onRepeat: (workout: WorkoutEntryRecord) => void;
  onDelete: (workoutId: string) => void;
}

const INTENSITY_LABELS_ES: Record<string, string> = {
  low: 'Suave',
  light: 'Suave',
  easy: 'Suave',
  moderate: 'Media',
  medium: 'Media',
  high: 'Alta',
  vigorous: 'Muy alta',
  max: 'Máxima',
};

const SOURCE_LABELS_ES: Record<string, string> = {
  strava: 'Strava',
  tracker: 'Sesión guiada',
  manual: 'Registro manual',
};

const SET_TYPE_LABELS_ES: Record<string, string> = {
  warmup: 'Calentamiento',
  dropset: 'Drop set',
  failure: 'Al fallo',
};

const PR_METRIC_LABELS_ES: Record<string, { label: string; unit: string }> = {
  weight: { label: 'Peso máx.', unit: 'kg' },
  estimated1RM: { label: '1RM est.', unit: 'kg' },
  volume: { label: 'Volumen', unit: 'kg' },
};

function formatSessionDate(dateStr: string, createdAt?: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      const localDate = new Date(year, month - 1, day);
      const formattedDate = new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(localDate);

      if (createdAt) {
        const created = new Date(createdAt);
        if (!Number.isNaN(created.getTime())) {
          const time = new Intl.DateTimeFormat('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(created);
          return `${formattedDate} · ${time}`;
        }
      }
      return formattedDate;
    }
  } catch {
    // Fallback to raw string
  }
  return dateStr;
}

function formatIntensity(intensity?: string): string {
  if (!intensity) return 'Media';
  const normalized = intensity.trim().toLowerCase();
  return INTENSITY_LABELS_ES[normalized] || intensity;
}

export default function WorkoutSessionDetailSheet({
  workout,
  onClose,
  onRepeat,
  onDelete,
}: WorkoutSessionDetailSheetProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!workout) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 30);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [workout, onClose]);

  if (typeof document === 'undefined') return null;

  const enterTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING;
  const exitTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_EXIT_TRANSITION;

  return createPortal(
    <AnimatePresence>
      {workout ? (
        <motion.div
          key="workout-session-overlay"
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.2 }}
          onClick={onClose}
        >
          <motion.div
            key={workout.id}
            onClick={(e) => e.stopPropagation()}
            drag={!isDesktop && !reduceMotion ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.08, bottom: 0.45 }}
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
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] border border-zinc-800/90 bg-zinc-950 shadow-2xl sm:rounded-[24px]"
          >
            {/* Drag Handle + Header (touch-action: pan-x on handle so vertical drag belongs to sheet) */}
            <div
              onPointerDown={(e) => {
                if (!isDesktop && !reduceMotion) {
                  dragControls.start(e);
                }
              }}
              className="shrink-0 touch-pan-x select-none border-b border-zinc-800/70 px-4 pt-2 pb-3.5"
            >
              {!isDesktop && (
                <div className="mb-2.5 flex justify-center">
                  <span
                    aria-hidden="true"
                    className="h-1 w-9 rounded-full bg-zinc-500/35"
                  />
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      <Activity className="h-3 w-3" />
                      {SPORT_LABELS_ES[workout.sport] || workout.sport}
                    </span>
                    {workout.source && (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          workout.source === 'strava'
                            ? 'bg-orange-500/15 text-orange-500 dark:text-orange-400'
                            : workout.source === 'tracker'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        {SOURCE_LABELS_ES[workout.source] || workout.source}
                      </span>
                    )}
                  </div>

                  <h2
                    id={titleId}
                    className="mt-1.5 text-[19px] font-bold leading-snug tracking-[-0.02em] text-white"
                  >
                    {workout.title || SPORT_LABELS_ES[workout.sport] || workout.sport}
                  </h2>

                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-zinc-400 tabular-nums">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="capitalize">
                      {formatSessionDate(workout.date, workout.createdAt)}
                    </span>
                  </p>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar detalle de sesión"
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-zinc-900/80 text-zinc-400 transition-transform duration-100 ease-out active:scale-95 touch-manipulation select-none sm:hover:bg-zinc-800 sm:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body (isolated overscroll-contain) */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
              {/* Primary Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-[14px] border border-zinc-800/80 bg-zinc-900/55 p-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400">
                    <Clock className="h-3.5 w-3.5 text-rose-500" />
                    Duración
                  </div>
                  <p className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.03em] text-white tabular-nums whitespace-nowrap">
                    {workout.durationMin}{' '}
                    <span className="text-[13px] font-semibold text-zinc-400">min</span>
                  </p>
                </div>

                <div className="rounded-[14px] border border-zinc-800/80 bg-zinc-900/55 p-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    Calorías
                  </div>
                  <p className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.03em] text-amber-500 dark:text-amber-400 tabular-nums whitespace-nowrap">
                    {Math.round(workout.caloriesBurned)}{' '}
                    <span className="text-[13px] font-semibold text-zinc-400">kcal</span>
                  </p>
                </div>

                <div className="rounded-[14px] border border-zinc-800/80 bg-zinc-900/55 p-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400">
                    <Gauge className="h-3.5 w-3.5 text-sky-500" />
                    Intensidad
                  </div>
                  <p className="mt-1 text-[17px] font-bold leading-tight tracking-[-0.01em] text-white whitespace-nowrap">
                    {formatIntensity(workout.intensity)}
                  </p>
                </div>

                {workout.loadVolumeKg ? (
                  <div className="rounded-[14px] border border-zinc-800/80 bg-zinc-900/55 p-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400">
                      <Dumbbell className="h-3.5 w-3.5 text-emerald-500" />
                      Volumen movido
                    </div>
                    <p className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.03em] text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {Math.round(workout.loadVolumeKg)}{' '}
                      <span className="text-[13px] font-semibold text-zinc-400">kg</span>
                    </p>
                  </div>
                ) : workout.distanceKm ? (
                  <div className="rounded-[14px] border border-zinc-800/80 bg-zinc-900/55 p-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400">
                      <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                      Distancia
                    </div>
                    <p className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.03em] text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {workout.distanceKm.toFixed(2)}{' '}
                      <span className="text-[13px] font-semibold text-zinc-400">km</span>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-zinc-800/80 bg-zinc-900/55 p-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400">
                      <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
                      Ritmo calórico
                    </div>
                    <p className="mt-1 text-[17px] font-bold leading-tight tracking-[-0.01em] text-white tabular-nums whitespace-nowrap">
                      {workout.durationMin > 0
                        ? `${(workout.caloriesBurned / workout.durationMin).toFixed(1)} kcal/min`
                        : '—'}
                    </p>
                  </div>
                )}
              </div>

              {/* Personal Records */}
              {workout.personalRecords && workout.personalRecords.length > 0 && (
                <section className="space-y-1.5">
                  <h3 className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-zinc-400">
                    Récords personales
                  </h3>
                  <div className="divide-y divide-amber-500/15 overflow-hidden rounded-[14px] border border-amber-500/25 bg-amber-500/10">
                    {workout.personalRecords.map((pr, idx) => {
                      const metricMeta = PR_METRIC_LABELS_ES[pr.metric] || {
                        label: pr.metric,
                        unit: '',
                      };
                      return (
                        <div
                          key={`${pr.exerciseId}-${pr.metric}-${idx}`}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Award className="h-4 w-4 shrink-0 text-amber-500" />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-white">
                                {pr.exerciseName}
                              </p>
                              <p className="text-[11px] text-amber-500 dark:text-amber-300">
                                {metricMeta.label}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[13px] font-bold text-amber-600 dark:text-amber-300 tabular-nums whitespace-nowrap">
                            {pr.previousBest} → {pr.newBest} {metricMeta.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Exercises Breakdown (iOS Inset Grouped List) */}
              {workout.exercises && workout.exercises.length > 0 && (
                <section className="space-y-1.5">
                  <h3 className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-zinc-400">
                    Ejercicios ({workout.exercises.length})
                  </h3>
                  <div className="divide-y divide-zinc-800/70 overflow-hidden rounded-[14px] border border-zinc-800/80 bg-zinc-900/55">
                    {workout.exercises.map((ex, idx) => {
                      const subtitleParts = [
                        ex.primaryMuscle ? formatMuscleLabel(ex.primaryMuscle) : null,
                        ex.equipment || null,
                      ].filter(Boolean);

                      return (
                        <div key={ex.id || `${ex.exerciseId}-${idx}`} className="p-3.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[15px] font-semibold text-white">
                              {ex.exerciseName}
                            </p>
                            <span className="shrink-0 text-[12px] font-medium text-zinc-400 tabular-nums">
                              {ex.sets.length} {ex.sets.length === 1 ? 'serie' : 'series'}
                            </span>
                          </div>

                          {subtitleParts.length > 0 && (
                            <p className="mt-0.5 text-[12px] text-zinc-400">
                              {subtitleParts.join(' · ')}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {ex.sets.map((s, sIdx) => {
                              const typeLabel =
                                s.setType !== 'normal' ? SET_TYPE_LABELS_ES[s.setType] : null;
                              let setSummary = '';
                              if (s.durationSec && !s.reps) {
                                setSummary = `${s.durationSec}s`;
                              } else {
                                const load = s.weightKg ? `${s.weightKg}kg` : 'Corporal';
                                setSummary = `${load} × ${s.reps ?? '-'}`;
                              }
                              return (
                                <span
                                  key={s.id || sIdx}
                                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800/90 bg-zinc-950/70 px-2.5 py-1 text-[12px] font-medium text-zinc-200 tabular-nums"
                                >
                                  <span className="text-zinc-400">#{s.setNumber ?? sIdx + 1}</span>
                                  <span>{setSummary}</span>
                                  {typeLabel && (
                                    <span className="rounded bg-rose-600/15 px-1 py-0.2 text-[10px] font-semibold text-rose-500">
                                      {typeLabel}
                                    </span>
                                  )}
                                  {s.rpe ? (
                                    <span className="text-[10px] text-zinc-400">RPE {s.rpe}</span>
                                  ) : null}
                                </span>
                              );
                            })}
                          </div>

                          {ex.notes && (
                            <p className="mt-2 select-text text-[12px] leading-relaxed text-zinc-400">
                              {ex.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Notes */}
              {workout.notes && (
                <section className="space-y-1.5">
                  <h3 className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-zinc-400">
                    Notas
                  </h3>
                  <div className="rounded-[14px] border border-zinc-800/80 bg-zinc-900/55 p-3.5">
                    <p className="select-text whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-200">
                      {workout.notes}
                    </p>
                  </div>
                </section>
              )}

              {/* Session Metadata Inset List */}
              <section className="space-y-1.5">
                <h3 className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-zinc-400">
                  Resumen técnico
                </h3>
                <dl className="divide-y divide-zinc-800/70 overflow-hidden rounded-[14px] border border-zinc-800/80 bg-zinc-900/55 text-[14px]">
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-zinc-400">Actividad</dt>
                    <dd className="font-medium text-white">
                      {SPORT_LABELS_ES[workout.sport] || workout.sport}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-zinc-400">Origen</dt>
                    <dd className="font-medium text-white">
                      {SOURCE_LABELS_ES[workout.source || 'manual'] || workout.source}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-zinc-400">Cálculo calórico</dt>
                    <dd className="font-medium text-white">
                      {workout.isManualCalories ? 'Manual' : 'Estimado'}
                    </dd>
                  </div>
                  {workout.distanceKm ? (
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <dt className="text-zinc-400">Distancia</dt>
                      <dd className="font-medium text-white tabular-nums">
                        {workout.distanceKm.toFixed(2)} km
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            </div>

            {/* Sticky Footer with Safe-Area Clearance */}
            <div className="shrink-0 border-t border-zinc-800/70 bg-zinc-950/90 px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRepeat(workout);
                  }}
                  className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-rose-600 px-4 text-[15px] font-semibold text-[#ffffff] transition-transform duration-100 ease-out active:scale-[0.97] touch-manipulation select-none sm:hover:bg-rose-500"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Repetir esta sesión
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(workout.id)}
                  aria-label="Eliminar entrenamiento"
                  className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-[14px] border border-red-500/25 bg-red-500/10 px-3 text-red-500 transition-transform duration-100 ease-out active:scale-[0.97] touch-manipulation select-none sm:hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

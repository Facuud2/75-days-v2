'use client';

import { useEffect, useState } from 'react';
import {
  Award,
  ChevronDown,
  ChevronUp,
  Flame,
  History,
  Layers,
  Play,
  Plus,
  Wrench,
  X,
} from 'lucide-react';
import type { CatalogExercise } from '@/lib/api/exerciseCatalog';
import { ExerciseHistoryResponse, healthService } from '@/lib/api/health';
import ExerciseImagePreview from './ExerciseImagePreview';

interface ExerciseDetailSheetProps {
  exercise: CatalogExercise | null;
  imageBaseUrl?: string;
  onClose: () => void;
  onAddToActive?: (exercise: CatalogExercise) => void;
  hasActiveWorkout?: boolean;
}

function describeIntensityFromMet(met: number): { label: string; kcalPerHour: number } {
  const kcalPerHour = Math.round(met * 70);
  if (met >= 7) return { label: 'Alta', kcalPerHour };
  if (met >= 4.5) return { label: 'Media', kcalPerHour };
  return { label: 'Suave', kcalPerHour };
}

export default function ExerciseDetailSheet({
  exercise,
  imageBaseUrl,
  onClose,
  onAddToActive,
  hasActiveWorkout = false,
}: ExerciseDetailSheetProps) {
  const [history, setHistory] = useState<ExerciseHistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showOriginalSteps, setShowOriginalSteps] = useState(false);

  useEffect(() => {
    if (!exercise) return;
    setShowOriginalSteps(false);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [exercise, onClose]);

  useEffect(() => {
    if (!exercise) {
      setHistory(null);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    healthService
      .getExerciseHistory(exercise.id)
      .then((res) => {
        if (!cancelled) setHistory(res);
      })
      .catch(() => {
        if (!cancelled) setHistory(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [exercise]);

  if (!exercise) return null;

  const muscleBadge =
    exercise.bodyZoneLabel.toLowerCase() === exercise.primaryMuscleLabel.toLowerCase()
      ? exercise.primaryMuscleLabel
      : `${exercise.bodyZoneLabel} · ${exercise.primaryMuscleLabel}`;

  const intensityInfo = describeIntensityFromMet(exercise.metValue);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-detail-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-900 px-5 py-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              {muscleBadge}
            </span>
            <h2
              id="exercise-detail-title"
              className="mt-1.5 text-lg font-bold leading-snug text-white"
            >
              {exercise.name}
            </h2>
            {exercise.nameEn && exercise.nameEn !== exercise.name && (
              <p className="text-xs text-zinc-400">{exercise.nameEn}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle del ejercicio"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-zinc-900 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
          {/* Animated 2-frame movement preview */}
          <ExerciseImagePreview
            images={exercise.images}
            imageBaseUrl={imageBaseUrl}
            alt={exercise.name}
            animate
            showControls
            className="h-52 w-full rounded-2xl"
          />

          {/* Plain-language metadata cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                <Wrench className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                Equipo
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-white">
                {exercise.equipmentLabel}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                <Layers className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                Nivel
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-white">
                {exercise.levelLabel}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                <Flame className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                Esfuerzo
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-white">
                {intensityInfo.label}
              </p>
            </div>
          </div>

          {exercise.secondaryMuscles.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                También trabaja
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {exercise.secondaryMuscles.map((m) => (
                  <span
                    key={m.key}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300"
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Personal History & PRs */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
                <Award className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                Tu historial
              </h3>
              {history && history.sessions.length > 0 && (
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  {history.sessions.length}{' '}
                  {history.sessions.length === 1 ? 'sesión' : 'sesiones'}
                </span>
              )}
            </div>

            {loadingHistory ? (
              <div className="mt-3 h-12 animate-pulse rounded-xl bg-zinc-800/60" />
            ) : history && history.sessions.length > 0 ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-zinc-950/70 p-2.5 text-center">
                    <p className="text-[11px] font-medium text-zinc-400">Peso máximo</p>
                    <p className="mt-0.5 text-base font-bold text-white tabular-nums">
                      {history.personalBest.maxWeightKg} kg
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/70 p-2.5 text-center">
                    <p className="text-[11px] font-medium text-zinc-400">Mejor sesión</p>
                    <p className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {Math.round(history.personalBest.maxSessionVolumeKg)} kg
                    </p>
                  </div>
                </div>

                {history.lastSession && (
                  <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
                      <History className="h-3.5 w-3.5" />
                      Última vez ({history.lastSession.date})
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {history.lastSession.sets.map((s, idx) => (
                        <span
                          key={s.id || idx}
                          className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-medium text-zinc-200 tabular-nums"
                        >
                          {s.weightKg ? `${s.weightKg}kg` : 'Corporal'} × {s.reps ?? '-'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Todavía no hiciste este ejercicio. Cuando lo registres en una sesión, aquí verás tu mejor peso y tu última marca automáticamente.
              </p>
            )}
          </div>

          {/* Collapsible reference guide (only expanded if user wants original English steps) */}
          {exercise.instructions.length > 0 && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3.5">
              <button
                type="button"
                onClick={() => setShowOriginalSteps((prev) => !prev)}
                aria-expanded={showOriginalSteps}
                className="flex min-h-9 w-full cursor-pointer items-center justify-between text-xs font-semibold text-zinc-300"
              >
                <span>
                  {exercise.isCustom
                    ? 'Notas técnicas'
                    : 'Ver guía paso a paso (referencia en inglés)'}
                </span>
                {showOriginalSteps ? (
                  <ChevronUp className="h-4 w-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-400" />
                )}
              </button>

              {showOriginalSteps && (
                <ol className="mt-3 space-y-2 border-t border-zinc-800/70 pt-3">
                  {exercise.instructions.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2.5 text-xs leading-relaxed text-zinc-300"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600/15 text-[11px] font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Thumb-zone CTA footer */}
        {onAddToActive && (
          <div className="border-t border-zinc-900 bg-zinc-950/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <button
              type="button"
              onClick={() => {
                onAddToActive(exercise);
                onClose();
              }}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-[#ffffff] shadow-lg shadow-rose-600/20 transition-transform active:scale-[0.98] hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              {hasActiveWorkout ? (
                <>
                  <Plus className="h-4 w-4" />
                  Añadir a mi sesión activa
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  Empezar sesión con este ejercicio
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

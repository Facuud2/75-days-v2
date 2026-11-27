'use client';

import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCcw,
  SkipForward,
  Timer,
} from 'lucide-react';
import type { CatalogExercise } from '@/lib/api/exerciseCatalog';
import { formatMuscleLabel } from '@/lib/constants/fitness';
import type { ActiveExerciseState } from '@/store/useActiveWorkoutStore';
import ExerciseImagePreview from './ExerciseImagePreview';
import { RestCountdownRing } from './WorkoutActivityRings';

export interface GuidedRestState {
  remainingSec: number;
  totalSec: number;
  isExerciseTransition: boolean;
  nextLabel: string;
  skipButtonLabel: string;
  canUndo: boolean;
  onAddSeconds: (delta: number) => void;
  onSkip: () => void;
  onUndo: () => void;
}

interface ActiveExerciseCardProps {
  exercise: ActiveExerciseState;
  catalogEntry?: CatalogExercise;
  imageBaseUrl?: string;
  isFocused: boolean;
  focusMode?: boolean;
  pausePreview?: boolean;
  justConfirmedSetNumber?: number | null;
  guidedRest?: GuidedRestState | null;
  onInspectExercise?: (catalogExercise: CatalogExercise) => void;
  onToggleSetComplete: (uid: string, setId: string) => void;
  onCompleteActiveSet?: (uid: string, setId: string, setNumber: number) => void;
  onOpenFinish?: () => void;
}

export default function ActiveExerciseCard({
  exercise,
  catalogEntry,
  imageBaseUrl,
  isFocused,
  focusMode = false,
  pausePreview = false,
  justConfirmedSetNumber = null,
  guidedRest = null,
  onInspectExercise,
  onToggleSetComplete,
  onCompleteActiveSet,
  onOpenFinish,
}: ActiveExerciseCardProps) {
  const completedCount = exercise.sets.filter((s) => s.completed).length;
  const totalCount = exercise.sets.length;
  const allCompleted = totalCount > 0 && completedCount === totalCount;
  const activeSet = exercise.sets.find((s) => !s.completed) ?? null;

  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const isExpanded = focusMode ? true : (manualExpanded ?? !allCompleted);

  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Guided Focus Mode (single-hand execution + wide preview + fixed-height stage)
  if (focusMode) {
    const isResting = Boolean(guidedRest && guidedRest.remainingSec > 0);
    const isConfirming = justConfirmedSetNumber !== null;
    const quickInstruction = catalogEntry?.instructions?.[0] ?? null;

    return (
      <section className="flex flex-col rounded-[28px] border border-white/[0.08] bg-zinc-900/75 p-3">
        {/* Prominent Motion Preview Banner — concentric radius (28px - 12px = 16px) */}
        <button
          type="button"
          onClick={() => catalogEntry && onInspectExercise?.(catalogEntry)}
          disabled={!catalogEntry || !onInspectExercise}
          aria-label={
            catalogEntry
              ? `Ver técnica de ${exercise.exerciseName}`
              : exercise.exerciseName
          }
          className={`group relative block h-36 sm:h-44 w-full overflow-hidden rounded-[16px] border border-white/[0.06] bg-zinc-950/70 text-left select-none [-webkit-touch-callout:none] ${
            catalogEntry && onInspectExercise
              ? 'cursor-pointer touch-manipulation transition-transform duration-100 ease-out active:scale-[0.99]'
              : ''
          }`}
        >
          <ExerciseImagePreview
            images={catalogEntry?.images}
            imageBaseUrl={imageBaseUrl}
            alt={exercise.exerciseName}
            animate={!pausePreview}
            showControls={false}
            className="h-full w-full rounded-none border-0"
          />

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/65 to-transparent"
            aria-hidden="true"
          />

          {isResting && guidedRest?.isExerciseTransition && (
            <span className="absolute top-2.5 left-2.5 rounded-full border border-white/15 bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[#ffffff] backdrop-blur-md">
              Siguiente
            </span>
          )}

          {catalogEntry && onInspectExercise && (
            <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-[#ffffff] backdrop-blur-md transition-colors group-hover:bg-black/90">
              <Info className="h-3.5 w-3.5 text-zinc-200" strokeWidth={2} aria-hidden="true" />
              Técnica
            </span>
          )}
        </button>

        {/* Exercise Identity + Visual Set Dots */}
        <div className="mt-3 flex items-start justify-between gap-3 px-1">
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-bold leading-snug tracking-[-0.015em] text-white">
              {exercise.exerciseName}
            </h2>
            <p className="mt-0.5 line-clamp-1 text-[13px] text-zinc-400">
              {formatMuscleLabel(exercise.primaryMuscle)}
              {quickInstruction ? ` · ${quickInstruction}` : ` · ${exercise.restSec}s`}
            </p>
          </div>

          <div
            className="mt-1.5 flex shrink-0 items-center gap-1.5"
            aria-label={`${completedCount} de ${totalCount} series completadas`}
          >
            {exercise.sets.map((s) => {
              const isCurrentDot = !isResting && activeSet?.id === s.id;
              return (
                <span
                  key={s.id}
                  className={`h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                    s.completed
                      ? 'w-2.5 bg-emerald-500'
                      : isCurrentDot
                        ? 'w-5 bg-rose-500'
                        : 'w-2.5 bg-zinc-700'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Fixed-Height Central Execution Stage — alpha hairline separation (zero nested card) */}
        <div className="mt-3.5 flex h-[228px] flex-col items-center justify-between border-t border-white/[0.08] px-1 pt-3.5 pb-1">
          {isResting && guidedRest ? (
            /* REST STATE: Single circular protagonist in Rose/Coral */
            <div className="flex h-full w-full flex-col items-center justify-between">
              <div className="flex w-full items-center justify-between gap-2">
                <p className="truncate text-[12px] font-semibold text-zinc-400">
                  {guidedRest.nextLabel}
                </p>

                {guidedRest.canUndo && (
                  <button
                    type="button"
                    onClick={guidedRest.onUndo}
                    className="inline-flex min-h-9 shrink-0 cursor-pointer select-none touch-manipulation items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-zinc-400 [-webkit-touch-callout:none] transition-colors active:scale-95 hover:bg-white/[0.06] hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    Deshacer
                  </button>
                )}
              </div>

              <RestCountdownRing
                remainingSec={guidedRest.remainingSec}
                totalSec={guidedRest.totalSec}
              />

              <div className="flex w-full items-center gap-2">
                <button
                  type="button"
                  onClick={() => guidedRest.onAddSeconds(15)}
                  className="min-h-11 w-[84px] shrink-0 cursor-pointer select-none touch-manipulation rounded-[14px] border border-white/[0.08] bg-zinc-950/70 text-xs font-bold text-zinc-200 tabular-nums [-webkit-touch-callout:none] transition-transform duration-100 ease-out active:scale-[0.97] hover:bg-zinc-800"
                >
                  +15s
                </button>

                <button
                  type="button"
                  onClick={guidedRest.onSkip}
                  className="inline-flex min-h-11 flex-1 cursor-pointer select-none touch-manipulation items-center justify-center gap-1.5 rounded-[14px] bg-rose-600 px-4 text-xs font-bold text-[#ffffff] [-webkit-touch-callout:none] shadow-sm shadow-rose-600/20 transition-transform duration-100 ease-out active:scale-[0.97] hover:bg-rose-500"
                >
                  <SkipForward className="h-3.5 w-3.5 shrink-0 translate-x-[0.5px]" strokeWidth={2.25} aria-hidden="true" />
                  <span className="truncate">{guidedRest.skipButtonLabel}</span>
                </button>
              </div>
            </div>
          ) : activeSet ? (
            /* ACTIVE SET STATE */
            <div className="flex h-full w-full flex-col items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-zinc-400 tabular-nums">
                Serie {activeSet.setNumber}
                {activeSet.previousLabel ? ` · Ant: ${activeSet.previousLabel}` : ''}
              </span>

              <div className="flex flex-col items-center text-center select-none">
                <span className="text-[44px] sm:text-[52px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums whitespace-nowrap [font-optical-sizing:auto]">
                  {activeSet.reps || '—'}
                </span>
                <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Reps
                </span>
              </div>

              <button
                type="button"
                disabled={isConfirming}
                onClick={() => {
                  if (onCompleteActiveSet) {
                    onCompleteActiveSet(exercise.uid, activeSet.id, activeSet.setNumber);
                  } else {
                    onToggleSetComplete(exercise.uid, activeSet.id);
                  }
                }}
                className={`flex min-h-12 w-full cursor-pointer select-none touch-manipulation items-center justify-center gap-2 rounded-[16px] text-[15px] font-bold text-[#ffffff] [-webkit-touch-callout:none] shadow-sm transition-all duration-150 ease-out active:scale-[0.97] ${
                  isConfirming
                    ? 'bg-emerald-500 shadow-emerald-500/20'
                    : 'bg-rose-600 shadow-rose-600/20 hover:bg-rose-500'
                }`}
              >
                <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
                {isConfirming
                  ? `Serie ${justConfirmedSetNumber} lista`
                  : `Completar Serie ${activeSet.setNumber}`}
              </button>
            </div>
          ) : (
            /* REVISITING ALREADY-COMPLETED EXERCISE */
            <div className="flex h-full w-full flex-col items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-emerald-400">
                Completado
              </span>

              <div className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-zinc-300 tabular-nums">
                  {completedCount}/{totalCount} series
                </p>
              </div>

              {onOpenFinish ? (
                <button
                  type="button"
                  onClick={onOpenFinish}
                  className="flex min-h-12 w-full cursor-pointer select-none touch-manipulation items-center justify-center gap-2 rounded-[16px] bg-emerald-600 text-[15px] font-bold text-[#ffffff] [-webkit-touch-callout:none] transition-transform duration-100 ease-out active:scale-[0.97] hover:bg-emerald-500"
                >
                  <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
                  Finalizar sesión
                </button>
              ) : (
                <div className="h-12" />
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Fallback compact list card (when focusMode is false)
  return (
    <section
      className={`rounded-[20px] border transition-colors ${
        allCompleted
          ? 'border-emerald-500/30 bg-emerald-950/15'
          : isFocused
            ? 'border-rose-500/35 bg-zinc-900/75'
            : 'border-white/[0.08] bg-zinc-900/60'
      } p-4`}
    >
      {!isExpanded ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setManualExpanded(true)}
            className="flex min-w-0 flex-1 cursor-pointer touch-manipulation items-center gap-3 text-left"
          >
            <ExerciseImagePreview
              images={catalogEntry?.images}
              imageBaseUrl={imageBaseUrl}
              alt={exercise.exerciseName}
              className="h-11 w-11 rounded-[12px]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <h3 className="truncate text-[15px] font-semibold text-white">
                  {exercise.exerciseName}
                </h3>
              </div>
              <p className="mt-0.5 text-[12px] text-zinc-400 tabular-nums">
                {completedCount}/{totalCount} series
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setManualExpanded(true)}
            aria-label={`Expandir ${exercise.exerciseName}`}
            className="flex h-11 w-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-[12px] bg-white/[0.04] text-zinc-300 hover:bg-white/10"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => catalogEntry && onInspectExercise?.(catalogEntry)}
              disabled={!catalogEntry}
              aria-label={
                catalogEntry
                  ? `Ver técnica de ${exercise.exerciseName}`
                  : exercise.exerciseName
              }
              className={`shrink-0 overflow-hidden rounded-[12px] ${
                catalogEntry
                  ? 'cursor-pointer touch-manipulation ring-1 ring-white/10 transition-transform duration-100 active:scale-95 hover:ring-rose-500/60'
                  : ''
              }`}
            >
              <ExerciseImagePreview
                images={catalogEntry?.images}
                imageBaseUrl={imageBaseUrl}
                alt={exercise.exerciseName}
                animate={isFocused && !pausePreview}
                showControls={false}
                className="h-16 w-16 rounded-[12px] sm:h-20 sm:w-20"
              />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[16px] font-bold leading-snug text-white">
                    {exercise.exerciseName}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-zinc-400 tabular-nums">
                    {formatMuscleLabel(exercise.primaryMuscle)} · {completedCount}/{totalCount} series
                  </p>
                </div>

                {allCompleted && (
                  <button
                    type="button"
                    onClick={() => setManualExpanded(false)}
                    aria-label={`Colapsar ${exercise.exerciseName}`}
                    className="flex h-11 w-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-[12px] text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex min-h-8 items-center gap-1 rounded-[10px] bg-white/[0.05] px-2.5 text-[11px] font-semibold text-zinc-300 tabular-nums">
                  <Timer className="h-3 w-3 text-rose-400" />
                  {exercise.restSec}s
                </span>

                {catalogEntry && onInspectExercise && (
                  <button
                    type="button"
                    onClick={() => onInspectExercise(catalogEntry)}
                    className="inline-flex min-h-8 cursor-pointer touch-manipulation items-center gap-1 rounded-[10px] bg-white/[0.05] px-2.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Info className="h-3 w-3 text-zinc-300" />
                    Técnica
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                allCompleted ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="mt-4">
            <div className="grid grid-cols-[44px_1fr_52px] items-center gap-2 px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <span className="text-center">Serie</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Listo</span>
            </div>

            <div className="divide-y divide-white/[0.06] overflow-hidden rounded-[12px] border border-white/[0.06] bg-zinc-950/60">
              {exercise.sets.map((s) => (
                <div
                  key={s.id}
                  className={`grid grid-cols-[44px_1fr_52px] items-center gap-2 px-2 py-1.5 transition-colors ${
                    s.completed ? 'bg-emerald-500/12' : 'bg-transparent'
                  }`}
                >
                  <span className="flex h-11 items-center justify-center text-[13px] font-bold text-zinc-300 tabular-nums">
                    {s.setNumber}
                  </span>

                  <span className="flex h-11 items-center justify-center text-[16px] font-bold text-white tabular-nums">
                    {s.reps || '—'}
                  </span>

                  <button
                    type="button"
                    onClick={() => onToggleSetComplete(exercise.uid, s.id)}
                    aria-label={
                      s.completed
                        ? `Desmarcar serie ${s.setNumber}`
                        : `Completar serie ${s.setNumber}`
                    }
                    aria-pressed={s.completed}
                    className={`flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-[12px] border transition-colors duration-100 active:scale-95 ${
                      s.completed
                        ? 'border-emerald-500 bg-emerald-500 text-[#ffffff]'
                        : 'border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <Check className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

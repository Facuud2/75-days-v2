'use client';

import { useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Minus,
  Plus,
  StickyNote,
  Timer,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CatalogExercise } from '@/lib/api/exerciseCatalog';
import { formatMuscleLabel } from '@/lib/constants/fitness';
import type { ActiveExerciseState, ActiveSetState } from '@/store/useActiveWorkoutStore';
import ExerciseImagePreview from './ExerciseImagePreview';

interface ActiveExerciseCardProps {
  exercise: ActiveExerciseState;
  catalogEntry?: CatalogExercise;
  imageBaseUrl?: string;
  isFocused: boolean;
  focusMode?: boolean;
  onInspectExercise?: (catalogExercise: CatalogExercise) => void;
  onUpdateRest: (uid: string, restSec: number) => void;
  onRemoveExercise: (uid: string) => void;
  onAddSet: (uid: string) => void;
  onRemoveSet: (uid: string, setId: string) => void;
  onUpdateSet: (uid: string, setId: string, patch: Partial<ActiveSetState>) => void;
  onToggleSetComplete: (uid: string, setId: string) => void;
  onUpdateNotes: (uid: string, notes: string) => void;
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
  if (setType === 'warmup') {
    return { label: 'W', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  }
  if (setType === 'dropset') {
    return { label: 'D', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
  }
  if (setType === 'failure') {
    return { label: 'F', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  }
  return { label: String(setNumber), cls: 'bg-zinc-900 text-zinc-200 border-white/[0.08]' };
}

function isLivePr(s: ActiveSetState): boolean {
  if (!s.completed || s.setType === 'warmup') return false;
  const w = Number(s.weightKg) || 0;
  const r = Number(s.reps) || 0;
  if (r <= 0) return false;
  const prevW = s.previousWeightKg ?? 0;
  const prevR = s.previousReps ?? 0;
  if (prevW <= 0 && prevR <= 0) return false;
  if (w > prevW) return true;
  if (w === prevW && r > prevR) return true;
  return false;
}

export default function ActiveExerciseCard({
  exercise,
  catalogEntry,
  imageBaseUrl,
  isFocused,
  focusMode = false,
  onInspectExercise,
  onUpdateRest,
  onRemoveExercise,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onToggleSetComplete,
  onUpdateNotes,
}: ActiveExerciseCardProps) {
  const completedCount = exercise.sets.filter((s) => s.completed).length;
  const totalCount = exercise.sets.length;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [showNotes, setShowNotes] = useState(() => Boolean(exercise.notes));

  const isExpanded = focusMode ? true : (manualExpanded ?? !allCompleted);
  const isBodyweight = exercise.equipment === 'body_only';
  const hasPreviousData = exercise.sets.some((s) => Boolean(s.previousLabel));

  const exerciseVolumeKg = exercise.sets.reduce((acc, s) => {
    if (!s.completed || s.setType === 'warmup') return acc;
    const w = Number(s.weightKg) || 0;
    const r = Number(s.reps) || 0;
    return w > 0 && r > 0 ? acc + w * r : acc;
  }, 0);

  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <section
      className={`rounded-[24px] border transition-colors ${
        allCompleted
          ? 'border-emerald-500/30 bg-emerald-950/15'
          : isFocused && !focusMode
            ? 'border-rose-500/35 bg-zinc-900/75'
            : 'border-white/[0.07] bg-zinc-900/55'
      } p-4`}
    >
      {/* Collapsed Summary View (only in list mode) */}
      {!isExpanded ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setManualExpanded(true)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
          >
            <ExerciseImagePreview
              images={catalogEntry?.images}
              imageBaseUrl={imageBaseUrl}
              alt={exercise.exerciseName}
              className="h-11 w-11 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <h3 className="truncate text-sm font-bold text-white">
                  {exercise.exerciseName}
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400 tabular-nums">
                {completedCount}/{totalCount} series
                {exerciseVolumeKg > 0 ? ` · ${Math.round(exerciseVolumeKg)} kg` : ''}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setManualExpanded(true)}
            aria-label={`Expandir ${exercise.exerciseName}`}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-white/[0.04] text-zinc-300 hover:bg-white/10"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Clean Header without overlaid controls on small thumbnail */}
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
              className={`shrink-0 overflow-hidden rounded-2xl ${
                catalogEntry
                  ? 'cursor-pointer ring-1 ring-white/10 transition-all hover:ring-rose-500/60 active:scale-95'
                  : ''
              }`}
            >
              <ExerciseImagePreview
                images={catalogEntry?.images}
                imageBaseUrl={imageBaseUrl}
                alt={exercise.exerciseName}
                animate={focusMode || isFocused}
                showControls={false}
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl"
              />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-bold leading-snug text-white">
                    {exercise.exerciseName}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400 tabular-nums">
                    {formatMuscleLabel(exercise.primaryMuscle)}
                    {isBodyweight ? ' · Peso corporal' : ''} · {completedCount}/{totalCount} series
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!focusMode && allCompleted && (
                    <button
                      type="button"
                      onClick={() => setManualExpanded(false)}
                      aria-label={`Colapsar ${exercise.exerciseName}`}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveExercise(exercise.uid)}
                    aria-label={`Quitar ${exercise.exerciseName}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Clean, lightweight secondary action chips */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const presets = [60, 90, 120, 150, 180];
                    const idx = presets.indexOf(exercise.restSec);
                    const next = presets[(idx + 1) % presets.length];
                    onUpdateRest(exercise.uid, next);
                    toast(`Descanso: ${next}s`, { duration: 1200 });
                  }}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-white/10 tabular-nums"
                >
                  <Timer className="h-3 w-3 text-rose-400" />
                  {exercise.restSec}s
                </button>

                {catalogEntry && onInspectExercise && (
                  <button
                    type="button"
                    onClick={() => onInspectExercise(catalogEntry)}
                    className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Info className="h-3 w-3 text-sky-400" />
                    Técnica
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowNotes((v) => !v)}
                  aria-expanded={showNotes}
                  className={`inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                    showNotes || exercise.notes
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-white/[0.05] text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                  }`}
                >
                  <StickyNote className="h-3 w-3" />
                  Notas
                </button>
              </div>
            </div>
          </div>

          {/* Slim per-exercise progress hairline */}
          <div className="mt-3.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                allCompleted ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Collapsible per-exercise notes */}
          {showNotes && (
            <div className="mt-3">
              <input
                type="text"
                maxLength={240}
                value={exercise.notes}
                onChange={(e) => onUpdateNotes(exercise.uid, e.target.value)}
                placeholder="Ej: Agarre neutro, bajar lento en 3s..."
                aria-label={`Notas para ${exercise.exerciseName}`}
                className="min-h-10 w-full rounded-xl border border-white/10 bg-zinc-950/90 px-3 text-xs text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
              />
            </div>
          )}

          {/* Adaptive Sets Table — hides dead "Anterior" column when empty */}
          <div className="mt-4 space-y-2">
            <div
              className={`grid items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 ${
                hasPreviousData
                  ? 'grid-cols-[36px_minmax(60px,0.85fr)_1fr_1fr_46px]'
                  : 'grid-cols-[38px_1fr_1fr_48px]'
              }`}
            >
              <span className="text-center">Serie</span>
              {hasPreviousData && <span>Ant.</span>}
              <span className="text-center">{isBodyweight ? 'Lastre' : 'kg'}</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Listo</span>
            </div>

            {exercise.sets.map((s) => {
              const badge = getSetBadge(s.setType, s.setNumber);
              const pr = isLivePr(s);
              return (
                <div
                  key={s.id}
                  className={`grid items-center gap-2 rounded-2xl p-1 transition-colors ${
                    hasPreviousData
                      ? 'grid-cols-[36px_minmax(60px,0.85fr)_1fr_1fr_46px]'
                      : 'grid-cols-[38px_1fr_1fr_48px]'
                  } ${s.completed ? 'bg-emerald-500/12' : 'bg-transparent'}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const nextType =
                        SET_TYPE_CYCLE[
                          (SET_TYPE_CYCLE.indexOf(s.setType) + 1) % SET_TYPE_CYCLE.length
                        ];
                      onUpdateSet(exercise.uid, s.id, { setType: nextType });
                      toast(SET_TYPE_NAME[nextType], { duration: 1200 });
                    }}
                    aria-label={`Tipo de serie ${s.setNumber}: ${SET_TYPE_NAME[s.setType]}`}
                    className={`flex h-11 w-full cursor-pointer items-center justify-center rounded-xl border text-xs font-bold tabular-nums transition-transform active:scale-95 ${badge.cls}`}
                  >
                    {badge.label}
                  </button>

                  {hasPreviousData && (
                    <div className="flex min-w-0 items-center gap-1">
                      {s.previousLabel ? (
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateSet(exercise.uid, s.id, {
                              weightKg:
                                s.previousWeightKg != null
                                  ? String(s.previousWeightKg)
                                  : s.weightKg,
                              reps: s.previousReps != null ? String(s.previousReps) : s.reps,
                            });
                          }}
                          title="Tocar para copiar marca anterior"
                          className="min-h-10 min-w-0 flex-1 cursor-pointer truncate rounded-lg px-1 text-left text-xs font-medium text-zinc-400 tabular-nums hover:bg-white/[0.06] hover:text-zinc-200"
                        >
                          {s.previousLabel}
                        </button>
                      ) : (
                        <span className="px-1 text-xs text-zinc-600" aria-hidden="true">
                          —
                        </span>
                      )}
                      {pr && (
                        <span
                          title="Nuevo récord personal"
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-amber-500/20 px-1 py-0.5 text-[9px] font-extrabold text-amber-300"
                        >
                          <Award className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  )}

                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    placeholder={
                      s.previousWeightKg != null
                        ? String(s.previousWeightKg)
                        : isBodyweight
                          ? 'PC'
                          : '0'
                    }
                    value={s.weightKg}
                    onChange={(e) =>
                      onUpdateSet(exercise.uid, s.id, { weightKg: e.target.value })
                    }
                    aria-label={`Peso kg serie ${s.setNumber}`}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-zinc-950/85 px-2 text-center text-base font-bold text-white tabular-nums placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
                  />

                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder={s.previousReps != null ? String(s.previousReps) : '0'}
                    value={s.reps}
                    onChange={(e) =>
                      onUpdateSet(exercise.uid, s.id, { reps: e.target.value })
                    }
                    aria-label={`Repeticiones serie ${s.setNumber}`}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-zinc-950/85 px-2 text-center text-base font-bold text-white tabular-nums placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => onToggleSetComplete(exercise.uid, s.id)}
                    aria-label={
                      s.completed
                        ? `Desmarcar serie ${s.setNumber}`
                        : `Completar serie ${s.setNumber}`
                    }
                    aria-pressed={s.completed}
                    className={`flex h-11 w-full cursor-pointer items-center justify-center rounded-xl transition-transform active:scale-90 ${
                      s.completed
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'border border-white/[0.08] bg-zinc-950/80 text-zinc-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <Check className="h-5 w-5" strokeWidth={2.8} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add / remove set footer */}
          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddSet(exercise.uid)}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white/[0.05] text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/10 active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5 text-rose-400" />
              Añadir serie
            </button>
            {exercise.sets.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onRemoveSet(exercise.uid, exercise.sets[exercise.sets.length - 1].id)
                }
                aria-label="Eliminar última serie"
                className="flex min-h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white/[0.04] text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

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
    return { label: 'F', cls: 'bg-rose-600/15 text-rose-400 border-rose-600/30' };
  }
  return { label: String(setNumber), cls: 'bg-zinc-900 text-zinc-200 border-zinc-800' };
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

  const isExpanded = manualExpanded ?? !allCompleted;
  const isBodyweight = exercise.equipment === 'body_only';

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
      className={`rounded-3xl border transition-colors ${
        allCompleted
          ? 'border-emerald-500/30 bg-emerald-950/15'
          : isFocused
            ? 'border-rose-500/45 bg-zinc-900/80 shadow-lg shadow-rose-950/20'
            : 'border-zinc-800/90 bg-zinc-900/60'
      } p-4`}
    >
      {/* Collapsed Summary View */}
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
              className="h-12 w-12 rounded-xl"
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
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Expanded Header with Visible Animation */}
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
                catalogEntry ? 'cursor-pointer ring-1 ring-zinc-800 hover:ring-rose-500/60' : ''
              }`}
            >
              <ExerciseImagePreview
                images={catalogEntry?.images}
                imageBaseUrl={imageBaseUrl}
                alt={exercise.exerciseName}
                animate={isFocused || !allCompleted}
                showControls={Boolean(catalogEntry?.images?.length && catalogEntry.images.length > 1)}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl"
              />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isFocused && !allCompleted && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                        En foco
                      </span>
                    )}
                    {isBodyweight && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
                        Peso corporal
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-base font-bold leading-snug text-white">
                    {exercise.exerciseName}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {formatMuscleLabel(exercise.primaryMuscle)} · {completedCount}/{totalCount} series
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {allCompleted && (
                    <button
                      type="button"
                      onClick={() => setManualExpanded(false)}
                      aria-label={`Colapsar ${exercise.exerciseName}`}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white"
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

              {/* Quick action pills: Rest timer, Technique, Notes */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const presets = [60, 90, 120, 150, 180];
                    const idx = presets.indexOf(exercise.restSec);
                    const next = presets[(idx + 1) % presets.length];
                    onUpdateRest(exercise.uid, next);
                    toast(`Descanso ajustado a ${next}s`, { duration: 1400 });
                  }}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/80 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-700 tabular-nums"
                >
                  <Timer className="h-3 w-3 text-rose-400" />
                  {exercise.restSec}s
                </button>

                {catalogEntry && onInspectExercise && (
                  <button
                    type="button"
                    onClick={() => onInspectExercise(catalogEntry)}
                    className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/80 px-2.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white"
                  >
                    <Info className="h-3 w-3 text-sky-400" />
                    Técnica
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowNotes((v) => !v)}
                  aria-expanded={showNotes}
                  className={`inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-xl border px-2.5 text-[11px] font-semibold transition-colors ${
                    showNotes || exercise.notes
                      ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
                      : 'border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <StickyNote className="h-3 w-3" />
                  Notas
                </button>
              </div>
            </div>
          </div>

          {/* Per-exercise progress bar */}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-800/80">
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
                className="min-h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
              />
            </div>
          )}

          {/* Sets grid */}
          <div className="mt-3.5 space-y-2">
            <div className="grid grid-cols-[40px_1fr_72px_66px_44px] items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <span className="text-center">Serie</span>
              <span>Anterior</span>
              <span className="text-center">{isBodyweight ? 'Lastre' : 'kg'}</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Hecho</span>
            </div>

            {exercise.sets.map((s) => {
              const badge = getSetBadge(s.setType, s.setNumber);
              const pr = isLivePr(s);
              return (
                <div
                  key={s.id}
                  className={`grid grid-cols-[40px_1fr_72px_66px_44px] items-center gap-2 rounded-2xl p-1 transition-colors ${
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
                      onUpdateSet(exercise.uid, s.id, { setType: nextType });
                      toast(SET_TYPE_NAME[nextType], { duration: 1200 });
                    }}
                    aria-label={`Tipo de serie ${s.setNumber}: ${SET_TYPE_NAME[s.setType]}`}
                    className={`flex h-11 w-[40px] cursor-pointer items-center justify-center rounded-xl border text-xs font-bold tabular-nums transition-transform active:scale-95 ${badge.cls}`}
                  >
                    {badge.label}
                  </button>

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
                        className="min-h-10 min-w-0 flex-1 cursor-pointer truncate rounded-lg px-1.5 text-left text-xs font-medium text-zinc-300 tabular-nums hover:bg-zinc-900"
                      >
                        {s.previousLabel}
                      </button>
                    ) : (
                      <span className="px-1.5 text-xs text-zinc-500" aria-hidden="true">
                        —
                      </span>
                    )}
                    {pr && (
                      <span
                        title="Nuevo récord personal en esta sesión"
                        className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300"
                      >
                        <Award className="h-2.5 w-2.5" />
                        PR
                      </span>
                    )}
                  </div>

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
                          : '—'
                    }
                    value={s.weightKg}
                    onChange={(e) =>
                      onUpdateSet(exercise.uid, s.id, { weightKg: e.target.value })
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
                      onUpdateSet(exercise.uid, s.id, { reps: e.target.value })
                    }
                    aria-label={`Repeticiones serie ${s.setNumber}`}
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-2 text-center text-sm font-bold text-white tabular-nums placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
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
                    className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-transform active:scale-90 ${
                      s.completed
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
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
              onClick={() => onAddSet(exercise.uid)}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/70 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900 active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5 text-rose-500" />
              Añadir serie
            </button>
            {exercise.sets.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onRemoveSet(exercise.uid, exercise.sets[exercise.sets.length - 1].id)
                }
                aria-label="Eliminar última serie"
                className="flex min-h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:text-red-400"
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

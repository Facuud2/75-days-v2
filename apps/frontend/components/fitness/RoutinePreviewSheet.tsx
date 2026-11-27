'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { Clock, Dumbbell, Edit3, Play, Trash2, X } from 'lucide-react';
import type { WorkoutRoutineRecord } from '@/lib/api/health';
import { formatMuscleLabel } from '@/lib/constants/fitness';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

interface RoutinePreviewSheetProps {
  routine: WorkoutRoutineRecord | null;
  isSavedRoutine: boolean;
  onClose: () => void;
  onStart: (routine: WorkoutRoutineRecord) => void;
  onEdit: (routine: WorkoutRoutineRecord) => void;
  onDelete?: (routineId: string) => void;
}

export function estimateRoutineDurationMin(routine: WorkoutRoutineRecord): number {
  const totalSets = routine.exercises.reduce(
    (sum, ex) => sum + Math.max(1, ex.targetSets || 3),
    0
  );
  // ~2.5 min per working set including rest + 5 min warmup
  return Math.max(15, Math.round((totalSets * 2.5 + 5) / 5) * 5);
}

export default function RoutinePreviewSheet({
  routine,
  isSavedRoutine,
  onClose,
  onStart,
  onEdit,
  onDelete,
}: RoutinePreviewSheetProps) {
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!routine) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [routine, onClose]);

  const enterTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING;
  const exitTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_EXIT_TRANSITION;

  const estMin = routine ? estimateRoutineDurationMin(routine) : 0;
  const totalSets = routine
    ? routine.exercises.reduce((sum, ex) => sum + Math.max(1, ex.targetSets || 3), 0)
    : 0;

  return (
    <AnimatePresence>
      {routine ? (
        <motion.div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-zinc-950 shadow-2xl sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="routine-preview-title"
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0, transition: enterTransition }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%', transition: exitTransition }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.4 }}
            dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
            onDragEnd={(_, info) => {
              if (shouldDismissSheet(info.offset.y, info.velocity.y)) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div
              className="mx-auto mt-3 mb-1 h-1.5 w-12 shrink-0 cursor-grab touch-none rounded-full bg-white/15 active:cursor-grabbing sm:hidden"
              aria-hidden="true"
              onPointerDown={(e) => dragControls.start(e)}
            />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">
                  <Dumbbell className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="routine-preview-title"
                    className="truncate text-lg font-bold tracking-tight text-white"
                  >
                    {routine.name}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400 tabular-nums">
                    <span>{routine.exercises.length} ejercicios</span>
                    <span aria-hidden="true">·</span>
                    <span>{totalSets} series</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />~{estMin} min
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar detalle de rutina"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {routine.description && (
              <p className="px-5 pb-3 text-xs leading-relaxed text-zinc-400">
                {routine.description}
              </p>
            )}

            {/* Exercise list */}
            <div className="flex-1 overflow-y-auto overscroll-contain border-y border-white/[0.06] px-5 py-3">
              <ul className="space-y-2">
                {routine.exercises.map((ex, idx) => (
                  <li
                    key={`${ex.exerciseId}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-900/70 px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-300 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {ex.exerciseName}
                        </p>
                        {ex.primaryMuscle && (
                          <p className="text-[11px] text-zinc-400">
                            {formatMuscleLabel(ex.primaryMuscle)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-zinc-300 tabular-nums">
                      {ex.targetSets || 3} series
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer actions in thumb zone */}
            <div className="space-y-2.5 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStart(routine);
                }}
                className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-rose-600 text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition-transform active:scale-[0.98] hover:bg-rose-500"
              >
                <Play className="h-4 w-4 fill-current" />
                Empezar rutina
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(routine);
                  }}
                  className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  {isSavedRoutine ? 'Editar rutina' : 'Personalizar'}
                </button>

                {isSavedRoutine && onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDelete(routine.id);
                    }}
                    aria-label={`Eliminar ${routine.name}`}
                    className="flex min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { ChevronRight, History, Play, X } from 'lucide-react';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

interface LogWorkoutMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNewWorkout: () => void;
  onQuickLog: () => void;
}

export default function LogWorkoutMenu({
  isOpen,
  onClose,
  onNewWorkout,
  onQuickLog,
}: LogWorkoutMenuProps) {
  const previousFocusedElement = useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    previousFocusedElement.current = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusedElement.current?.focus();
    };
  }, [isOpen, onClose]);

  const enterTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING;
  const exitTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_EXIT_TRANSITION;

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="quick-actions-overlay fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-[2px]"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="quick-actions-sheet w-full rounded-t-[24px] border border-white/10 bg-zinc-950/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-workout-menu-title"
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0, transition: enterTransition }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%', transition: exitTransition }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.42 }}
            dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
            onDragEnd={(_, info) => {
              if (shouldDismissSheet(info.offset.y, info.velocity.y)) onClose();
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="mx-auto mb-4 h-1.5 w-12 cursor-grab touch-none rounded-full bg-white/20 active:cursor-grabbing"
              aria-hidden="true"
              onPointerDown={(event) => dragControls.start(event)}
            />
            <div className="flex items-start justify-between gap-4 px-1">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-400">
                  Entrenamiento
                </p>
                <h2
                  id="log-workout-menu-title"
                  className="mt-0.5 text-xl font-bold tracking-tight text-white"
                >
                  ¿Qué vas a hacer?
                </h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú de entrenamiento"
                onClick={onClose}
                className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full text-white/60 transition-colors active:bg-white/10 active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="mt-5 grid gap-2.5">
              {/* Primary: Start or resume a live session */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewWorkout();
                }}
                className="quick-action-item flex min-h-[68px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-rose-500/35 bg-rose-500/12 px-4 text-left text-white transition-colors active:scale-[0.99] active:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <span className="flex items-center gap-3.5 min-w-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md shadow-rose-600/25">
                    <Play size={18} className="fill-current ml-0.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">Entrenar ahora en vivo</span>
                    <span className="mt-0.5 block text-xs text-white/60">
                      Cronómetro, series y descansos
                    </span>
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-rose-400" />
              </button>

              {/* Secondary: Log a finished workout */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onQuickLog();
                }}
                className="quick-action-item flex min-h-[68px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-left text-white transition-colors active:scale-[0.99] active:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <span className="flex items-center gap-3.5 min-w-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <History size={20} strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">Registrar actividad pasada</span>
                    <span className="mt-0.5 block text-xs text-white/60">
                      Deporte, duración y guardar en 2 toques
                    </span>
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-white/35" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 min-h-11 w-full cursor-pointer rounded-2xl px-4 text-center text-sm font-semibold text-white/55 transition-colors active:bg-white/10 active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              Cancelar
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

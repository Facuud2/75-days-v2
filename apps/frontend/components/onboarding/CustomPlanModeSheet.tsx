'use client';

import React, { useEffect } from 'react';
import { Pencil, Sparkles, X } from 'lucide-react';
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  SHEET_SNAP_SPRING,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

type CustomPlanModeSheetProps = {
  isOpen: boolean;
  onSelectAi: () => void;
  onSelectManual: () => void;
  onClose: () => void;
};

export default function CustomPlanModeSheet({
  isOpen,
  onSelectAi,
  onSelectManual,
  onClose,
}: CustomPlanModeSheetProps) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const sheetY = useMotionValue(0);
  const backdropOpacity = useTransform(sheetY, [0, 260], [1, 0]);

  useEffect(() => {
    if (!isOpen) return;
    sheetY.set(0);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, sheetY]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[72] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-mode-sheet-title"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            type="button"
            aria-label="Cerrar opciones de plan personalizado"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={isDesktop ? undefined : { opacity: backdropOpacity }}
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
          />

          <motion.div
            style={
              isDesktop
                ? {
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                  }
                : {
                    y: sheetY,
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                  }
            }
            initial={
              reduceMotion
                ? { opacity: 0 }
                : isDesktop
                ? { opacity: 0, scale: 0.96, y: 8 }
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
                ? { opacity: 0, scale: 0.97, y: 6, transition: SHEET_EXIT_TRANSITION }
                : { y: '100%', transition: SHEET_EXIT_TRANSITION }
            }
            transition={
              reduceMotion
                ? REDUCED_MOTION_TRANSITION
                : isDesktop
                ? { duration: 0.22, ease: [0.23, 1, 0.32, 1] }
                : SHEET_ENTER_SPRING
            }
            drag={!isDesktop && !reduceMotion ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (shouldDismissSheet(info.offset.y, info.velocity.y)) {
                onClose();
              } else {
                animate(sheetY, 0, {
                  ...SHEET_SNAP_SPRING,
                  velocity: info.velocity.y,
                });
              }
            }}
            className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl border overflow-hidden shadow-2xl"
          >
            {!isDesktop && (
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
              >
                <span
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border-control)' }}
                />
              </div>
            )}

            <div className="px-5 pt-3.5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="custom-mode-sheet-title"
                    className="text-base font-bold leading-snug"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    ¿Cómo querés armar tu plan?
                  </h2>
                  <p
                    className="text-xs mt-1 leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Chateá por texto o voz con la IA para diseñar cada meta y revisar la
                    transcripción, o configuralas manualmente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="size-9 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform duration-150 ease-out shrink-0"
                  style={{
                    touchAction: 'manipulation',
                    backgroundColor: 'var(--surface-inset)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onSelectAi}
                  className="w-full min-h-[48px] px-5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-transform duration-150 ease-out active:scale-[0.98] cursor-pointer"
                  style={{
                    touchAction: 'manipulation',
                    backgroundColor: 'var(--accent-fill)',
                    color: 'var(--on-accent)',
                  }}
                >
                  <Sparkles className="size-4" />
                  <span>Armar con IA</span>
                </button>

                <button
                  type="button"
                  onClick={onSelectManual}
                  className="w-full min-h-[46px] px-5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 border transition-transform duration-150 ease-out active:scale-[0.98] cursor-pointer"
                  style={{
                    touchAction: 'manipulation',
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Pencil className="size-4" />
                  <span>Editar manualmente</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

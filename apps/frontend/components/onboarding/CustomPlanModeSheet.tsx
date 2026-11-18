'use client';

import React, { useEffect } from 'react';
import { Pencil, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

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
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          <motion.div
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
                ? { opacity: 0, scale: 0.97, y: 6 }
                : { y: '100%' }
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
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (shouldDismissSheet(info.offset.y, info.velocity.y)) {
                onClose();
              }
            }}
            className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl border overflow-hidden shadow-2xl"
            style={{
              backgroundColor: 'var(--surface-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {!isDesktop && (
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
              >
                <span
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border-strong)' }}
                />
              </div>
            )}

            <div className="px-5 pt-4 pb-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[11px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    Custom Challenge
                  </p>
                  <h2
                    id="custom-mode-sheet-title"
                    className="text-lg font-bold leading-snug"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    ¿Cómo querés armar tu plan?
                  </h2>
                  <p
                    className="text-xs mt-1 leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Contale tu idea por voz a la IA para crear tus metas al instante, o configuralas una por una.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="p-2 rounded-xl transition-colors hover:bg-white/10 cursor-pointer shrink-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                {/* Botón principal con color de acento */}
                <button
                  type="button"
                  onClick={onSelectAi}
                  className="w-full min-h-[52px] px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98] cursor-pointer"
                  style={{
                    touchAction: 'manipulation',
                    backgroundColor: 'var(--accent-fill)',
                    color: 'var(--on-accent)',
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Armar con IA
                </button>

                {/* Botón secundario */}
                <button
                  type="button"
                  onClick={onSelectManual}
                  className="w-full min-h-[48px] px-5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 border transition-transform active:scale-[0.98] cursor-pointer"
                  style={{
                    touchAction: 'manipulation',
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Pencil className="w-4 h-4" />
                  Editar manualmente
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

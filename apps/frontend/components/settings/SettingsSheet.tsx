'use client';

import React, { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Responsive iOS Bottom Sheet on mobile (< sm) with swipe-to-dismiss handle,
 * and centered modal dialog on desktop (>= sm). Adapts to Light/Dark themes.
 */
export function SettingsSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: SettingsSheetProps) {
  const titleId = useId();
  const previousFocusedElement = useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();
  const isDesktop = useMediaQuery('(min-width: 640px)');
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
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-[3px] sm:items-center sm:p-4"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            initial={reduceMotion ? { opacity: 0 } : isDesktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
            animate={
              reduceMotion
                ? { opacity: 1 }
                : isDesktop
                  ? { opacity: 1, scale: 1, y: 0, transition: enterTransition }
                  : { y: 0, transition: enterTransition }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : isDesktop
                  ? { opacity: 0, scale: 0.96, y: 10, transition: exitTransition }
                  : { y: '100%', transition: exitTransition }
            }
            drag={isDesktop ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.42 }}
            dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
            onDragEnd={(_, info) => {
              if (shouldDismissSheet(info.offset.y, info.velocity.y)) onClose();
            }}
            className="w-full max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:max-w-lg sm:rounded-3xl sm:pb-6"
          >
            {/* Mobile swipe handle */}
            <div
              className="sticky top-0 z-10 bg-[var(--surface-card)]/95 backdrop-blur-md px-5 pt-3 pb-3 border-b border-[var(--divider)] touch-none sm:touch-auto"
              onPointerDown={(event) => {
                if (!isDesktop) dragControls.start(event);
              }}
            >
              <div
                className="mx-auto mb-3 h-1.5 w-10 cursor-grab touch-none rounded-full bg-[var(--border-control)]/50 active:cursor-grabbing sm:hidden"
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id={titleId} className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={`Cerrar ${title}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-5 pt-4">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

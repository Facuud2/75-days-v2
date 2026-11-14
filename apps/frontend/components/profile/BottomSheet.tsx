'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function BottomSheet({ open, onClose, title, description, children, footer }: BottomSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();
  const isSidePanel = useMediaQuery('(min-width: 768px)');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 30);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const sheet = sheetRef.current;
      if (!sheet) return;

      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const enterTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING;
  const exitTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_EXIT_TRANSITION;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="pv2-sheet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
          onClick={onClose}
        >
          <motion.div
            ref={sheetRef}
            className="pv2-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={isSidePanel ? { x: '100%' } : { y: '100%' }}
            animate={isSidePanel ? { x: 0, transition: enterTransition } : { y: 0, transition: enterTransition }}
            exit={isSidePanel ? { x: '100%', transition: exitTransition } : { y: '100%', transition: exitTransition }}
            drag={isSidePanel ? false : 'y'}
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
              className="pv2-sheet-handle"
              role="presentation"
              onPointerDown={(event) => dragControls.start(event)}
            />

            <div className="pv2-sheet-header">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {description}
                  </p>
                ) : null}
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="pv2-icon-button -mr-2 -mt-1"
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="pv2-sheet-body">{children}</div>

            {footer ? <div className="pv2-sheet-footer">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

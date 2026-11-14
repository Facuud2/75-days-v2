'use client';

import { useState } from 'react';
import toast, { resolveValue, useToaster } from 'react-hot-toast';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const MAX_VISIBLE = 3;

export default function StackedToaster() {
  const { toasts, handlers } = useToaster();
  const { startPause, endPause } = handlers;
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  const visibleToasts = toasts.filter((t) => t.visible).slice(0, MAX_VISIBLE);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-[120] flex justify-center px-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:justify-end sm:px-0"
      role="region"
      aria-label="Notificaciones"
      onMouseEnter={() => {
        setExpanded(true);
        startPause();
      }}
      onMouseLeave={() => {
        setExpanded(false);
        endPause();
      }}
    >
      <div className="relative flex w-full max-w-sm flex-col items-center sm:items-end">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleToasts.map((t, index) => {
            const isFront = index === 0;
            const depthScale = expanded ? 1 : Math.max(0.84, 1 - index * 0.08);
            const depthY = expanded ? -(index * 62) : -(index * 10);
            const depthOpacity = expanded ? 1 : Math.max(0.55, 1 - index * 0.2);

            return (
              <motion.div
                key={t.id}
                layout={!reduceMotion}
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 64, scale: 0.94 }
                }
                animate={{
                  opacity: depthOpacity,
                  y: depthY,
                  scale: depthScale,
                  zIndex: MAX_VISIBLE - index,
                }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 32, scale: 0.92 }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.14 }
                    : { type: 'spring', bounce: 0.12, duration: 0.38 }
                }
                style={{
                  position: isFront ? 'relative' : 'absolute',
                  bottom: 0,
                  transformOrigin: 'bottom center',
                }}
                className="pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl border border-zinc-800/90 bg-zinc-950/95 px-3.5 py-3 text-sm font-medium text-zinc-100 shadow-2xl backdrop-blur-md"
                {...t.ariaProps}
              >
                {t.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                ) : t.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                ) : null}

                <div className="min-w-0 flex-1 truncate">
                  {resolveValue(t.message, t)}
                </div>

                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  aria-label="Cerrar notificación"
                  className="shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

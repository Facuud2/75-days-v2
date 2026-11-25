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
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-[120] flex justify-center px-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:justify-end sm:px-0"
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
            const depthScale = expanded ? 1 : index === 0 ? 1 : index === 1 ? 0.92 : 0.84;
            const depthY = expanded ? -(index * 60) : index === 0 ? 0 : index === 1 ? -10 : -18;
            const depthOpacity = expanded ? 1 : index === 0 ? 1 : index === 1 ? 0.72 : 0.45;

            return (
              <motion.div
                key={t.id}
                layout={!reduceMotion}
                drag={isFront && !reduceMotion ? 'y' : false}
                dragConstraints={{ top: -8, bottom: 80 }}
                dragElastic={{ top: 0.08, bottom: 0.4 }}
                dragSnapToOrigin
                onDragEnd={(_, info) => {
                  if (info.offset.y > 24 || info.velocity.y > 220) {
                    toast.dismiss(t.id);
                  }
                }}
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 64, scale: 0.96 }
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
                    : { opacity: 0, y: 32, scale: 0.94 }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.14 }
                    : { type: 'spring', bounce: 0, duration: 0.28 }
                }
                style={{
                  position: isFront ? 'relative' : 'absolute',
                  bottom: 0,
                  transformOrigin: 'bottom center',
                }}
                className="pointer-events-auto flex w-full touch-pan-x select-none items-center gap-2.5 rounded-[18px] border border-black/[0.08] bg-zinc-950/85 px-3.5 py-2.5 text-[14px] font-medium leading-snug text-zinc-100 shadow-2xl backdrop-blur-xl backdrop-saturate-180 tabular-nums dark:border-white/[0.12] [@media(prefers-reduced-transparency:reduce)]:bg-zinc-950 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
                {...t.ariaProps}
              >
                {t.type === 'success' ? (
                  <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-400" strokeWidth={2} aria-hidden="true" />
                ) : t.type === 'error' ? (
                  <AlertCircle className="h-[18px] w-[18px] shrink-0 text-rose-400" strokeWidth={2} aria-hidden="true" />
                ) : null}

                <div className="min-w-0 flex-1 truncate">
                  {resolveValue(t.message, t)}
                </div>

                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  aria-label="Cerrar notificación"
                  className="relative flex h-7 w-7 shrink-0 touch-manipulation select-none items-center justify-center rounded-[10px] text-zinc-400 transition-[transform,background-color,color] duration-100 ease-out before:absolute before:-inset-2 before:content-[''] hover:bg-white/10 hover:text-zinc-100 active:scale-90 active:bg-white/15"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

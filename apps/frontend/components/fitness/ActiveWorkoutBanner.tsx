'use client';

import { useEffect, useState } from 'react';
import { ChevronUp, Dumbbell, Timer } from 'lucide-react';
import { useActiveWorkoutStore } from '@/store/useActiveWorkoutStore';
import { formatDurationClock } from '@/lib/constants/fitness';

/**
 * Floating minimized capsule shown above the mobile bottom navigation bar
 * whenever a user minimizes their live gym workout to browse another page.
 */
export default function ActiveWorkoutBanner() {
  const { isActive, isMinimized, startedAt, title, restEndsAt, setMinimized } =
    useActiveWorkoutStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive || !isMinimized) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isActive, isMinimized]);

  if (!isActive || !isMinimized) return null;

  const elapsedSec = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const restRemainingSec = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;

  return (
    <div className="fixed bottom-[84px] left-3 right-3 z-[80] lg:bottom-6 lg:left-auto lg:right-6 lg:w-80">
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-zinc-950/95 px-4 py-3 text-left shadow-2xl shadow-black/60 backdrop-blur-md transition-transform active:scale-[0.98] hover:border-emerald-400"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Dumbbell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">{title || 'Entrenamiento activo'}</p>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-emerald-400 tabular-nums">
              <span>{formatDurationClock(elapsedSec)}</span>
              {restRemainingSec > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">
                  <Timer className="h-3 w-3" />
                  {formatDurationClock(restRemainingSec)}
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronUp className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>
    </div>
  );
}

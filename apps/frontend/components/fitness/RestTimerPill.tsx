'use client';

import { FastForward, Timer } from 'lucide-react';
import { formatDurationClock } from '@/lib/constants/fitness';

interface RestTimerPillProps {
  remainingSec: number;
  totalSec: number;
  nextSetPreview?: {
    exerciseName: string;
    setNumber: number;
  } | null;
  onAdjust: (deltaSec: number) => void;
  onSkip: () => void;
}

export default function RestTimerPill({
  remainingSec,
  totalSec,
  nextSetPreview,
  onAdjust,
  onSkip,
}: RestTimerPillProps) {
  const progress =
    totalSec > 0 ? Math.min(1, Math.max(0, remainingSec / totalSec)) : 0;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="shrink-0 border-t border-zinc-800/90 bg-zinc-900/95 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Circular SVG countdown ring */}
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <svg className="h-11 w-11 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
              <circle
                cx="20"
                cy="20"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                className="text-zinc-800"
              />
              <circle
                cx="20"
                cy="20"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="text-rose-500 transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>
            <Timer className="absolute h-4 w-4 text-rose-400" />
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-white tabular-nums">
                {formatDurationClock(remainingSec)}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Descanso
              </span>
            </div>
            {nextSetPreview && (
              <p className="truncate text-[11px] text-zinc-400">
                Siguiente:{' '}
                <span className="font-semibold text-zinc-200">
                  {nextSetPreview.exerciseName}
                </span>{' '}
                · Serie {nextSetPreview.setNumber}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAdjust(-15)}
            className="min-h-10 cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800 px-2.5 text-xs font-bold text-white transition-transform active:scale-95 hover:bg-zinc-700"
          >
            -15s
          </button>
          <button
            type="button"
            onClick={() => onAdjust(15)}
            className="min-h-10 cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800 px-2.5 text-xs font-bold text-white transition-transform active:scale-95 hover:bg-zinc-700"
          >
            +15s
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white transition-transform active:scale-95 hover:bg-rose-500"
          >
            <span>Saltar</span>
            <FastForward className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { ChevronDown, Flame, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDurationClock } from '@/lib/constants/fitness';

export interface HudExerciseSegment {
  uid: string;
  completedSets: number;
  totalSets: number;
}

interface WorkoutHudHeaderProps {
  elapsedSec: number;
  elapsedMin: number;
  estimatedKcal: number;
  completedSets: number;
  totalSets: number;
  sessionMode: 'strength' | 'cardio';
  title: string;
  exerciseSegments?: HudExerciseSegment[];
  activeSegmentIndex?: number;
  onMinimize: () => void;
  onOpenFinish: () => void;
  isFinishing: boolean;
  wakeLockSupported: boolean;
  keepScreenAwake: boolean;
  onToggleWakeLock: (next: boolean) => void;
}

export default function WorkoutHudHeader({
  elapsedSec,
  elapsedMin,
  estimatedKcal,
  completedSets,
  totalSets,
  sessionMode,
  title,
  exerciseSegments = [],
  activeSegmentIndex = 0,
  onMinimize,
  onOpenFinish,
  isFinishing,
  wakeLockSupported,
  keepScreenAwake,
  onToggleWakeLock,
}: WorkoutHudHeaderProps) {
  const goalProgressPct = Math.min(100, Math.round((elapsedSec / (45 * 60)) * 100));
  const goalReached = elapsedMin >= 45;
  const hasSegments = exerciseSegments.length > 0;

  return (
    <header className="shrink-0 bg-zinc-950/85 backdrop-blur-xl backdrop-saturate-[180%] [@media(prefers-reduced-transparency:reduce)]:bg-zinc-950 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
      <div className="mx-auto max-w-2xl px-4 pb-3 pt-[calc(0.65rem+env(safe-area-inset-top,0px))]">
        {/* Single compact HUD row (all buttons >= 44pt) */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onMinimize}
            aria-label="Minimizar entrenamiento"
            className="flex h-11 w-11 shrink-0 cursor-pointer select-none touch-manipulation items-center justify-center rounded-full border border-white/[0.08] bg-zinc-900 text-zinc-300 [-webkit-touch-callout:none] transition-transform duration-100 ease-out active:scale-95 hover:bg-zinc-800"
          >
            <ChevronDown className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Center: Single Clock + Borderless Metrics Line */}
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[18px] font-bold tracking-[-0.02em] text-white tabular-nums [font-optical-sizing:auto]">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
                {formatDurationClock(elapsedSec)}
              </span>
              <span className="text-[12px] font-medium text-zinc-400 tabular-nums">
                {goalReached ? '45m ✓' : `${elapsedMin}/45m`}
              </span>
            </div>

            <div className="mt-0.5 flex max-w-full items-center justify-center gap-1.5 text-[12px] font-medium text-zinc-400 tabular-nums">
              <span className="max-w-[130px] truncate">{title || 'Sesión en vivo'}</span>
              {sessionMode === 'strength' && totalSets > 0 && (
                <>
                  <span className="text-zinc-600" aria-hidden="true">·</span>
                  <span className="shrink-0">
                    {completedSets}/{totalSets} series
                  </span>
                </>
              )}
              <span className="text-zinc-600" aria-hidden="true">·</span>
              <span className="inline-flex shrink-0 items-center gap-0.5">
                <Flame className="h-3 w-3 text-rose-500" aria-hidden="true" />
                {estimatedKcal} kcal
              </span>
            </div>
          </div>

          {/* Right: WakeLock icon + Finish pill */}
          <div className="flex shrink-0 items-center gap-1.5">
            {wakeLockSupported && (
              <button
                type="button"
                onClick={() => {
                  const next = !keepScreenAwake;
                  onToggleWakeLock(next);
                  toast(
                    next
                      ? 'Pantalla siempre encendida activada'
                      : 'Pantalla siempre encendida desactivada',
                    { duration: 1600 }
                  );
                }}
                aria-pressed={keepScreenAwake}
                aria-label={
                  keepScreenAwake
                    ? 'Desactivar pantalla encendida'
                    : 'Mantener pantalla encendida'
                }
                title={keepScreenAwake ? 'Pantalla ON' : 'Pantalla OFF'}
                className={`relative flex h-11 w-11 cursor-pointer select-none touch-manipulation items-center justify-center rounded-full border [-webkit-touch-callout:none] transition-colors duration-100 active:scale-95 ${
                  keepScreenAwake
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                    : 'border-white/[0.08] bg-zinc-900 text-zinc-500'
                }`}
              >
                <Smartphone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {keepScreenAwake && (
                  <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenFinish}
              disabled={isFinishing}
              className="min-h-11 cursor-pointer select-none touch-manipulation rounded-full bg-emerald-600 px-4 text-xs font-bold text-[#ffffff] [-webkit-touch-callout:none] shadow-md shadow-emerald-600/20 transition-transform duration-100 ease-out active:scale-95 hover:bg-emerald-500 disabled:opacity-50"
            >
              Terminar
            </button>
          </div>
        </div>

        {/* Stories-style segmented exercise bar (purely visual — no sub-44pt tap target) */}
        {hasSegments ? (
          <div
            className="mt-3 flex items-center gap-1.5"
            role="progressbar"
            aria-label="Progreso de ejercicios en la rutina"
            aria-valuenow={completedSets}
            aria-valuemin={0}
            aria-valuemax={Math.max(1, totalSets)}
          >
            {exerciseSegments.map((seg, idx) => {
              const isDone = seg.totalSets > 0 && seg.completedSets >= seg.totalSets;
              const isCurrent = idx === activeSegmentIndex;
              const pct =
                seg.totalSets > 0
                  ? Math.round((seg.completedSets / seg.totalSets) * 100)
                  : 0;

              return (
                <div
                  key={seg.uid}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800/90"
                >
                  <div
                    className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none ${
                      isDone
                        ? 'bg-emerald-500'
                        : isCurrent
                          ? 'bg-rose-500'
                          : 'bg-zinc-500/70'
                    }`}
                    style={{
                      width: isDone
                        ? '100%'
                        : isCurrent
                          ? `${Math.max(18, pct)}%`
                          : `${pct}%`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-900">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${
                goalReached ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${goalProgressPct}%` }}
            />
          </div>
        )}
      </div>
    </header>
  );
}

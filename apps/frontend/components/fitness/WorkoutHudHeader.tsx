'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  Flame,
  Pencil,
  Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { WorkoutEnvironment } from '@/store/useActiveWorkoutStore';
import { formatDurationClock } from '@/lib/constants/fitness';

interface WorkoutHudHeaderProps {
  elapsedSec: number;
  elapsedMin: number;
  estimatedKcal: number;
  completedSets: number;
  totalSets: number;
  volumeKg: number;
  sessionMode: 'strength' | 'cardio';
  environment: WorkoutEnvironment | null;
  title: string;
  onChangeTitle: (title: string) => void;
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
  volumeKg,
  sessionMode,
  title,
  onChangeTitle,
  onMinimize,
  onOpenFinish,
  isFinishing,
  wakeLockSupported,
  keepScreenAwake,
  onToggleWakeLock,
}: WorkoutHudHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const goalProgressPct = Math.min(100, Math.round((elapsedSec / (45 * 60)) * 100));
  const goalReached = elapsedMin >= 45;

  return (
    <header className="shrink-0 bg-zinc-950/95 backdrop-blur-md">
      <div className="mx-auto max-w-2xl px-4 pb-2.5 pt-[calc(0.65rem+env(safe-area-inset-top,0px))]">
        {/* Single compact HUD row */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onMinimize}
            aria-label="Minimizar entrenamiento"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-300 transition-transform active:scale-95 hover:bg-zinc-800"
          >
            <ChevronDown className="h-5 w-5" />
          </button>

          {/* Center: Timer + inline-editable title */}
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-white tabular-nums">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
                {formatDurationClock(elapsedSec)}
              </span>
              <span className="text-[11px] font-medium text-zinc-500 tabular-nums">
                {goalReached ? '45m ✓' : `${elapsedMin}/45m`}
              </span>
            </div>

            {isEditingTitle ? (
              <div className="mt-1 flex w-full max-w-[220px] items-center gap-1 rounded-lg border border-rose-500/60 bg-zinc-900 px-2 py-0.5">
                <input
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => onChangeTitle(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  maxLength={120}
                  aria-label="Título del entrenamiento"
                  className="min-w-0 flex-1 bg-transparent text-center text-xs font-semibold text-white placeholder:text-zinc-500 focus:outline-none"
                  placeholder="Nombre de la sesión..."
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsEditingTitle(false)}
                  aria-label="Guardar título"
                  className="text-emerald-400"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingTitle(true)}
                className="mt-0.5 flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
              >
                <span className="truncate">{title || 'Sesión en vivo'}</span>
                <Pencil className="h-2.5 w-2.5 shrink-0 opacity-60" />
              </button>
            )}
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
                className={`relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition-colors active:scale-95 ${
                  keepScreenAwake
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                    : 'border-white/10 bg-zinc-900 text-zinc-500'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                {keepScreenAwake && (
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenFinish}
              disabled={isFinishing}
              className="min-h-10 cursor-pointer rounded-full bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-transform active:scale-95 hover:bg-emerald-500 disabled:opacity-50"
            >
              Terminar
            </button>
          </div>
        </div>

        {/* Ultra-slim live stats strip */}
        <div className="mt-2 flex items-center justify-center gap-3 text-[11px] font-medium text-zinc-400 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3 w-3 text-rose-500" />
            {estimatedKcal} kcal
          </span>
          {sessionMode === 'strength' && totalSets > 0 && (
            <>
              <span className="text-zinc-700" aria-hidden="true">·</span>
              <span>
                {completedSets}/{totalSets} series
              </span>
            </>
          )}
          {volumeKg > 0 && (
            <>
              <span className="text-zinc-700" aria-hidden="true">·</span>
              <span className="text-emerald-400">
                {volumeKg.toLocaleString('es-ES')} kg
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2px progress hairline */}
      <div className="h-0.5 w-full bg-zinc-900">
        <div
          className={`h-full transition-[width] duration-700 ease-out ${
            goalReached ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          style={{ width: `${Math.max(2, goalProgressPct)}%` }}
        />
      </div>
    </header>
  );
}

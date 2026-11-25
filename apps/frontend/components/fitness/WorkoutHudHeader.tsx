'use client';

import {
  ChevronDown,
  Dumbbell,
  Flame,
  Home,
  Pencil,
  Smartphone,
  Trees,
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

const ENV_META: Record<
  WorkoutEnvironment,
  { label: string; icon: typeof Dumbbell; cls: string }
> = {
  gym: {
    label: 'Gimnasio',
    icon: Dumbbell,
    cls: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  },
  home: {
    label: 'En casa',
    icon: Home,
    cls: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  },
  outdoor: {
    label: 'Aire libre',
    icon: Trees,
    cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
};

export default function WorkoutHudHeader({
  elapsedSec,
  elapsedMin,
  estimatedKcal,
  completedSets,
  totalSets,
  volumeKg,
  sessionMode,
  environment,
  title,
  onChangeTitle,
  onMinimize,
  onOpenFinish,
  isFinishing,
  wakeLockSupported,
  keepScreenAwake,
  onToggleWakeLock,
}: WorkoutHudHeaderProps) {
  const goalProgressPct = Math.min(100, Math.round((elapsedSec / (45 * 60)) * 100));
  const goalReached = elapsedMin >= 45;
  const envInfo = environment ? ENV_META[environment] : null;
  const EnvIcon = envInfo?.icon;

  return (
    <div className="shrink-0 border-b border-zinc-900 bg-zinc-950/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-md">
      {/* Top action bar */}
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Minimizar entrenamiento"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition-transform active:scale-95 hover:bg-zinc-800"
        >
          <ChevronDown className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="flex items-center gap-1.5 text-xl font-bold tracking-tight text-white tabular-nums">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
            {formatDurationClock(elapsedSec)}
          </span>
          <span className="text-[11px] font-medium text-zinc-400 tabular-nums">
            {goalReached ? 'Meta 45 min cumplida' : `${elapsedMin}/45 min del reto`}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenFinish}
          disabled={isFinishing}
          className="min-h-11 cursor-pointer rounded-full bg-emerald-600 px-4 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-transform active:scale-95 hover:bg-emerald-500 disabled:opacity-50"
        >
          Terminar
        </button>
      </div>

      {/* 45-minute challenge progress bar */}
      <div className="mx-auto mt-2.5 max-w-2xl">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${
              goalReached
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-400'
            }`}
            style={{ width: `${Math.max(2, goalProgressPct)}%` }}
          />
        </div>
      </div>

      {/* Live Apple Fitness+ style metric pills */}
      <div className="mx-auto mt-2.5 flex max-w-2xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {envInfo && EnvIcon && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${envInfo.cls}`}
            >
              <EnvIcon className="h-3 w-3" />
              {envInfo.label}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 tabular-nums">
            <Flame className="h-3 w-3 text-rose-500" />
            {estimatedKcal} kcal
          </span>
          {sessionMode === 'strength' && totalSets > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 tabular-nums">
              {completedSets}/{totalSets} series
            </span>
          )}
          {volumeKg > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 tabular-nums">
              {volumeKg.toLocaleString('es-ES')} kg
            </span>
          )}
        </div>

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
                { duration: 1800 }
              );
            }}
            aria-pressed={keepScreenAwake}
            className={`inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[11px] font-bold transition-colors active:scale-95 ${
              keepScreenAwake
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400'
            }`}
          >
            <Smartphone className="h-3 w-3" />
            <span>{keepScreenAwake ? 'Pantalla ON' : 'Pantalla OFF'}</span>
          </button>
        )}
      </div>

      {/* Editable session title */}
      <div className="mx-auto mt-2.5 max-w-2xl">
        <label className="flex min-w-0 items-center gap-1.5 rounded-xl border border-zinc-800/70 bg-zinc-900/50 px-3 py-1.5 focus-within:border-rose-500">
          <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <input
            type="text"
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            maxLength={120}
            aria-label="Título del entrenamiento"
            className="min-h-6 min-w-0 flex-1 bg-transparent text-sm font-bold text-white placeholder:text-zinc-500 focus:outline-none"
            placeholder="Nombre de tu sesión..."
          />
        </label>
      </div>
    </div>
  );
}

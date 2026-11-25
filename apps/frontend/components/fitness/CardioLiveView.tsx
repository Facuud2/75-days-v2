'use client';

import {
  Activity,
  Bike,
  Flame,
  Footprints,
  Plus,
  Sparkles,
  Waves,
} from 'lucide-react';
import { formatDurationClock } from '@/lib/constants/fitness';

interface CardioLiveViewProps {
  sport: string;
  title: string;
  elapsedSec: number;
  estimatedKcal: number;
  intensity: 'low' | 'medium' | 'high';
  distanceKm: string;
  notes: string;
  onChangeIntensity: (intensity: 'low' | 'medium' | 'high') => void;
  onChangeDistanceKm: (distanceKm: string) => void;
  onChangeNotes: (notes: string) => void;
  onOpenExercisePicker: () => void;
}

const SPORT_ICON: Record<string, typeof Activity> = {
  walking: Activity,
  running: Footprints,
  cycling: Bike,
  swimming: Waves,
  yoga: Sparkles,
  other: Flame,
};

const INTENSITY_OPTIONS = [
  { key: 'low' as const, label: 'Suave', desc: 'Ritmo cómodo' },
  { key: 'medium' as const, label: 'Media', desc: 'Esfuerzo moderado' },
  { key: 'high' as const, label: 'Alta', desc: 'Máxima energía' },
];

export default function CardioLiveView({
  sport,
  title,
  elapsedSec,
  estimatedKcal,
  intensity,
  distanceKm,
  notes,
  onChangeIntensity,
  onChangeDistanceKm,
  onChangeNotes,
  onOpenExercisePicker,
}: CardioLiveViewProps) {
  const SportIcon = SPORT_ICON[sport] || Activity;
  const goalSec = 45 * 60;
  const progress = Math.min(1, Math.max(0, elapsedSec / goalSec));
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const goalReached = elapsedSec >= goalSec;
  const showDistance = sport !== 'yoga';

  return (
    <section className="space-y-4">
      {/* Apple Fitness+ Hero Activity Ring Card */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-6 text-center shadow-xl">
        <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
          <svg className="h-36 w-36 -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-zinc-800/80"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${
                goalReached ? 'text-emerald-500' : 'text-rose-500'
              }`}
            />
          </svg>

          {/* Animated inner activity pulse */}
          <div className="absolute flex flex-col items-center">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
              <span className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping motion-reduce:animate-none" />
              <SportIcon className="relative h-6 w-6" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-zinc-300 tabular-nums">
              {Math.round(progress * 100)}% meta
            </span>
          </div>
        </div>

        <h3 className="mt-3 text-lg font-bold text-white">{title || 'Actividad en curso'}</h3>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-white tabular-nums">
          {formatDurationClock(elapsedSec)}
        </p>

        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300 tabular-nums">
            <Flame className="h-3.5 w-3.5 text-rose-400" />
            {estimatedKcal} kcal estimadas
          </span>
        </div>
      </div>

      {/* Controls Card */}
      <div className="space-y-4 rounded-3xl border border-zinc-800/90 bg-zinc-900/60 p-4">
        <div>
          <span className="mb-2 block text-xs font-semibold text-zinc-400">
            Intensidad del esfuerzo
          </span>
          <div className="grid grid-cols-3 gap-2">
            {INTENSITY_OPTIONS.map((opt) => {
              const active = intensity === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onChangeIntensity(opt.key)}
                  aria-pressed={active}
                  className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center transition-all active:scale-95 ${
                    active
                      ? 'border-rose-500 bg-rose-600/20 text-white shadow-sm shadow-rose-600/20'
                      : 'border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="text-[10px] text-zinc-400">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {showDistance && (
          <div>
            <label
              htmlFor="cardio-distance-input"
              className="mb-1.5 block text-xs font-semibold text-zinc-400"
            >
              Distancia recorrida (km, opcional)
            </label>
            <input
              id="cardio-distance-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={distanceKm}
              onChange={(e) => onChangeDistanceKm(e.target.value)}
              placeholder="Ej: 4.5"
              className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm font-semibold text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="cardio-notes-input"
            className="mb-1.5 block text-xs font-semibold text-zinc-400"
          >
            Notas de la sesión (opcional)
          </label>
          <textarea
            id="cardio-notes-input"
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            placeholder="Ej: Caminata por el parque a buen ritmo..."
            className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenExercisePicker}
        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
      >
        <Plus className="h-4 w-4 text-rose-500" />
        ¿También harás ejercicios de fuerza? Añadir del catálogo
      </button>
    </section>
  );
}

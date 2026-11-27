'use client';

import { useEffect, useId, useState } from 'react';
import { Check } from 'lucide-react';
import type {
  SummaryRingId,
  WorkoutSummaryRingsModel,
} from '@/lib/utils/workoutSummaryMetrics';

interface LiveWorkoutActivityRingsProps {
  completedSets: number;
  totalSets: number;
  completedReps: number;
  elapsedSec: number;
  goalMinutes?: number;
  estimatedKcal: number;
  currentExerciseName: string;
  currentExerciseCompletedSets: number;
  currentExerciseTotalSets: number;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, value);
}

/**
 * Apple Fitness-style concentric 3-ring live telemetry card.
 * Each ring tracks an independent, congruent workout signal:
 *  - Outer (Move / Rose):   Overall routine sets completed (completedSets / totalSets)
 *  - Middle (Exercise / Green): Active session time vs 45m daily goal (elapsedSec / 45m)
 *  - Inner (Focus / Cyan):  Current exercise sets completed (currentExerciseCompletedSets / currentExerciseTotalSets)
 */
export function LiveWorkoutActivityRings({
  completedSets,
  totalSets,
  completedReps,
  elapsedSec,
  goalMinutes = 45,
  estimatedKcal,
  currentExerciseName,
  currentExerciseCompletedSets,
  currentExerciseTotalSets,
}: LiveWorkoutActivityRingsProps) {
  const uid = useId();
  const moveGradId = `${uid}-move`;
  const exerciseGradId = `${uid}-exercise`;
  const focusGradId = `${uid}-focus`;

  const size = 116;
  const center = size / 2;
  const strokeWidth = 10;

  const setsRatio = totalSets > 0 ? clampProgress(completedSets / totalSets) : 0;
  const timeRatio = goalMinutes > 0 ? clampProgress(elapsedSec / (goalMinutes * 60)) : 0;
  const currentExRatio =
    currentExerciseTotalSets > 0
      ? clampProgress(currentExerciseCompletedSets / currentExerciseTotalSets)
      : 0;

  const rOuter = 49;
  const cOuter = 2 * Math.PI * rOuter;
  const offsetOuter = cOuter * (1 - Math.max(0.018, setsRatio));

  const rMiddle = 36.5;
  const cMiddle = 2 * Math.PI * rMiddle;
  const offsetMiddle = cMiddle * (1 - Math.max(0.018, timeRatio));

  const rInner = 24;
  const cInner = 2 * Math.PI * rInner;
  const offsetInner = cInner * (1 - Math.max(0.018, currentExRatio));

  const elapsedMin = Math.floor(elapsedSec / 60);
  const setsPct = Math.round(setsRatio * 100);
  const setsClosed = totalSets > 0 && completedSets >= totalSets;
  const timeClosed = elapsedMin >= goalMinutes;
  const currentExClosed =
    currentExerciseTotalSets > 0 && currentExerciseCompletedSets >= currentExerciseTotalSets;

  return (
    <section
      aria-label="Anillos de actividad del entrenamiento"
      className="mt-3 rounded-[24px] border border-white/[0.08] bg-zinc-900/75 p-4"
    >
      <div className="flex items-center gap-4">
        {/* Concentric Apple Fitness 3-Ring Gauge */}
        <div className="relative flex h-[116px] w-[116px] shrink-0 items-center justify-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90"
            role="img"
            aria-label={`Series ${completedSets} de ${totalSets}, tiempo ${elapsedMin} de ${goalMinutes} minutos, ejercicio actual ${currentExerciseCompletedSets} de ${currentExerciseTotalSets} series`}
          >
            <defs>
              <linearGradient id={moveGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FA114F" />
                <stop offset="100%" stopColor="#FF4572" />
              </linearGradient>
              <linearGradient id={exerciseGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#92E82A" />
              </linearGradient>
              <linearGradient id={focusGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#00E5FF" />
              </linearGradient>
            </defs>

            {/* Outer Ring: Routine Sets */}
            <circle
              cx={center}
              cy={center}
              r={rOuter}
              fill="none"
              stroke="#FA114F"
              strokeOpacity={0.16}
              strokeWidth={strokeWidth}
            />
            <circle
              cx={center}
              cy={center}
              r={rOuter}
              fill="none"
              stroke={`url(#${moveGradId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={cOuter}
              strokeDashoffset={offsetOuter}
              className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
            />

            {/* Middle Ring: 45m Time Goal */}
            <circle
              cx={center}
              cy={center}
              r={rMiddle}
              fill="none"
              stroke="#22C55E"
              strokeOpacity={0.16}
              strokeWidth={strokeWidth}
            />
            <circle
              cx={center}
              cy={center}
              r={rMiddle}
              fill="none"
              stroke={`url(#${exerciseGradId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={cMiddle}
              strokeDashoffset={offsetMiddle}
              className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
            />

            {/* Inner Ring: Current Exercise Progress */}
            <circle
              cx={center}
              cy={center}
              r={rInner}
              fill="none"
              stroke="#0EA5E9"
              strokeOpacity={0.16}
              strokeWidth={strokeWidth}
            />
            <circle
              cx={center}
              cy={center}
              r={rInner}
              fill="none"
              stroke={`url(#${focusGradId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={cInner}
              strokeDashoffset={offsetInner}
              className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
            />
          </svg>
        </div>

        {/* Right: iOS Fitness Congruent Metric Breakdown */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Outer Ring Legend: Routine Sets */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#FA114F]" aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#E11D48] dark:text-[#FF375F]">
                  Series
                </span>
              </div>
              <p className="mt-0.5 text-[15px] font-bold leading-tight text-white tabular-nums">
                {completedSets}
                <span className="text-[12px] font-semibold text-zinc-400">/{totalSets}</span>
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-zinc-400 tabular-nums">
              {setsClosed ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#E11D48] dark:text-[#FF375F]" strokeWidth={2.75} aria-hidden="true" />
                  100%
                </>
              ) : completedReps > 0 ? (
                `${completedReps} reps`
              ) : (
                `${setsPct}%`
              )}
            </span>
          </div>

          {/* Middle Ring Legend: Time / 45m Goal */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-600 dark:text-[#92E82A]">
                  Tiempo
                </span>
              </div>
              <p className="mt-0.5 text-[15px] font-bold leading-tight text-white tabular-nums">
                {elapsedMin}
                <span className="text-[12px] font-semibold text-zinc-400">/{goalMinutes} min</span>
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-zinc-400 tabular-nums">
              {timeClosed && (
                <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-[#92E82A]" strokeWidth={2.75} aria-hidden="true" />
              )}
              {estimatedKcal} kcal
            </span>
          </div>

          {/* Inner Ring Legend: Current Exercise */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-sky-600 dark:text-[#00E5FF]">
                  Ejercicio
                </span>
              </div>
              <p className="mt-0.5 text-[15px] font-bold leading-tight text-white tabular-nums">
                {currentExerciseCompletedSets}
                <span className="text-[12px] font-semibold text-zinc-400">/{currentExerciseTotalSets}</span>
              </p>
            </div>
            <span className="max-w-[120px] truncate text-[11px] font-semibold text-zinc-400">
              {currentExClosed ? 'Listo ✓' : currentExerciseName}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface WorkoutSummaryRingsProps {
  sessionProgress: number; // 0..1
  timeProgress: number; // 0..1
  exercisesProgress?: number; // 0..1
  durationLabel: string;
}

/**
 * Concentric Apple-style activity rings for the post-workout summary modal.
 */
export function WorkoutSummaryRings({
  sessionProgress,
  timeProgress,
  exercisesProgress,
  durationLabel,
}: WorkoutSummaryRingsProps) {
  const uid = useId();
  const moveGradId = `${uid}-sum-move`;
  const exerciseGradId = `${uid}-sum-exercise`;
  const focusGradId = `${uid}-sum-focus`;

  const size = 108;
  const center = size / 2;
  const strokeWidth = 8.5;

  const r1 = 45;
  const c1 = 2 * Math.PI * r1;
  const offset1 = c1 * (1 - Math.max(0.04, clampProgress(sessionProgress)));

  const r2 = 34;
  const c2 = 2 * Math.PI * r2;
  const offset2 = c2 * (1 - Math.max(0.04, clampProgress(timeProgress)));

  const hasThirdRing = typeof exercisesProgress === 'number';
  const r3 = 23;
  const c3 = 2 * Math.PI * r3;
  const offset3 = c3 * (1 - Math.max(0.04, clampProgress(exercisesProgress ?? 0)));

  return (
    <div className="relative flex h-[108px] w-[108px] shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-label="Resumen de anillos de entrenamiento"
      >
        <defs>
          <linearGradient id={moveGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FA114F" />
            <stop offset="100%" stopColor="#FF4572" />
          </linearGradient>
          <linearGradient id={exerciseGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#92E82A" />
          </linearGradient>
          <linearGradient id={focusGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#00E5FF" />
          </linearGradient>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={r1}
          fill="none"
          stroke="#FA114F"
          strokeOpacity={0.16}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={r1}
          fill="none"
          stroke={`url(#${moveGradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c1}
          strokeDashoffset={offset1}
          className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        />

        <circle
          cx={center}
          cy={center}
          r={r2}
          fill="none"
          stroke="#22C55E"
          strokeOpacity={0.16}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={r2}
          fill="none"
          stroke={`url(#${exerciseGradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c2}
          strokeDashoffset={offset2}
          className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        />

        {hasThirdRing && (
          <>
            <circle
              cx={center}
              cy={center}
              r={r3}
              fill="none"
              stroke="#0EA5E9"
              strokeOpacity={0.16}
              strokeWidth={strokeWidth}
            />
            <circle
              cx={center}
              cy={center}
              r={r3}
              fill="none"
              stroke={`url(#${focusGradId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={c3}
              strokeDashoffset={offset3}
              className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
            />
          </>
        )}
      </svg>

      {!hasThirdRing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
            Total
          </span>
          <span className="text-sm font-bold leading-tight tracking-tight text-white tabular-nums">
            {durationLabel}
          </span>
        </div>
      )}
    </div>
  );
}

interface WorkoutSummaryRingsCardProps {
  model: WorkoutSummaryRingsModel;
}

const SUMMARY_RING_STYLES: Record<
  SummaryRingId,
  {
    radius: number;
    trackStroke: string;
    gradStart: string;
    gradEnd: string;
    tipFill: string;
    labelClass: string;
    dotClass: string;
    badgeBgClass: string;
    activeRowClass: string;
    centerValueClass: string;
    delayMs: number;
  }
> = {
  energy: {
    radius: 63,
    trackStroke: '#FA114F',
    gradStart: '#FA114F',
    gradEnd: '#FF4572',
    tipFill: '#FF5A84',
    labelClass: 'text-[#E11D48] dark:text-[#FF375F]',
    dotClass: 'bg-[#FA114F]',
    badgeBgClass: 'bg-[#FA114F]/15 text-[#E11D48] dark:text-[#FF375F]',
    activeRowClass: 'bg-[#FA114F]/10 ring-1 ring-[#FA114F]/25',
    centerValueClass: 'text-[#E11D48] dark:text-[#FF375F]',
    delayMs: 0,
  },
  time: {
    radius: 49,
    trackStroke: '#22C55E',
    gradStart: '#22C55E',
    gradEnd: '#92E82A',
    tipFill: '#A4F53A',
    labelClass: 'text-emerald-600 dark:text-[#92E82A]',
    dotClass: 'bg-emerald-500',
    badgeBgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-[#92E82A]',
    activeRowClass: 'bg-emerald-500/10 ring-1 ring-emerald-500/25',
    centerValueClass: 'text-emerald-600 dark:text-[#92E82A]',
    delayMs: 90,
  },
  focus: {
    radius: 35,
    trackStroke: '#0EA5E9',
    gradStart: '#0EA5E9',
    gradEnd: '#00E5FF',
    tipFill: '#45EEFF',
    labelClass: 'text-sky-600 dark:text-[#00E5FF]',
    dotClass: 'bg-sky-500',
    badgeBgClass: 'bg-sky-500/15 text-sky-600 dark:text-[#00E5FF]',
    activeRowClass: 'bg-sky-500/10 ring-1 ring-sky-500/25',
    centerValueClass: 'text-sky-600 dark:text-[#00E5FF]',
    delayMs: 180,
  },
};

function triggerLightHaptic() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  } catch {
    // Haptic feedback is best-effort
  }
}

/**
 * Interactive Apple Fitness-inspired post-workout summary card.
 * Unifies concentric 3-ring visualization (with >100% lap glow + dynamic center readout)
 * with color-coded metric rows on the right.
 */
export function WorkoutSummaryRingsCard({ model }: WorkoutSummaryRingsCardProps) {
  const uid = useId();
  const [mounted, setMounted] = useState(false);
  const [selectedRing, setSelectedRing] = useState<SummaryRingId | null>(null);
  const [hoveredRing, setHoveredRing] = useState<SummaryRingId | null>(null);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const activeRingId = hoveredRing ?? selectedRing;
  const activeMetric = activeRingId
    ? model.rings.find((r) => r.id === activeRingId) ?? null
    : null;
  const activeStyle = activeRingId ? SUMMARY_RING_STYLES[activeRingId] : null;

  const size = 148;
  const center = size / 2;
  const strokeWidth = 11;
  const tipShadowId = `${uid}-tip-shadow`;

  const handleToggleRing = (id: SummaryRingId) => {
    triggerLightHaptic();
    setSelectedRing((prev) => (prev === id ? null : id));
  };

  return (
    <section
      aria-label="Resumen interactivo de anillos de entrenamiento"
      className="mt-4 rounded-[18px] border border-white/[0.08] bg-zinc-900/75 p-3.5 sm:p-4"
    >
      <div className="flex items-center gap-3.5 sm:gap-4">
        {/* Left: Interactive 3-Ring SVG with dynamic center readout */}
        <div className="relative flex h-[142px] w-[142px] shrink-0 items-center justify-center sm:h-[148px] sm:w-[148px]">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="h-full w-full -rotate-90 overflow-visible"
            role="img"
            aria-label={model.rings.map((r) => r.ariaLabel).join('. ')}
          >
            <defs>
              {model.rings.map((ring) => {
                const style = SUMMARY_RING_STYLES[ring.id];
                return (
                  <linearGradient
                    key={ring.id}
                    id={`${uid}-grad-${ring.id}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor={style.gradStart} />
                    <stop offset="100%" stopColor={style.gradEnd} />
                  </linearGradient>
                );
              })}
              <filter id={tipShadowId} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="2.2"
                  floodColor="#000000"
                  floodOpacity="0.45"
                />
              </filter>
            </defs>

            {model.rings.map((ring) => {
              const style = SUMMARY_RING_STYLES[ring.id];
              const circumference = 2 * Math.PI * style.radius;
              const baseFill = Math.max(0.03, Math.min(1, ring.ratio));
              const animatedBaseFill = mounted ? baseFill : 0.001;
              const baseOffset = circumference * (1 - animatedBaseFill);

              const hasOverfill = ring.ratio > 1.02;
              const overfillFraction = hasOverfill
                ? Math.min(0.96, (ring.ratio - 1) % 1 || 0.96)
                : 0;
              const animatedOverfill = mounted ? overfillFraction : 0;
              const overfillOffset = circumference * (1 - animatedOverfill);
              const tipAngle = overfillFraction * 2 * Math.PI;
              const tipX = center + style.radius * Math.cos(tipAngle);
              const tipY = center + style.radius * Math.sin(tipAngle);

              const isDimmed = activeRingId !== null && activeRingId !== ring.id;
              const isHighlighted = activeRingId === ring.id;

              return (
                <g
                  key={ring.id}
                  onClick={() => handleToggleRing(ring.id)}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setHoveredRing(ring.id);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') setHoveredRing(null);
                  }}
                  className={`cursor-pointer transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                    isDimmed ? 'opacity-25' : 'opacity-100'
                  }`}
                >
                  {/* Track */}
                  <circle
                    cx={center}
                    cy={center}
                    r={style.radius}
                    fill="none"
                    stroke={style.trackStroke}
                    strokeOpacity={isHighlighted ? 0.24 : 0.16}
                    strokeWidth={strokeWidth}
                  />

                  {/* Primary progress arc */}
                  <circle
                    cx={center}
                    cy={center}
                    r={style.radius}
                    fill="none"
                    stroke={`url(#${uid}-grad-${ring.id})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={baseOffset}
                    style={{
                      transitionProperty: 'stroke-dashoffset',
                      transitionDuration: '820ms',
                      transitionDelay: `${style.delayMs}ms`,
                      transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                    className="motion-reduce:transition-none"
                  />

                  {/* Over-100% second lap + glowing tip cap */}
                  {hasOverfill && (
                    <>
                      <circle
                        cx={center}
                        cy={center}
                        r={style.radius}
                        fill="none"
                        stroke={`url(#${uid}-grad-${ring.id})`}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={overfillOffset}
                        style={{
                          transitionProperty: 'stroke-dashoffset',
                          transitionDuration: '900ms',
                          transitionDelay: `${style.delayMs + 140}ms`,
                          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                        className="motion-reduce:transition-none"
                      />
                      <circle
                        cx={tipX}
                        cy={tipY}
                        r={strokeWidth / 2}
                        fill={style.tipFill}
                        filter={`url(#${tipShadowId})`}
                        className={`transition-opacity duration-300 motion-reduce:transition-none ${
                          mounted ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Dynamic Center Readout inside the inner ring */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center select-none">
            {activeMetric && activeStyle ? (
              <div
                key={activeMetric.id}
                className="flex flex-col items-center transition-opacity duration-150 ease-out"
              >
                <span
                  className={`text-[15px] font-extrabold leading-none tracking-[-0.03em] tabular-nums [font-optical-sizing:auto] ${activeStyle.centerValueClass}`}
                >
                  {activeMetric.percent}%
                </span>
                <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-zinc-400">
                  {activeMetric.shortLabel}
                </span>
              </div>
            ) : model.closedCount === 3 ? (
              <div className="flex flex-col items-center">
                <Check
                  className="h-4 w-4 text-emerald-500 dark:text-[#92E82A]"
                  strokeWidth={3}
                  aria-hidden="true"
                />
                <span className="mt-0.5 text-[11px] font-extrabold leading-none tracking-[-0.02em] text-white tabular-nums">
                  3/3
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-[15px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums [font-optical-sizing:auto]">
                  {model.overallPercent}%
                </span>
                <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-zinc-400">
                  {model.closedCount}/3
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: 3 Color-Coded Interactive Metric Rows (Apple Fitness Widget style) */}
        <div className="min-w-0 flex-1 space-y-1">
          {model.rings.map((ring) => {
            const style = SUMMARY_RING_STYLES[ring.id];
            const isSelected = selectedRing === ring.id;
            const isActive = activeRingId === ring.id;
            const isDimmed = activeRingId !== null && !isActive;

            return (
              <button
                key={ring.id}
                type="button"
                aria-pressed={isSelected}
                aria-label={ring.ariaLabel}
                onClick={() => handleToggleRing(ring.id)}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') setHoveredRing(ring.id);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'mouse') setHoveredRing(null);
                }}
                className={`flex min-h-[46px] w-full cursor-pointer select-none touch-manipulation flex-col justify-center rounded-[12px] px-2.5 py-1.5 text-left [-webkit-touch-callout:none] transition-all duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  isActive
                    ? style.activeRowClass
                    : 'hover:bg-white/[0.04]'
                } ${isDimmed ? 'opacity-50' : 'opacity-100'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-[0.06em] ${style.labelClass}`}
                  >
                    {ring.label}
                  </span>

                  {ring.isClosed ? (
                    <span
                      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums ${style.badgeBgClass}`}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                      {ring.percent > 110 ? `+${ring.percent - 100}%` : `${ring.percent}%`}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-semibold text-zinc-400 tabular-nums">
                      {ring.percent}%
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex items-baseline gap-1.5 overflow-hidden">
                  <span className="text-[20px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums whitespace-nowrap [font-optical-sizing:auto] sm:text-[22px]">
                    {ring.valueDisplay}
                  </span>
                  <span className="truncate text-[11px] font-semibold leading-none text-zinc-400 tabular-nums sm:text-[12px]">
                    {ring.goalDisplay}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-Data Contextual Telemetry Strip */}
      <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-2.5 text-[12px] font-medium text-zinc-400 tabular-nums">
        <span
          className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-150 ${
            activeStyle ? activeStyle.dotClass : 'bg-zinc-500/70'
          }`}
          aria-hidden="true"
        />
        <span className="truncate">
          {activeMetric ? activeMetric.detailText : model.defaultDetailText}
        </span>
      </div>
    </section>
  );
}

interface RestCountdownRingProps {
  remainingSec: number;
  totalSec: number;
}

/**
 * Single circular protagonist during live execution.
 * Strictly uses the primary coral/rose accent with zero competing colors.
 */
export function RestCountdownRing({
  remainingSec,
  totalSec,
}: RestCountdownRingProps) {
  const size = 136;
  const center = size / 2;
  const r = 54;
  const c = 2 * Math.PI * r;
  const ratio = totalSec > 0 ? Math.max(0, Math.min(1, remainingSec / totalSec)) : 0;
  const offset = c * (1 - ratio);

  return (
    <div className="relative flex h-[136px] w-[136px] items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-label={`Descanso restante: ${remainingSec} segundos`}
      >
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={9.5}
          className="text-rose-500/15"
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={9.5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-rose-500 transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-zinc-400">
          Descanso
        </span>
        <span className="mt-0.5 text-[30px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums [font-optical-sizing:auto]">
          {remainingSec}
          <span className="text-[15px] font-bold text-zinc-400">s</span>
        </span>
      </div>
    </div>
  );
}

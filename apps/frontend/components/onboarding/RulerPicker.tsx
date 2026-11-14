'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type RulerPickerProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  label: string;
  majorEvery?: number;
  midEvery?: number;
  tickSpacing?: number;
  formatValue?: (val: number) => string;
  formatTickLabel?: (val: number) => string;
  disabled?: boolean;
};

function roundToStep(val: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, val));
  const steps = Math.round((clamped - min) / step);
  const precision = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
  return Number((min + steps * step).toFixed(precision));
}

export default function RulerPicker({
  value,
  onChange,
  min,
  max,
  step,
  unit,
  label,
  majorEvery = 10,
  midEvery = 5,
  tickSpacing = 11,
  formatValue,
  formatTickLabel,
  disabled = false,
}: RulerPickerProps) {
  const [visualValue, setVisualValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const visualRef = useRef(value);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startValue: number;
    history: Array<{ x: number; t: number }>;
  } | null>(null);

  // Sync external value changes when not actively dragging or coasting.
  useEffect(() => {
    if (!isDragging && rafRef.current === null) {
      visualRef.current = value;
      setVisualValue(value);
    }
  }, [value, isDragging]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const commitSnapped = useCallback(
    (rawVal: number) => {
      const snapped = roundToStep(rawVal, min, max, step);
      visualRef.current = snapped;
      setVisualValue(snapped);
      onChange(snapped);
      return snapped;
    },
    [min, max, step, onChange]
  );

  const startMomentum = useCallback(
    (initialVelocityPxPerMs: number) => {
      stopAnimation();
      let velocityStepsPerMs = -(initialVelocityPxPerMs / tickSpacing) * step;
      let lastTime = performance.now();

      const tick = (now: number) => {
        const dt = Math.min(32, Math.max(1, now - lastTime));
        lastTime = now;

        const nextRaw = visualRef.current + velocityStepsPerMs * dt;
        const clamped = Math.min(max, Math.max(min, nextRaw));
        visualRef.current = clamped;
        setVisualValue(clamped);

        const snapped = roundToStep(clamped, min, max, step);
        if (snapped !== value) {
          onChange(snapped);
        }

        // Exponential decay tuned for crisp iOS-like ruler deceleration
        const decay = Math.pow(0.92, dt / 16.67);
        velocityStepsPerMs *= decay;

        const hitBoundary = clamped <= min || clamped >= max;
        if (hitBoundary || Math.abs((velocityStepsPerMs * tickSpacing) / step) < 0.018) {
          rafRef.current = null;
          commitSnapped(clamped);
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [stopAnimation, tickSpacing, step, min, max, value, onChange, commitSnapped]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    stopAnimation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startValue: visualRef.current,
      history: [{ x: e.clientX, t: performance.now() }],
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const now = performance.now();
    const deltaX = e.clientX - drag.startX;
    const rawVal = drag.startValue - (deltaX / tickSpacing) * step;
    const clamped = Math.min(max, Math.max(min, rawVal));

    visualRef.current = clamped;
    setVisualValue(clamped);

    const snapped = roundToStep(clamped, min, max, step);
    if (snapped !== value) {
      onChange(snapped);
    }

    drag.history.push({ x: e.clientX, t: now });
    if (drag.history.length > 6) {
      drag.history.shift();
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);

    const now = performance.now();
    const recent = drag.history.filter((p) => now - p.t <= 90);
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dt = Math.max(1, last.t - first.t);
      const velocityPxPerMs = (last.x - first.x) / dt;
      if (Math.abs(velocityPxPerMs) > 0.12) {
        startMomentum(velocityPxPerMs);
        return;
      }
    }

    commitSnapped(visualRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const multiplier = e.shiftKey ? majorEvery : 1;
    let next: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      next = value - step * multiplier;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      next = value + step * multiplier;
    } else if (e.key === 'Home') {
      next = min;
    } else if (e.key === 'End') {
      next = max;
    }
    if (next !== null) {
      e.preventDefault();
      stopAnimation();
      commitSnapped(next);
    }
  };

  const displayStr = formatValue
    ? formatValue(visualValue)
    : step < 1
      ? visualValue.toFixed(1)
      : Math.round(visualValue).toString();

  // Compute visible tick window around visualValue
  const currentStepFloat = (visualValue - min) / step;
  const centerIdx = Math.round(currentStepFloat);
  const totalSteps = Math.round((max - min) / step);
  const halfWindow = 22;
  const startIdx = Math.max(0, centerIdx - halfWindow);
  const endIdx = Math.min(totalSteps, centerIdx + halfWindow);

  const ticks: number[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    ticks.push(i);
  }

  return (
    <div className={`select-none ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Numeric readout + fine nudge */}
      <div className="flex items-baseline justify-center gap-1.5 mb-1.5">
        <span
          className="text-2xl font-bold tracking-tight tabular-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {displayStr}
        </span>
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {unit}
        </span>
      </div>

      {/* Draggable ruler track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${displayStr} ${unit}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
        className="relative h-12 w-full overflow-hidden cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 rounded-xl"
        style={{
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
          outlineColor: 'var(--focus-ring)',
          maskImage:
            'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
        }}
      >
        {/* Center needle */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0.5 z-10 -translate-x-1/2 flex flex-col items-center"
        >
          <div
            className="w-[2.5px] h-7 rounded-full"
            style={{ backgroundColor: 'var(--accent-fill)' }}
          />
        </div>

        {/* Ticks */}
        <div aria-hidden="true" className="relative h-full w-full">
          {ticks.map((idx) => {
            const offsetPx = (idx - currentStepFloat) * tickSpacing;
            const isMajor = idx % majorEvery === 0;
            const isMid = !isMajor && idx % midEvery === 0;
            const isActive = Math.abs(idx - currentStepFloat) < 0.5;
            const tickValue = min + idx * step;

            return (
              <div
                key={idx}
                className="absolute top-1.5 left-1/2 flex flex-col items-center"
                style={{
                  transform: `translate3d(${offsetPx}px, 0, 0) translateX(-50%)`,
                }}
              >
                <div
                  className="rounded-full transition-colors duration-100"
                  style={{
                    width: isMajor ? '2px' : '1.5px',
                    height: isMajor ? '22px' : isMid ? '15px' : '10px',
                    marginTop: isMajor ? '0px' : isMid ? '3px' : '6px',
                    backgroundColor: isActive
                      ? 'var(--accent-fill)'
                      : isMajor
                        ? 'var(--text-secondary)'
                        : 'var(--border-control)',
                    opacity: isActive ? 1 : isMajor ? 0.78 : isMid ? 0.52 : 0.34,
                  }}
                />
                {isMajor && (
                  <span
                    className="mt-1 text-[10px] font-medium tabular-nums leading-none"
                    style={{
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {formatTickLabel
                      ? formatTickLabel(tickValue)
                      : step < 1
                        ? tickValue.toFixed(0)
                        : Math.round(tickValue)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

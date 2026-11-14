'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type VerticalWheelPickerProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unitLabel?: string;
  label: string;
  itemHeight?: number;
};

function clampAndRound(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(val)));
}

export default function VerticalWheelPicker({
  value,
  onChange,
  min = 12,
  max = 110,
  unitLabel = 'años',
  label,
  itemHeight = 56,
}: VerticalWheelPickerProps) {
  const [visualValue, setVisualValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const [isCoasting, setIsCoasting] = useState(false);

  const rafRef = useRef<number | null>(null);
  const visualRef = useRef(value);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startValue: number;
    history: Array<{ y: number; t: number }>;
  } | null>(null);

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
    setIsCoasting(false);
  }, []);

  const commitSnapped = useCallback(
    (rawVal: number) => {
      const snapped = clampAndRound(rawVal, min, max);
      visualRef.current = snapped;
      setVisualValue(snapped);
      onChange(snapped);
      return snapped;
    },
    [min, max, onChange]
  );

  const startMomentum = useCallback(
    (initialVelocityPxPerMs: number) => {
      stopAnimation();
      setIsCoasting(true);
      let velocityItemsPerMs = -(initialVelocityPxPerMs / itemHeight);
      let lastTime = performance.now();

      const tick = (now: number) => {
        const dt = Math.min(32, Math.max(1, now - lastTime));
        lastTime = now;

        const nextRaw = visualRef.current + velocityItemsPerMs * dt;
        const clamped = Math.min(max, Math.max(min, nextRaw));
        visualRef.current = clamped;
        setVisualValue(clamped);

        const snapped = clampAndRound(clamped, min, max);
        if (snapped !== value) {
          onChange(snapped);
        }

        const decay = Math.pow(0.92, dt / 16.67);
        velocityItemsPerMs *= decay;

        const hitBoundary = clamped <= min || clamped >= max;
        if (hitBoundary || Math.abs(velocityItemsPerMs * itemHeight) < 0.018) {
          rafRef.current = null;
          setIsCoasting(false);
          commitSnapped(clamped);
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [stopAnimation, itemHeight, min, max, value, onChange, commitSnapped]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasCoasting = rafRef.current !== null;
    stopAnimation();
    const startVal = wasCoasting ? visualRef.current : value;
    visualRef.current = startVal;
    setVisualValue(startVal);
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startValue: startVal,
      history: [{ y: e.clientY, t: performance.now() }],
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const now = performance.now();
    const deltaY = e.clientY - drag.startY;
    const rawVal = drag.startValue - deltaY / itemHeight;
    const clamped = Math.min(max, Math.max(min, rawVal));

    visualRef.current = clamped;
    setVisualValue(clamped);

    const snapped = clampAndRound(clamped, min, max);
    if (snapped !== value) {
      onChange(snapped);
    }

    drag.history.push({ y: e.clientY, t: now });
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
      const velocityPxPerMs = (last.y - first.y) / dt;
      if (Math.abs(velocityPxPerMs) > 0.12) {
        startMomentum(velocityPxPerMs);
        return;
      }
    }

    commitSnapped(visualRef.current);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) < 4) return;
    stopAnimation();
    const dir = e.deltaY > 0 ? 1 : -1;
    commitSnapped(value + dir);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      next = value - (e.shiftKey ? 5 : 1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      next = value + (e.shiftKey ? 5 : 1);
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

  const activeVisualValue = isDragging || isCoasting ? visualValue : value;
  const centerVal = Math.round(activeVisualValue);
  const windowRadius = 3;
  const start = Math.max(min, centerVal - windowRadius);
  const end = Math.min(max, centerVal + windowRadius);

  const visibleItems: number[] = [];
  for (let v = start; v <= end; v++) {
    visibleItems.push(v);
  }

  const containerHeight = itemHeight * 5;

  return (
    <div className="flex flex-col items-center justify-center select-none w-full">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} ${unitLabel}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-[240px] overflow-hidden cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-4 rounded-3xl"
        style={{
          height: `${containerHeight}px`,
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
          outlineColor: 'var(--focus-ring)',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
        }}
      >
        {/* Center iOS selection pill */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 rounded-2xl border"
          style={{
            height: `${itemHeight + 6}px`,
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--border-subtle)',
            boxShadow: '0 4px 18px -6px rgba(0, 0, 0, 0.22)',
          }}
        />

        {/* Unit label anchored to the right of the center pill */}
        {unitLabel && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wider z-10"
            style={{ color: 'var(--text-muted)' }}
          >
            {unitLabel}
          </span>
        )}

        {/* Numbers only — no lines or bars */}
        <div aria-hidden="true" className="relative h-full w-full">
          {visibleItems.map((num) => {
            const diff = num - activeVisualValue;
            const absDiff = Math.abs(diff);
            const offsetY = diff * itemHeight;
            const scale = Math.max(0.66, 1 - absDiff * 0.14);
            const opacity =
              absDiff < 0.45 ? 1 : Math.max(0.08, 0.56 - (absDiff - 0.5) * 0.24);
            const isActive = absDiff < 0.45;

            return (
              <div
                key={num}
                onClick={() => {
                  if (!isDragging && num !== value) {
                    stopAnimation();
                    commitSnapped(num);
                  }
                }}
                className="absolute left-0 right-0 top-1/2 flex items-center justify-center"
                style={{
                  height: `${itemHeight}px`,
                  transform: `translate3d(0, calc(-50% + ${offsetY}px), 0) scale(${scale})`,
                  opacity,
                }}
              >
                <span
                  className="tabular-nums tracking-tight leading-none"
                  style={{
                    fontSize: isActive ? '2.5rem' : '2.1rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {num}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

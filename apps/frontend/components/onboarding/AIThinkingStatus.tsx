'use client';

import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

type AIThinkingStatusProps = {
  states: readonly string[];
  className?: string;
};

export default function AIThinkingStatus({ states, className = '' }: AIThinkingStatusProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'visible' | 'exiting' | 'entering'>('visible');

  const longestLabel = states.reduce((acc, item) => (item.length > acc.length ? item : acc), states[0] ?? '');
  const currentLabel = states[index % Math.max(1, states.length)] ?? '';

  useEffect(() => {
    if (reduceMotion || states.length <= 1) return;

    let exitTimer: number | undefined;
    let enterTimer: number | undefined;
    const holdTimer = window.setInterval(() => {
      setPhase('exiting');
      exitTimer = window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % states.length);
        setPhase('entering');
        enterTimer = window.setTimeout(() => {
          setPhase('visible');
        }, 40);
      }, 150);
    }, 2000);

    return () => {
      window.clearInterval(holdTimer);
      if (exitTimer) window.clearTimeout(exitTimer);
      if (enterTimer) window.clearTimeout(enterTimer);
    };
  }, [reduceMotion, states]);

  const stateClass =
    phase === 'exiting'
      ? 'is-exit'
      : phase === 'entering'
      ? 'is-enter-start'
      : '';

  return (
    <span className={`t-think text-xs font-medium ${className}`} role="status" aria-live="polite">
      <span className="t-think-sizer" aria-hidden="true">
        {longestLabel}
      </span>
      <span
        className={`t-think-text ${stateClass}`}
        data-text={currentLabel}
      >
        {currentLabel}
      </span>
    </span>
  );
}

'use client';

import { clampPercent, formatNumber } from '@/lib/utils/display';

export type ProgressTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  valueText?: string;
  tone?: ProgressTone;
  fillColor?: string;
  className?: string;
}

export default function ProgressBar({
  value,
  max,
  label,
  valueText,
  tone = 'accent',
  fillColor,
  className = '',
}: ProgressBarProps) {
  const percent = clampPercent(value, max);
  const toneClass = tone === 'accent' ? '' : ` pv2-progress__fill--${tone}`;

  return (
    <div
      className={`pv2-progress ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max > 0 ? max : 100}
      aria-valuenow={Number.isFinite(value) ? Math.max(0, value) : 0}
      aria-valuetext={valueText || `${formatNumber(value)} de ${formatNumber(max)}`}
    >
      <div
        className={`pv2-progress__fill${toneClass}`}
        style={{ width: `${percent}%`, ...(fillColor ? { backgroundColor: fillColor } : null) }}
      />
    </div>
  );
}

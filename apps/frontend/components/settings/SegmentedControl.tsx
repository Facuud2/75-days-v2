'use client';

import React from 'react';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ElementType;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T, event: React.MouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
}

/**
 * iOS-style Segmented Control with an animated sliding pill indicator.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.id === value)
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative grid rounded-xl bg-[var(--surface-inset)] p-1 border border-[var(--border-subtle)]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {/* Sliding active pill */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-[9px] bg-[var(--surface-card)] shadow-sm border border-[var(--border-subtle)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={(e) => onChange(opt.id, e)}
            className={`relative z-10 flex min-h-[44px] items-center justify-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
              active
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {Icon && (
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${
                  active ? 'text-[var(--accent-text)]' : ''
                }`}
                aria-hidden="true"
              />
            )}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

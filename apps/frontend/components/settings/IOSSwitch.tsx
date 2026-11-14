'use client';

import React from 'react';

interface IOSSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

/**
 * Accessible iOS-proportion switch (51x31) whose active track inherits
 * the active theme palette via --accent-fill.
 */
export function IOSSwitch({
  checked,
  onCheckedChange,
  ariaLabel,
  disabled = false,
}: IOSSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full p-[2px] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[var(--accent-fill)]' : 'bg-[var(--surface-raised)] border border-[var(--border-subtle)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none block h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          checked ? 'translate-x-[20px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SettingsRowProps {
  icon?: React.ElementType;
  iconBgClass?: string;
  iconColorClass?: string;
  title: string;
  subtitle?: string;
  detail?: React.ReactNode;
  onClick?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  className?: string;
}

/**
 * Universal iOS-style settings row with >=48px touch target, squircle icon badge,
 * optional right-aligned detail value, and disclosure chevron.
 */
export function SettingsRow({
  icon: Icon,
  iconBgClass = 'bg-rose-500/15',
  iconColorClass = 'text-rose-400',
  title,
  subtitle,
  detail,
  onClick,
  rightElement,
  showChevron = Boolean(onClick),
  destructive = false,
  className = '',
}: SettingsRowProps) {
  const content = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {Icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${iconBgClass}`}
            aria-hidden="true"
          >
            <Icon className={`h-4 w-4 ${iconColorClass}`} strokeWidth={2.1} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[15px] font-medium leading-snug ${
              destructive ? 'text-[var(--status-danger)]' : 'text-[var(--text-primary)]'
            }`}
          >
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--text-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-3">
        {detail !== undefined && detail !== null && (
          <span className="max-w-[140px] truncate text-sm text-[var(--text-muted)] sm:max-w-[200px]">
            {detail}
          </span>
        )}
        {rightElement}
        {showChevron && !rightElement && (
          <ChevronRight
            className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-70"
            strokeWidth={2.1}
            aria-hidden="true"
          />
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-[52px] w-full items-center justify-between px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--surface-inset)] active:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`flex min-h-[52px] w-full items-center justify-between px-4 py-3 ${className}`}
    >
      {content}
    </div>
  );
}

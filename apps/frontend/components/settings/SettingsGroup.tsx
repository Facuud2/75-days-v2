'use client';

import React from 'react';

interface SettingsGroupProps {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * iOS Inset Grouped container: renders a subtle uppercase section header,
 * a rounded surface card with inset horizontal dividers, and an optional footer caption.
 */
export function SettingsGroup({ title, footer, children, className = '' }: SettingsGroupProps) {
  return (
    <section className={`space-y-1.5 ${className}`}>
      {title && (
        <h2 className="px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] divide-y divide-[var(--divider)]">
        {children}
      </div>
      {footer && (
        <p className="px-4 pt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
          {footer}
        </p>
      )}
    </section>
  );
}

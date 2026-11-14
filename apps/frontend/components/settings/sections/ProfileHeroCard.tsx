'use client';

import React from 'react';
import Image from 'next/image';
import { ChevronRight, Crown } from 'lucide-react';
import { PlanId } from '@/store/useSettingsStore';

interface ProfileHeroCardProps {
  name: string;
  email: string;
  avatarUrl?: string | null;
  selectedPlan: PlanId;
  isActiveChallenge: boolean;
  onClick?: () => void;
  compact?: boolean;
}

const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Plan Gratuito',
  pro: 'Pro',
  elite: 'Elite',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '75';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ProfileHeroCard({
  name,
  email,
  avatarUrl,
  selectedPlan,
  isActiveChallenge,
  onClick,
  compact = false,
}: ProfileHeroCardProps) {
  const displayName = name.trim() || 'Tu perfil';
  const displayEmail = email.trim() || 'Completá tu email';
  const initials = getInitials(displayName);

  const inner = (
    <div className="flex items-center gap-3.5 w-full">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={displayName}
          width={compact ? 44 : 56}
          height={compact ? 44 : 56}
          unoptimized
          className={`${
            compact ? 'h-11 w-11' : 'h-14 w-14'
          } shrink-0 rounded-full object-cover border border-[var(--border-subtle)]`}
        />
      ) : (
        <div
          className={`${
            compact ? 'h-11 w-11 text-sm' : 'h-14 w-14 text-base'
          } flex shrink-0 items-center justify-center rounded-full bg-rose-500/15 font-bold text-[var(--accent-text)] border border-rose-500/25`}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}

      <div className="min-w-0 flex-1 text-left">
        <p className={`${compact ? 'text-sm' : 'text-base'} truncate font-bold text-[var(--text-primary)]`}>
          {displayName}
        </p>
        <p className="truncate text-xs text-[var(--text-muted)]">{displayEmail}</p>
        {!compact && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-text)]">
              <Crown className="h-3 w-3" aria-hidden="true" />
              {PLAN_LABELS[selectedPlan]}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isActiveChallenge
                  ? 'bg-emerald-500/15 text-[var(--status-success)]'
                  : 'bg-[var(--surface-inset)] text-[var(--text-muted)]'
              }`}
            >
              {isActiveChallenge ? 'Desafío activo' : 'Sin desafío'}
            </span>
          </div>
        )}
      </div>

      {onClick && (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-75"
          aria-hidden="true"
        />
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-sm transition-colors duration-150 hover:bg-[var(--surface-inset)] active:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3.5">
      {inner}
    </div>
  );
}

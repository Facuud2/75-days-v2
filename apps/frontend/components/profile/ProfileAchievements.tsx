'use client';

import { ArrowRight, CheckCircle2, Trophy } from 'lucide-react';
import AchievementIcon from './AchievementIcon';
import ProgressBar from './ProgressBar';
import type { ProfileAchievement } from './types';
import { formatInteger, formatShortDate } from '@/lib/utils/display';

interface ProfileAchievementsProps {
  achievements: ProfileAchievement[];
  loading?: boolean;
  onOpenAll: () => void;
}

function achievementUnit(achievement: ProfileAchievement): string {
  const title = (achievement.title || '').toLowerCase();
  if (title.includes('peso') || title.includes('transformación') || title.includes('kg')) return 'kg';
  if (title.includes('racha') || title.includes('día') || title.includes('constancia')) return 'días';
  return 'pasos';
}

/** Singular para «falta 1 día / 1 paso». `kg` no varía. */
function missingUnit(achievement: ProfileAchievement): string {
  const unit = achievementUnit(achievement);
  const missing = Math.max(0, achievement.total - achievement.progress);
  if (missing !== 1) return unit;
  if (unit === 'días') return 'día';
  if (unit === 'pasos') return 'paso';
  return unit;
}

export default function ProfileAchievements({ achievements, loading = false, onOpenAll }: ProfileAchievementsProps) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando logros">
        <div className="pv2-skeleton h-5 w-40" />
        <div className="pv2-skeleton h-1 w-full" />
        <div className="pv2-skeleton h-14 w-full" />
        <div className="pv2-skeleton h-14 w-full" />
      </div>
    );
  }

  const total = achievements.length;
  const unlocked = achievements.filter((achievement) => achievement.unlocked);
  const locked = achievements.filter((achievement) => !achievement.unlocked);

  const lastUnlocked = [...unlocked]
    .sort((a, b) => {
      const aTime = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
      const bTime = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  const next = locked.find((achievement) => achievement.progress > 0) || locked[0] || null;

  if (total === 0) {
    return (
      <div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no hay logros definidos para tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="pv2-num text-[26px] font-medium leading-none" style={{ color: 'var(--text-primary)' }}>
            {formatInteger(unlocked.length)}
            <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>
              {' '}
              de {formatInteger(total)}
            </span>
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Logros desbloqueados
          </p>
        </div>

        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--surface-inset)', color: 'var(--accent-text)' }} aria-hidden="true">
          <Trophy size={18} strokeWidth={1.5} />
        </span>
      </div>

      <ProgressBar
        className="mt-4"
        value={unlocked.length}
        max={total}
        label="Logros desbloqueados"
        valueText={`${formatInteger(unlocked.length)} de ${formatInteger(total)} logros`}
      />

      {lastUnlocked.length > 0 ? (
        <div className="mt-5">
          <h3 className="pv2-label">Últimos desbloqueados</h3>
          <ul className="mt-2 space-y-1">
            {lastUnlocked.map((achievement) => (
              <li key={achievement.id} className="flex min-w-0 items-center gap-3 py-1.5">
                <AchievementIcon id={achievement.id} title={achievement.title} unlocked size={18} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }} title={achievement.title}>
                    {achievement.title}
                  </span>
                  {achievement.description ? (
                    <span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--text-muted)' }} title={achievement.description}>
                      {achievement.description}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  <CheckCircle2 size={15} strokeWidth={1.5} style={{ color: 'var(--status-success)' }} aria-hidden="true" />
                  {achievement.unlockedAt ? (
                    <span className="pv2-mono mt-0.5 block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {formatShortDate(achievement.unlockedAt)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Aún no has desbloqueado ningún logro. El primero está más cerca de lo que parece.
        </p>
      )}

      {next ? (
        <div className="pv2-inset mt-4 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <AchievementIcon id={next.id} title={next.title} unlocked={false} size={18} />
              <div className="min-w-0">
                <p className="pv2-label">Próximo logro</p>
                <p className="mt-1 truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }} title={next.title}>
                  {next.title}
                </p>
              </div>
            </div>
            <p className="pv2-mono shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatInteger(next.progress)}/{formatInteger(next.total)}
            </p>
          </div>

          <ProgressBar
            className="mt-3"
            value={next.progress}
            max={next.total || 1}
            label={`Progreso de ${next.title}`}
            valueText={`${formatInteger(next.progress)} de ${formatInteger(next.total)} ${achievementUnit(next)}`}
            tone="neutral"
          />

          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Te faltan {formatInteger(Math.max(0, next.total - next.progress))} {missingUnit(next)} para desbloquearlo.
          </p>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm" style={{ color: 'var(--status-success)' }}>
          <CheckCircle2 size={16} strokeWidth={1.5} aria-hidden="true" />
          Has desbloqueado todos los logros.
        </p>
      )}

      <button type="button" onClick={onOpenAll} className="pv2-ghost mt-4 w-full">
        Ver todos los logros
        <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

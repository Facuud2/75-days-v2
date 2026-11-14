'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import BottomSheet from './BottomSheet';
import AchievementIcon, { getAchievementCategory, type AchievementCategory } from './AchievementIcon';
import ProgressBar from './ProgressBar';
import type { ProfileAchievement } from './types';
import { formatInteger, formatShortDate } from '@/lib/utils/display';

type Filter = 'todas' | AchievementCategory;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'constancia', label: 'Constancia' },
  { value: 'salud', label: 'Salud' },
  { value: 'retos', label: 'Retos' },
];

const PAGE_SIZE = 12;

interface AchievementsSheetProps {
  open: boolean;
  onClose: () => void;
  achievements: ProfileAchievement[];
}

export default function AchievementsSheet({ open, onClose, achievements }: AchievementsSheetProps) {
  const [filter, setFilter] = useState<Filter>('todas');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const list = achievements || [];
    if (filter === 'todas') return list;
    return list.filter((achievement) => getAchievementCategory(achievement.id, achievement.title) === filter);
  }, [achievements, filter]);

  const visible = filtered.slice(0, visibleCount);

  const handleFilter = (nextFilter: Filter) => {
    setFilter(nextFilter);
    setVisibleCount(PAGE_SIZE);
  };

  const unlockedCount = (achievements || []).filter((achievement) => achievement.unlocked).length;
  const totalCount = (achievements || []).length;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Logros"
      description={`${formatInteger(unlockedCount)} de ${formatInteger(totalCount)} desbloqueados.`}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar logros por categoría">
        {FILTERS.map((item) => {
          const isActive = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => handleFilter(item.value)}
              aria-pressed={isActive}
              className="min-h-9 rounded-full border px-3 text-xs font-medium"
              style={{
                backgroundColor: isActive ? 'var(--text-primary)' : 'transparent',
                borderColor: isActive ? 'var(--text-primary)' : 'var(--border-control)',
                color: isActive ? 'var(--surface-page)' : 'var(--text-secondary)',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          No hay logros en esta categoría.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((achievement) => (
            <li key={achievement.id} className="pv2-inset min-w-0 p-3">
              <div className="flex items-start gap-3">
                <AchievementIcon id={achievement.id} title={achievement.title} unlocked={achievement.unlocked} size={18} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--text-primary)' }}>
                      {achievement.title}
                    </h3>
                    {achievement.unlocked ? (
                      <CheckCircle2 size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" style={{ color: 'var(--status-success)' }} aria-hidden="true" />
                    ) : (
                      <Lock size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    )}
                  </div>

                  {achievement.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed [overflow-wrap:anywhere]" style={{ color: 'var(--text-muted)' }}>
                      {achievement.description}
                    </p>
                  ) : null}

                  {achievement.unlocked ? (
                    <p className="pv2-mono mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {formatShortDate(achievement.unlockedAt)
                        ? `Desbloqueado ${formatShortDate(achievement.unlockedAt)}`
                        : 'Desbloqueado'}
                    </p>
                  ) : (
                    <div className="mt-2">
                      <ProgressBar
                        value={achievement.progress}
                        max={achievement.total || 1}
                        label={`Progreso de ${achievement.title}`}
                        valueText={`${formatInteger(achievement.progress)} de ${formatInteger(achievement.total)}`}
                        tone="neutral"
                      />
                      <p className="pv2-mono mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {formatInteger(achievement.progress)} / {formatInteger(achievement.total)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {visibleCount < filtered.length ? (
        <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="pv2-ghost mt-4 w-full">
          Ver más
        </button>
      ) : null}
    </BottomSheet>
  );
}

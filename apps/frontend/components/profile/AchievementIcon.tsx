'use client';

import { createElement } from 'react';
import {
  Award,
  CalendarCheck,
  Compass,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Medal,
  Scale,
  Sparkles,
  Star,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

const byTitle: Record<string, LucideIcon> = {
  'primer paso': Footprints,
  constancia: Flame,
  disciplina: Target,
  'fuerza de voluntad': Scale,
  aventurero: Compass,
  transformación: Sparkles,
};

const byId: Record<string, LucideIcon> = {
  '1': Footprints,
  '2': Flame,
  '3': Target,
  '4': Scale,
  '5': Compass,
  '6': Sparkles,
};

export type AchievementCategory = 'constancia' | 'salud' | 'retos';

const categoryByTitle: Record<string, AchievementCategory> = {
  'primer paso': 'retos',
  constancia: 'constancia',
  disciplina: 'retos',
  'fuerza de voluntad': 'salud',
  aventurero: 'retos',
  transformación: 'salud',
};

const categoryById: Record<string, AchievementCategory> = {
  '1': 'retos',
  '2': 'constancia',
  '3': 'retos',
  '4': 'salud',
  '5': 'retos',
  '6': 'salud',
};

export function getAchievementIcon(id: string, title: string): LucideIcon {
  const normalizedTitle = (title || '').trim().toLowerCase();
  return byTitle[normalizedTitle] || byId[id] || Award;
}

export function getAchievementCategory(id: string, title: string): AchievementCategory {
  const normalizedTitle = (title || '').trim().toLowerCase();
  return categoryByTitle[normalizedTitle] || categoryById[id] || 'retos';
}

interface AchievementIconProps {
  id: string;
  title: string;
  unlocked: boolean;
  size?: number;
  className?: string;
}

export default function AchievementIcon({ id, title, unlocked, size = 20, className = '' }: AchievementIconProps) {
  const Icon = getAchievementIcon(id, title);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl ${className}`}
      style={{
        width: size + 20,
        height: size + 20,
        backgroundColor: 'var(--surface-inset)',
        border: '1px solid var(--border-subtle)',
        color: unlocked ? 'var(--accent-text)' : 'var(--text-muted)',
      }}
      aria-hidden="true"
    >
      {createElement(Icon, { size, strokeWidth: 1.5 })}
    </span>
  );
}

export { Award, CalendarCheck, Dumbbell, HeartPulse, Medal, Star, Trophy };

import {
  Activity,
  Apple,
  Book,
  Clock,
  Droplet,
  Dumbbell,
  Footprints,
  Moon,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react';

export const questIconMap: Record<string, LucideIcon> = {
  droplet: Droplet,
  dumbbell: Dumbbell,
  book: Book,
  sun: Sun,
  moon: Moon,
  target: Target,
  apple: Apple,
  utensils: Apple,
  footprints: Footprints,
  clock: Clock,
};

export const goalIconMap: Record<string, LucideIcon> = {
  ...questIconMap,
};

export function getQuestIcon(icon?: string | null): LucideIcon {
  if (!icon) return Activity;
  return questIconMap[icon] || Activity;
}

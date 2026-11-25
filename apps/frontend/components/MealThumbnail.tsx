'use client';

import { Apple, Coffee, Moon, Utensils, UtensilsCrossed, type LucideIcon } from 'lucide-react';

interface MealThumbnailProps {
  /** Tipo de comida registrado (`breakfast` | `lunch` | `snack` | `dinner`). */
  mealType?: string;
  /** Diámetro en píxeles. Por defecto 48. */
  size?: number;
  className?: string;
}

interface MealVisual {
  Icon: LucideIcon;
  gradient: string;
}

/**
 * Cada tipo de comida tiene una "foto" determinística: un degradado cálido con
 * el icono del design system. La API todavía no devuelve URLs de imagen, así que
 * en lugar de círculos vacíos mostramos una miniatura reconocible y consistente
 * con el resto del sitio (que usa iconos, no emojis).
 */
const MEAL_VISUALS: Record<string, MealVisual> = {
  breakfast: {
    Icon: Coffee,
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
  },
  lunch: {
    Icon: UtensilsCrossed,
    gradient: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
  },
  snack: {
    Icon: Apple,
    gradient: 'linear-gradient(135deg, #a3e635 0%, #16a34a 100%)',
  },
  dinner: {
    Icon: Moon,
    gradient: 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)',
  },
};

const FALLBACK_VISUAL: MealVisual = {
  Icon: Utensils,
  gradient: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)',
};

export default function MealThumbnail({
  mealType,
  size = 48,
  className,
}: MealThumbnailProps) {
  const visual = (mealType && MEAL_VISUALS[mealType]) || FALLBACK_VISUAL;
  const Icon = visual.Icon;
  const iconSize = Math.max(14, Math.round(size * 0.44));

  return (
    <div
      aria-hidden="true"
      className={`relative shrink-0 overflow-hidden rounded-full ring-1 ring-white/15 ${className ?? ''}`}
      style={{ width: size, height: size, background: visual.gradient }}
    >
      {/* Luz superior para que el degradado se lea como una foto y no como un bloque plano. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 32% 22%, rgba(255,255,255,0.55), rgba(255,255,255,0) 58%)',
        }}
      />
      {/* Sombra inferior para dar volumen. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 70% 105%, rgba(0,0,0,0.35), rgba(0,0,0,0) 60%)',
        }}
      />
      <Icon
        className="absolute inset-0 m-auto text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
        style={{ width: iconSize, height: iconSize }}
        strokeWidth={1.9}
      />
    </div>
  );
}

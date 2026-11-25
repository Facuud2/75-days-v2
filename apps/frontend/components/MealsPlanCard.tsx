'use client';

import { ChevronRight } from 'lucide-react';
import MealThumbnail from './MealThumbnail';

interface MealPlanItem {
  id: string;
  name: string;
  calories: number;
  prepTimeMin?: number;
  mealType?: string;
}

interface MealsPlanCardProps {
  meals: MealPlanItem[];
  onMealPress: (meal: MealPlanItem) => void;
  className?: string;
}

/**
 * Tarjeta "Plan de comidas" estilo Bitepal.
 * Lista de comidas con foto circular, nombre, kcal y tiempo de preparación.
 */
export default function MealsPlanCard({
  meals,
  onMealPress,
  className,
}: MealsPlanCardProps) {
  return (
    <section
      aria-label="Plan de comidas"
      className={`rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0 ${className ?? ''}`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Plan de comidas</h2>
      </div>

      <div className="divide-y divide-[var(--divider)] overflow-hidden rounded-[20px]">
        {meals.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] text-[var(--text-muted)]">
              Sin comidas registradas hoy
            </p>
          </div>
        ) : (
          meals.map((meal) => (
            <button
              key={meal.id}
              type="button"
              onClick={() => onMealPress(meal)}
              className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-inset)]/60 active:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
            >
              <MealThumbnail mealType={meal.mealType} size={48} />
              <div className="min-w-0 flex-1">
                <p
                  id={`meal-plan-name-${meal.id}`}
                  className="text-[15px] font-medium leading-[1.35] text-[var(--text-primary)] [overflow-wrap:anywhere]"
                >
                  {meal.name}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--text-muted)] tabular-nums">
                  {meal.calories} kcal · {meal.prepTimeMin ?? 5} min
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            </button>
          ))
        )}
      </div>
    </section>
  );
}

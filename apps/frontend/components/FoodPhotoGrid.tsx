'use client';

import MealThumbnail from './MealThumbnail';
import type { Meal } from '@/lib/api/health';

interface FoodPhotoGridProps {
  meals: Meal[];
  totalCount?: number;
  className?: string;
  onMealPress?: (meal: Meal) => void;
}

/**
 * Miniaturas circulares superpuestas de comidas (estilo Bitepal).
 * Cuando se proporciona `onMealPress`, las miniaturas son interactivas
 * y abren el detalle de la comida al pulsar sobre ellas.
 */
export default function FoodPhotoGrid({
  meals,
  totalCount,
  className,
  onMealPress,
}: FoodPhotoGridProps) {
  if (meals.length === 0) return null;

  const extraCount = totalCount && totalCount > meals.length ? totalCount - meals.length : 0;

  return (
    <div
      className={`flex items-center -space-x-3.5 ${className ?? ''}`}
      aria-hidden={onMealPress ? undefined : true}
      role={onMealPress ? 'list' : undefined}
    >
      {meals.map((meal, index) => {
        const thumb = (
          <MealThumbnail
            mealType={meal.mealType}
            photoUrl={meal.photoUrl}
            alt={meal.name}
            size={62}
            className="ring-0"
          />
        );

        return onMealPress ? (
          <div
            key={meal.id}
            role="listitem"
            className="relative transition-transform duration-150 hover:z-20 hover:scale-105"
            style={{ zIndex: index + 1 }}
          >
            <button
              type="button"
              onClick={() => onMealPress(meal)}
              className="block cursor-pointer overflow-hidden rounded-full border-[3px] border-[var(--surface-card)] bg-[var(--surface-card)] transition-transform duration-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              aria-label={`Ver detalles de ${meal.name}`}
            >
              {thumb}
            </button>
          </div>
        ) : (
          <div
            key={meal.id}
            className="relative overflow-hidden rounded-full border-[3px] border-[var(--surface-card)] bg-[var(--surface-card)]"
            style={{ zIndex: index + 1 }}
          >
            {thumb}
          </div>
        );
      })}

      {extraCount > 0 ? (
        <div
          className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full border-[3px] border-[var(--surface-card)] bg-[var(--surface-inset)] text-[14px] font-bold text-[var(--text-secondary)] tabular-nums"
          style={{ zIndex: meals.length + 1 }}
          aria-label={`${extraCount} comidas más`}
        >
          +{extraCount}
        </div>
      ) : null}
    </div>
  );
}

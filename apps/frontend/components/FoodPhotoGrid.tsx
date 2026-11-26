'use client';

import MealThumbnail from './MealThumbnail';
import type { Meal } from '@/lib/api/health';

interface FoodPhotoGridProps {
  meals: Meal[];
  className?: string;
  onMealPress?: (meal: Meal) => void;
}

/**
 * Miniaturas circulares de comida (estilo Bitepal).
 * Cuando se proporciona `onMealPress`, las miniaturas son interactivas
 * y abren el detalle de la comida al pulsar sobre ellas.
 */
export default function FoodPhotoGrid({ meals, className, onMealPress }: FoodPhotoGridProps) {
  if (meals.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-2 ${className ?? ''}`}
      aria-hidden={onMealPress ? undefined : true}
      role={onMealPress ? 'list' : undefined}
    >
      {meals.map((meal) =>
        onMealPress ? (
          <div key={meal.id} role="listitem">
            <button
              type="button"
              onClick={() => onMealPress(meal)}
              className="cursor-pointer rounded-full transition-transform duration-100 hover:opacity-85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              aria-label={`Ver detalles de ${meal.name}`}
            >
              <MealThumbnail
                mealType={meal.mealType}
                photoUrl={meal.photoUrl}
                alt={meal.name}
                size={56}
              />
            </button>
          </div>
        ) : (
          <div key={meal.id}>
            <MealThumbnail
              mealType={meal.mealType}
              photoUrl={meal.photoUrl}
              alt={meal.name}
              size={56}
            />
          </div>
        )
      )}
    </div>
  );
}

'use client';

import MealThumbnail from './MealThumbnail';

interface FoodPhotoGridProps {
  meals: { id: string; name: string; mealType: string }[];
  className?: string;
}

/**
 * Miniaturas circulares de comida (estilo Bitepal).
 * El conjunto es decorativo (`aria-hidden`): el nombre accesible de cada comida
 * vive en la tarjeta "Plan de comidas".
 */
export default function FoodPhotoGrid({ meals, className }: FoodPhotoGridProps) {
  if (meals.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`} aria-hidden="true">
      {meals.map((meal) => (
        <MealThumbnail key={meal.id} mealType={meal.mealType} size={56} />
      ))}
    </div>
  );
}

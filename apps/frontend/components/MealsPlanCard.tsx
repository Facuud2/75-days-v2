'use client';

import { CalendarClock, Check, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { MealRoutine, MealRoutineItem } from '@/lib/api/health';
import MealThumbnail from './MealThumbnail';

interface MealPlanItem {
  id: string;
  name: string;
  calories: number;
  prepTimeMin?: number;
  mealType?: string;
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda / Snack',
  dinner: 'Cena',
};

interface MealsPlanCardProps {
  meals: MealPlanItem[];
  onMealPress: (meal: MealPlanItem) => void;
  activeRoutine?: MealRoutine | null;
  pendingPlannedItems?: MealRoutineItem[];
  onLogPlannedItem?: (item: MealRoutineItem) => void;
  onApplyAllPlanned?: () => void;
  onOpenRoutineBuilder?: () => void;
  onOpenAiRecommendations?: () => void;
  className?: string;
}

/**
 * Tarjeta "Plan de comidas" estilo Bitepal.
 * Combina comidas registradas del día con comidas pendientes de la rutina activa
 * (con registro directo en 1 toque) y accesos a Rutina / Recomendaciones IA.
 */
export default function MealsPlanCard({
  meals,
  onMealPress,
  activeRoutine,
  pendingPlannedItems = [],
  onLogPlannedItem,
  onApplyAllPlanned,
  onOpenRoutineBuilder,
  onOpenAiRecommendations,
  className,
}: MealsPlanCardProps) {
  const hasAnything = meals.length > 0 || pendingPlannedItems.length > 0;

  return (
    <section
      aria-label="Plan de comidas"
      className={`rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0 ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            Plan de comidas
          </h2>
          {activeRoutine ? (
            <p className="text-[11px] text-[var(--text-muted)]">
              Rutina activa:{' '}
              <span className="font-medium text-[var(--accent-text)]">
                {activeRoutine.name}
              </span>
            </p>
          ) : null}
        </div>

        {onOpenRoutineBuilder || onOpenAiRecommendations ? (
          <div className="flex items-center gap-1.5">
            {onOpenRoutineBuilder ? (
              <button
                type="button"
                onClick={onOpenRoutineBuilder}
                className="flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95"
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                Rutina
              </button>
            ) : null}
            {onOpenAiRecommendations ? (
              <button
                type="button"
                onClick={onOpenAiRecommendations}
                className="flex min-h-8 cursor-pointer items-center gap-1 rounded-full bg-[var(--accent-fill)]/15 px-2.5 text-xs font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-fill)]/25 active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Ideas IA
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Pending Planned Items from Active Routine */}
      {pendingPlannedItems.length > 0 ? (
        <div className="mx-3 mb-2 space-y-1.5 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)]/40 p-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Pendientes de tu rutina ({pendingPlannedItems.length})
            </span>
            {onApplyAllPlanned && pendingPlannedItems.length > 1 ? (
              <button
                type="button"
                onClick={onApplyAllPlanned}
                className="cursor-pointer text-[11px] font-semibold text-[var(--accent-text)] hover:underline"
              >
                Registrar todo el día
              </button>
            ) : null}
          </div>
          {pendingPlannedItems.map((item, idx) => (
            <div
              key={item.id ?? `${item.name}-${idx}`}
              className="flex items-center justify-between gap-2.5 rounded-xl bg-[var(--surface-card)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-text)]">
                  {SLOT_LABELS[item.mealType] ?? item.mealType}
                </span>
                <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                  {item.name}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                  {Math.round(item.calories)} kcal · P {Math.round(item.proteinG)}g
                </p>
              </div>
              {onLogPlannedItem ? (
                <button
                  type="button"
                  onClick={() => onLogPlannedItem(item)}
                  className="flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[var(--accent-fill)] px-3 text-xs font-semibold text-[var(--on-accent)] active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Registrar
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="divide-y divide-[var(--divider)] overflow-hidden rounded-[20px]">
        {!hasAnything ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] text-[var(--text-muted)]">
              Sin comidas registradas hoy
            </p>
          </div>
        ) : meals.length === 0 ? null : (
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
                  className="line-clamp-2 text-[15px] font-medium leading-[1.35] text-[var(--text-primary)] [overflow-wrap:anywhere]"
                >
                  {meal.name}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] tabular-nums">
                  <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                  {meal.calories.toLocaleString('es-AR')} kcal · {meal.prepTimeMin ?? 5} min
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

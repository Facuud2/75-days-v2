'use client';

import { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Dumbbell,
  Link2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Utensils,
} from 'lucide-react';
import ProgressBar from './ProgressBar';
import Sparkline from './Sparkline';
import type { HealthSummary, MealSummary, WorkoutSummary } from './types';
import { formatDecimal, formatInteger, formatNumber, mealTypeLabel, pluralize } from '@/lib/utils/display';

interface ProfileHealthProps {
  data: HealthSummary;
  loading?: boolean;
  loadingNutrition?: boolean;
  onLogWeight?: () => void;
  onLogMeal: () => void;
  onEditMeal: (meal: MealSummary) => void;
  onLogWorkout: () => void;
  onEditWorkout: (workout: WorkoutSummary) => void;
  onConnectStrava: () => void;
  onSyncStrava: () => void;
  syncingStrava?: boolean;
  stravaError?: string | null;
}

export default function ProfileHealth({
  data,
  loading = false,
  loadingNutrition = false,
  onLogWeight,
  onLogMeal,
  onEditMeal,
  onLogWorkout,
  onEditWorkout,
  onConnectStrava,
  onSyncStrava,
  syncingStrava = false,
  stravaError,
}: ProfileHealthProps) {
  const [showAllMeals, setShowAllMeals] = useState(false);
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Cargando salud">
        <div className="pv2-skeleton h-6 w-32" />
        <div className="pv2-skeleton h-20 w-full" />
        <div className="pv2-skeleton h-6 w-28" />
        <div className="pv2-skeleton h-16 w-full" />
        <div className="pv2-skeleton h-6 w-28" />
        <div className="pv2-skeleton h-14 w-full" />
      </div>
    );
  }

  const weightDelta = data.weightLost ?? 0;
  const hasWeight = data.currentWeight !== null && data.currentWeight > 0;
  const weightTone = weightDelta > 0 ? 'var(--status-success)' : weightDelta < 0 ? 'var(--status-warning)' : 'var(--text-muted)';
  const WeightDeltaIcon = weightDelta > 0 ? TrendingDown : weightDelta < 0 ? TrendingUp : Minus;

  const nutrition = data.nutrition;
  const overGoal = nutrition ? nutrition.consumed > nutrition.dailyGoal && nutrition.dailyGoal > 0 : false;
  const remaining = nutrition ? nutrition.dailyGoal - nutrition.consumed : 0;

  const macroRows = nutrition
    ? [
        { key: 'protein', label: 'Proteínas', value: nutrition.macros.proteinG, goal: nutrition.macros.goals?.proteinG, color: 'var(--chart-protein)' },
        { key: 'carb', label: 'Carbos', value: nutrition.macros.carbG, goal: nutrition.macros.goals?.carbG, color: 'var(--chart-carb)' },
        { key: 'fat', label: 'Grasas', value: nutrition.macros.fatG, goal: nutrition.macros.goals?.fatG, color: 'var(--chart-fat)' },
      ]
    : [];

  const visibleMeals = nutrition ? (showAllMeals ? nutrition.meals : nutrition.meals.slice(0, 3)) : [];
  const hiddenMeals = nutrition ? nutrition.meals.length - visibleMeals.length : 0;
  const visibleWorkouts = showAllWorkouts ? data.workouts : data.workouts.slice(0, 4);
  const hiddenWorkouts = data.workouts.length - visibleWorkouts.length;

  return (
    <div>
      {/* Peso */}
      <section aria-labelledby="health-weight-heading">
        <div className="flex items-center justify-between gap-3">
          <h3 id="health-weight-heading" className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <Scale size={16} strokeWidth={1.5} aria-hidden="true" />
            Peso
          </h3>
          <div className="flex items-center gap-2">
            {data.bmi !== null && data.bmi > 0 ? (
              <span className="pv2-chip">
                IMC {formatDecimal(data.bmi)} · {data.bmiLabel}
              </span>
            ) : null}
            {onLogWeight ? (
              <button type="button" onClick={onLogWeight} className="pv2-link min-h-9 text-xs">
                <Plus size={14} strokeWidth={2} aria-hidden="true" />
                Registrar
              </button>
            ) : null}
          </div>
        </div>

        {hasWeight ? (
          <>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="pv2-num text-[34px] font-medium leading-none" style={{ color: 'var(--text-primary)' }}>
                {formatDecimal(data.currentWeight)}
                <span className="ml-1 text-base font-normal" style={{ color: 'var(--text-muted)' }}>
                  kg
                </span>
              </p>

              {data.weightLost !== null ? (
                <div className="min-w-0 text-right">
                  <p className="flex items-center justify-end gap-1.5 text-sm font-medium" style={{ color: weightTone }}>
                    <WeightDeltaIcon size={16} strokeWidth={1.5} aria-hidden="true" />
                    {formatDecimal(Math.abs(weightDelta))} kg
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {weightDelta >= 0 ? 'desde el inicio' : 'ganados'}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <Sparkline points={data.weightHistory} goal={data.goalWeight} initial={data.initialWeight} />
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Inicial
                </dt>
                <dd className="pv2-mono mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {formatDecimal(data.initialWeight)} kg
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Meta
                </dt>
                <dd className="pv2-mono mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {formatDecimal(data.goalWeight)} kg
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Faltan
                </dt>
                <dd className="pv2-mono mt-1 text-sm" style={{ color: data.toGoal === 0 ? 'var(--status-success)' : 'var(--text-secondary)' }}>
                  {data.toGoal === 0 ? 'Meta lograda' : `${formatDecimal(data.toGoal)} kg`}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            Sin peso registrado. Añade tu peso desde el panel para empezar la tendencia.
          </p>
        )}
      </section>

      {/* Nutrición */}
      <section className="mt-5 border-t pt-5" style={{ borderColor: 'var(--divider)' }} aria-labelledby="health-nutrition-heading">
        <div className="flex items-center justify-between gap-3">
          <h3 id="health-nutrition-heading" className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <Utensils size={16} strokeWidth={1.5} aria-hidden="true" />
            Nutrición
          </h3>
          <button type="button" onClick={onLogMeal} className="pv2-link min-h-9 text-xs">
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            Registrar
          </button>
        </div>

        {loadingNutrition ? (
          <div className="mt-3 space-y-3" aria-busy="true" aria-label="Cargando nutrición">
            <div className="pv2-skeleton h-9 w-40" />
            <div className="pv2-skeleton h-1 w-full" />
            <div className="pv2-skeleton h-14 w-full" />
          </div>
        ) : nutrition ? (
          <>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="pv2-num text-[26px] font-medium leading-none" style={{ color: 'var(--text-primary)' }}>
                {formatNumber(nutrition.consumed)}
                <span className="ml-1 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                  / {formatNumber(nutrition.dailyGoal)} kcal
                </span>
              </p>
              <p className="text-sm" style={{ color: overGoal ? 'var(--status-danger)' : 'var(--text-muted)' }}>
                {overGoal
                  ? `${formatNumber(Math.abs(remaining))} kcal por encima`
                  : `${formatNumber(Math.max(0, remaining))} kcal restantes`}
              </p>
            </div>

            <ProgressBar
              className="mt-3"
              value={nutrition.consumed}
              max={nutrition.dailyGoal || 1}
              label="Calorías consumidas hoy"
              valueText={`${formatNumber(nutrition.consumed)} de ${formatNumber(nutrition.dailyGoal)} kilocalorías`}
              tone={overGoal ? 'danger' : 'accent'}
            />

            <ul className="mt-4 space-y-2.5" aria-label="Macronutrientes de hoy">
              {macroRows.map((macro) => (
                <li key={macro.key}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>{macro.label}</span>
                    <span className="pv2-mono" style={{ color: 'var(--text-secondary)' }}>
                      {formatNumber(macro.value)} g
                      {macro.goal ? <span style={{ color: 'var(--text-muted)' }}> / {formatNumber(macro.goal)} g</span> : null}
                    </span>
                  </div>
                  {macro.goal ? (
                    <ProgressBar
                      className="mt-1.5"
                      value={macro.value}
                      max={macro.goal}
                      label={`${macro.label} de hoy`}
                      valueText={`${formatNumber(macro.value)} de ${formatNumber(macro.goal)} gramos`}
                      fillColor={macro.color}
                    />
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <h4 className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Últimas comidas
              </h4>
              {nutrition.meals.length === 0 ? (
                <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Sin comidas registradas hoy.
                </p>
              ) : (
                <>
                  <ul className="mt-1 space-y-1">
                    {visibleMeals.map((meal) => (
                      <li key={meal.id}>
                        <button type="button" onClick={() => onEditMeal(meal)} className="pv2-row pv2-row--interactive -mx-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }} title={meal.name}>
                              {meal.name}
                            </span>
                            <span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                              {mealTypeLabel(meal.mealType)} · {formatNumber(meal.proteinG)} P · {formatNumber(meal.carbG)} C · {formatNumber(meal.fatG)} G
                            </span>
                          </span>
                          <span className="pv2-mono shrink-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {formatNumber(meal.calories)} kcal
                          </span>
                          <Pencil size={14} strokeWidth={1.5} className="hidden shrink-0 sm:block" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {hiddenMeals > 0 || showAllMeals ? (
                    <button
                      type="button"
                      onClick={() => setShowAllMeals((value) => !value)}
                      className="pv2-link mt-1 min-h-9 text-xs"
                      aria-expanded={showAllMeals}
                    >
                      {showAllMeals
                        ? 'Ver menos'
                        : `+${formatInteger(hiddenMeals)} ${hiddenMeals === 1 ? 'comida más' : 'comidas más'}`}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sin datos de nutrición para hoy.
            </p>
            <button type="button" onClick={onLogMeal} className="pv2-ghost mt-3 w-full">
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              Registrar comida
            </button>
          </div>
        )}
      </section>

      {/* Actividad */}
      <section className="mt-5 border-t pt-5" style={{ borderColor: 'var(--divider)' }} aria-labelledby="health-activity-heading">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 id="health-activity-heading" className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <Activity size={16} strokeWidth={1.5} aria-hidden="true" />
            Actividad
          </h3>
          <div className="flex flex-wrap items-center gap-1">
            {data.isStravaConnected ? (
              <button
                type="button"
                onClick={onSyncStrava}
                disabled={syncingStrava}
                className="pv2-link min-h-9 whitespace-nowrap text-xs disabled:opacity-60"
                aria-label="Sincronizar entrenamientos de Strava"
              >
                <RefreshCw size={14} strokeWidth={1.5} className={syncingStrava ? 'animate-spin' : ''} aria-hidden="true" />
                {syncingStrava ? 'Sincronizando' : 'Strava'}
              </button>
            ) : (
              <button type="button" onClick={onConnectStrava} className="pv2-link min-h-9 whitespace-nowrap text-xs">
                <Link2 size={14} strokeWidth={1.5} aria-hidden="true" />
                Conectar Strava
              </button>
            )}
            <button type="button" onClick={onLogWorkout} className="pv2-link min-h-9 whitespace-nowrap text-xs">
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Registrar
            </button>
          </div>
        </div>

        {stravaError ? (
          <p className="mt-2 text-sm" style={{ color: 'var(--status-danger)' }} role="status">
            {stravaError}
          </p>
        ) : null}

        {data.todayWorkoutMinutes !== null && data.todayWorkoutMinutes > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <CheckCircle2 size={15} strokeWidth={1.5} style={{ color: 'var(--status-success)' }} aria-hidden="true" />
            Hoy: {pluralize(data.todayWorkoutMinutes, 'minuto', 'minutos')} de actividad
          </p>
        ) : null}

        {data.workouts.length === 0 ? (
          <div className="mt-3">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sin entrenamientos recientes.
            </p>
            <button type="button" onClick={onLogWorkout} className="pv2-ghost mt-3 w-full">
              <Dumbbell size={16} strokeWidth={1.5} aria-hidden="true" />
              Registrar entrenamiento
            </button>
          </div>
        ) : (
          <ul className="mt-2 space-y-1">
            {visibleWorkouts.map((workout, index) => (              <li key={workout.id || `${workout.sport}-${index}`}>
                <button type="button" onClick={() => onEditWorkout(workout)} className="pv2-row pv2-row--interactive -mx-2">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'var(--surface-inset)', color: 'var(--accent-text)' }}
                    aria-hidden="true"
                  >
                    <Dumbbell size={18} strokeWidth={1.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                      title={workout.notes || workout.sport || 'Entrenamiento'}
                    >
                      {workout.notes || workout.sport || 'Entrenamiento'}
                    </span>
                    <span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                      {[workout.sport, workout.durationMin ? `${formatInteger(workout.durationMin)} min` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="pv2-mono shrink-0 text-right text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {workout.caloriesBurned ? `${formatInteger(workout.caloriesBurned)} kcal` : ''}
                    {workout.distanceKm && workout.distanceKm > 0 ? (
                      <span className="block" style={{ color: 'var(--text-muted)' }}>
                        {formatDecimal(workout.distanceKm)} km
                      </span>
                    ) : null}
                  </span>
                  <Pencil size={14} strokeWidth={1.5} className="hidden shrink-0 sm:block" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                </button>
              </li>
            ))}

            {hiddenWorkouts > 0 || showAllWorkouts ? (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAllWorkouts((value) => !value)}
                  className="pv2-link mt-1 min-h-9 text-xs"
                  aria-expanded={showAllWorkouts}
                >
                  {showAllWorkouts
                    ? 'Ver menos'
                    : `+${formatInteger(hiddenWorkouts)} ${hiddenWorkouts === 1 ? 'entrenamiento más' : 'entrenamientos más'}`}
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}

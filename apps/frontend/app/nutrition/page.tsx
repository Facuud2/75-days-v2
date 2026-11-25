'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Beef,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplet,
  SlidersHorizontal,
  Wheat,
  X,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { healthService, Meal, MealRoutineItem, MealRoutineMode } from '@/lib/api/health';
import { useHealthStore } from '@/store/useHealthStore';
import { useUIStore } from '@/store/useUIStore';
import { getLocalDateString } from '@/lib/utils/date';

import FoodPhotoGrid from '@/components/FoodPhotoGrid';
import CaloriesBurnedCard from '@/components/CaloriesBurnedCard';
import MealsPlanCard from '@/components/MealsPlanCard';
import FloatingActionButton from '@/components/FloatingActionButton';

const LogMealModal = dynamic(() => import('@/components/LogMealModal'), { ssr: false });
const EditMealModal = dynamic(() => import('@/components/EditMealModal'), { ssr: false });
const MealRoutineBuilderSheet = dynamic(
  () => import('@/components/nutrition/MealRoutineBuilderSheet'),
  { ssr: false }
);
const MealRecommendationsSheet = dynamic(
  () => import('@/components/nutrition/MealRecommendationsSheet'),
  { ssr: false }
);

type MealSlotId = 'breakfast' | 'lunch' | 'snack' | 'dinner';



function parseLocalDate(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function shiftDateString(yyyyMmDd: string, deltaDays: number): string {
  const shifted = addDays(parseLocalDate(yyyyMmDd), deltaDays);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayLabel(selectedDate: string, today: string): string {
  if (selectedDate === today) return 'Hoy';
  if (selectedDate === shiftDateString(today, -1)) return 'Ayer';
  return format(parseLocalDate(selectedDate), "EEE, d 'de' MMM", { locale: es });
}

function NutritionPageInner() {
  const searchParams = useSearchParams();
  const today = useMemo(() => getLocalDateString(), []);
  const queryDate = searchParams.get('date');

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate) ? queryDate : today
  );
  const [logModalSlot, setLogModalSlot] = useState<MealSlotId | undefined>(undefined);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [isRoutineBuilderOpen, setIsRoutineBuilderOpen] = useState(false);
  const [isAiRecommendationsOpen, setIsAiRecommendationsOpen] = useState(false);
  const [routineBuilderDraft, setRoutineBuilderDraft] = useState<{
    name: string;
    description: string;
    mode: MealRoutineMode;
    items: MealRoutineItem[];
  } | null>(null);

  // Inline Nutritional Goals Editor
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsDraft, setGoalsDraft] = useState({
    dailyCalorieGoal: '2000',
    proteinGoalG: '150',
    carbGoalG: '200',
    fatGoalG: '65',
  });

  const stats = useHealthStore((s) => s.dailyStatsByDate[selectedDate]);
  const isLoadingStats = useHealthStore((s) => s.isLoadingStats);
  const mealRoutines = useHealthStore((s) => s.mealRoutines);
  const fetchProfileBundle = useHealthStore((s) => s.fetchProfileBundle);
  const fetchMealRoutines = useHealthStore((s) => s.fetchMealRoutines);
  const logMealOptimistic = useHealthStore((s) => s.logMealOptimistic);
  const applyMealRoutineToDate = useHealthStore((s) => s.applyMealRoutineToDate);
  const openLogWorkoutModal = useUIStore((s) => s.openLogWorkoutModal);

  const refreshDateStats = useCallback(
    (dateToLoad: string) => {
      void fetchProfileBundle(dateToLoad, { skipCoreProfile: true });
    },
    [fetchProfileBundle]
  );

  useEffect(() => {
    refreshDateStats(selectedDate);
  }, [selectedDate, refreshDateStats]);

  useEffect(() => {
    void fetchMealRoutines();
  }, [fetchMealRoutines]);

  const consumed = Math.round(stats?.consumed ?? 0);
  const dailyGoal = Math.round(stats?.dailyGoal ?? 2000);
  const remaining = dailyGoal - consumed;
  const overGoal = dailyGoal > 0 && consumed > dailyGoal;
  const progressPct =
    dailyGoal > 0 ? Math.min(100, Math.round((consumed / dailyGoal) * 100)) : 0;

  const macros = stats?.macros ?? {
    proteinG: 0,
    carbG: 0,
    fatG: 0,
    fiberG: 0,
    sugarG: 0,
    goals: { proteinG: 150, carbG: 200, fatG: 65 },
  };

  const meals = useMemo(() => stats?.meals ?? [], [stats?.meals]);

  const burned = Math.round(stats?.burned ?? 0);
  const workoutsCount = stats?.workoutsCount ?? 0;
  // Meta alcanzada por quema: se muestra cuando hay actividad física registrada.
  const goalReached = workoutsCount > 0 ? burned : 0;
  // Pasos: el backend aún no expone este dato; se mantiene en 0 hasta integrarlo.
  const steps = 0;

  const mealsForPhotos = useMemo(() => meals.slice(0, 3), [meals]);

  const allMealsForPlan = useMemo(
    () =>
      meals.map((m) => ({
        id: m.id,
        name: m.name,
        calories: Math.round(m.calories),
        prepTimeMin: 5,
        mealType: m.mealType,
        photoUrl: m.photoUrl,
      })),
    [meals]
  );

  const activeRoutine = useMemo(
    () => mealRoutines.find((r) => r.isActive) ?? null,
    [mealRoutines]
  );

  const pendingPlannedItems = useMemo(() => {
    if (!activeRoutine) return [];
    const selectedDayIdx = (parseLocalDate(selectedDate).getDay() + 6) % 7;
    const loggedIds = new Set(
      meals.map((m) => m.routineItemId).filter((v): v is string => Boolean(v))
    );
    return activeRoutine.items.filter((item) => {
      const matchesDay =
        activeRoutine.mode === 'daily'
          ? item.dayOfWeek === null
          : item.dayOfWeek === selectedDayIdx;
      if (!matchesDay) return false;
      if (item.id && loggedIds.has(item.id)) return false;
      return true;
    });
  }, [activeRoutine, meals, selectedDate]);

  const handleLogPlannedItem = async (item: MealRoutineItem) => {
    try {
      await logMealOptimistic({
        date: selectedDate,
        mealType: item.mealType,
        name: item.name,
        calories: Math.max(1, Math.round(item.calories)),
        proteinG: item.proteinG,
        carbG: item.carbG,
        fatG: item.fatG,
        fiberG: item.fiberG ?? 0,
        sugarG: item.sugarG ?? 0,
        routineItemId: item.id ?? null,
      });
      toast.success(`"${item.name}" registrada`);
    } catch {
      toast.error('No se pudo registrar la comida');
    }
  };

  const handleApplyAllPlanned = async () => {
    if (!activeRoutine) return;
    try {
      const count = await applyMealRoutineToDate(activeRoutine.id, selectedDate);
      if (count > 0) {
        toast.success(`Se registraron ${count} comidas del plan`);
      }
    } catch {
      toast.error('No se pudo aplicar la rutina al día');
    }
  };

  const handleOpenGoalsEditor = () => {
    setGoalsDraft({
      dailyCalorieGoal: String(dailyGoal),
      proteinGoalG: String(Math.round(macros.goals?.proteinG ?? 150)),
      carbGoalG: String(Math.round(macros.goals?.carbG ?? 200)),
      fatGoalG: String(Math.round(macros.goals?.fatG ?? 65)),
    });
    setIsEditingGoals(true);
  };

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    const kcal = Math.max(500, Math.min(25000, Math.round(Number(goalsDraft.dailyCalorieGoal) || 2000)));
    const p = Math.max(10, Math.min(2000, Math.round(Number(goalsDraft.proteinGoalG) || 150)));
    const c = Math.max(10, Math.min(2000, Math.round(Number(goalsDraft.carbGoalG) || 200)));
    const f = Math.max(10, Math.min(2000, Math.round(Number(goalsDraft.fatGoalG) || 65)));

    setSavingGoals(true);
    try {
      await healthService.updateGoals({
        dailyCalorieGoal: kcal,
        proteinGoalG: p,
        carbGoalG: c,
        fatGoalG: f,
      });
      setIsEditingGoals(false);
      refreshDateStats(selectedDate);
      toast.success('Metas nutricionales actualizadas');
    } catch {
      toast.error('No se pudieron actualizar las metas.');
    } finally {
      setSavingGoals(false);
    }
  };

  const openLogForSlot = (slot?: MealSlotId) => {
    setLogModalSlot(slot);
    setIsLogModalOpen(true);
  };

  const isToday = selectedDate === today;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      {/* Top Header + Date Switcher */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent-text)]">
            Registro alimentario
          </p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--text-primary)]">
            Nutrición
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {!isToday ? (
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="min-h-9 cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--accent-text)] active:scale-95"
            >
              Ir a hoy
            </button>
          ) : null}

          <div className="flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0.5">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDateString(d, -1))}
              aria-label="Día anterior"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--text-secondary)] active:scale-95 hover:bg-[var(--surface-inset)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[84px] px-2 text-center text-[13px] font-semibold capitalize text-[var(--text-primary)]">
              {formatDayLabel(selectedDate, today)}
            </span>
            <button
              type="button"
              disabled={isToday}
              onClick={() => setSelectedDate((d) => shiftDateString(d, 1))}
              aria-label="Día siguiente"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--text-secondary)] active:scale-95 hover:bg-[var(--surface-inset)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Three Card Layout */}
      <div className="space-y-4">
        {/* Card 1: Calorías consumidas */}
        <section
          aria-label="Calorías consumidas"
          aria-busy={isLoadingStats && !stats}
          className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className={`tabular-nums transition-opacity ${isLoadingStats && !stats ? 'opacity-60' : ''}`}>
              <p className="text-[12px] font-medium text-[var(--text-muted)]">
                Calorías consumidas
              </p>
              <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-[28px] font-bold leading-none tracking-[-0.03em] text-[var(--text-primary)]">
                  {consumed}
                </span>
                <span className="text-[14px] font-medium text-[var(--text-muted)]">
                  / {dailyGoal} kcal
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums whitespace-nowrap ${
                  overGoal
                    ? 'bg-[var(--surface-raised)] text-[var(--status-warning)]'
                    : 'bg-[var(--surface-inset)] text-[var(--text-secondary)]'
                }`}
              >
                {overGoal
                  ? `+${Math.abs(remaining)} kcal`
                  : `${Math.max(0, remaining)} restantes`}
              </span>
              <button
                type="button"
                onClick={() =>
                  isEditingGoals ? setIsEditingGoals(false) : handleOpenGoalsEditor()
                }
                aria-label="Editar metas nutricionales"
                aria-expanded={isEditingGoals}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {isEditingGoals ? (
                  <X className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Calorie Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--progress-track)]">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${progressPct}%`,
                backgroundColor: overGoal ? 'var(--status-warning)' : 'var(--progress-fill)',
              }}
            />
          </div>

          {/* 3 Clean Macro Columns */}
          <div className="grid grid-cols-3 gap-2.5 pt-0.5 tabular-nums">
            {[
              {
                key: 'protein',
                label: 'Proteínas',
                val: Math.round(macros.proteinG * 10) / 10,
                goal: Math.round(macros.goals?.proteinG ?? 150),
                color: 'var(--chart-protein)',
                Icon: Beef as LucideIcon,
              },
              {
                key: 'carb',
                label: 'Carbos',
                val: Math.round(macros.carbG * 10) / 10,
                goal: Math.round(macros.goals?.carbG ?? 200),
                color: 'var(--chart-carb)',
                Icon: Wheat as LucideIcon,
              },
              {
                key: 'fat',
                label: 'Grasas',
                val: Math.round(macros.fatG * 10) / 10,
                goal: Math.round(macros.goals?.fatG ?? 65),
                color: 'var(--chart-fat)',
                Icon: Droplet as LucideIcon,
              },
            ].map((m) => {
              const pct = m.goal > 0 ? Math.min(100, Math.round((m.val / m.goal) * 100)) : 0;
              const MacroIcon = m.Icon;
              return (
                <div
                  key={m.key}
                  className="rounded-xl bg-[var(--surface-inset)] px-3 py-2"
                >
                  <div className="flex items-center gap-1">
                    <MacroIcon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: m.color }}
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: m.color }}
                    >
                      {m.label}
                    </span>
                  </div>
                  <span className="mt-0.5 block text-[13px] font-semibold text-[var(--text-primary)] whitespace-nowrap">
                    {m.val}
                    <span className="font-normal text-[var(--text-muted)]">
                      /{m.goal}g
                    </span>
                  </span>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--progress-track)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-200"
                      style={{ width: `${pct}%`, backgroundColor: m.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {(macros.fiberG ?? 0) > 0 || (macros.sugarG ?? 0) > 0 ? (
            <div className="flex items-center justify-end gap-3 text-[11px] text-[var(--text-muted)] tabular-nums">
              {(macros.fiberG ?? 0) > 0 ? (
                <span>Fibra {Math.round((macros.fiberG ?? 0) * 10) / 10}g</span>
              ) : null}
              {(macros.sugarG ?? 0) > 0 ? (
                <span>Azúcares {Math.round((macros.sugarG ?? 0) * 10) / 10}g</span>
              ) : null}
            </div>
          ) : null}

          {/* Food Photo Grid */}
          <div className="pt-1">
            <FoodPhotoGrid meals={mealsForPhotos} />
          </div>

          {/* Goal meta with quick toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-[var(--divider)]">
            <span className="text-[13px] font-medium text-[var(--text-secondary)] tabular-nums">
              Meta: {dailyGoal} kcal
            </span>
            <button
              type="button"
              onClick={() =>
                isEditingGoals ? setIsEditingGoals(false) : handleOpenGoalsEditor()
              }
              className="min-h-8 cursor-pointer rounded-lg px-2 text-xs font-semibold text-[var(--accent-text)] hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {isEditingGoals ? 'Cerrar' : 'Ajustar metas'}
            </button>
          </div>

          {/* Optional Inline Goals Editor */}
          {isEditingGoals ? (
            <form
              onSubmit={handleSaveGoals}
              className="space-y-2.5 border-t border-[var(--divider)] pt-3"
            >
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                Metas diarias personalizadas
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <label htmlFor="goal-kcal" className="mb-1 block text-[11px] text-[var(--text-muted)]">
                    Kcal / día
                  </label>
                  <input
                    id="goal-kcal"
                    type="number"
                    inputMode="numeric"
                    min="500"
                    max="25000"
                    value={goalsDraft.dailyCalorieGoal}
                    onChange={(e) =>
                      setGoalsDraft((d) => ({ ...d, dailyCalorieGoal: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="goal-protein" className="mb-1 block text-[11px] text-[var(--text-muted)]">
                    Proteínas (g)
                  </label>
                  <input
                    id="goal-protein"
                    type="number"
                    inputMode="numeric"
                    min="10"
                    max="2000"
                    value={goalsDraft.proteinGoalG}
                    onChange={(e) =>
                      setGoalsDraft((d) => ({ ...d, proteinGoalG: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="goal-carb" className="mb-1 block text-[11px] text-[var(--text-muted)]">
                    Carbos (g)
                  </label>
                  <input
                    id="goal-carb"
                    type="number"
                    inputMode="numeric"
                    min="10"
                    max="2000"
                    value={goalsDraft.carbGoalG}
                    onChange={(e) =>
                      setGoalsDraft((d) => ({ ...d, carbGoalG: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="goal-fat" className="mb-1 block text-[11px] text-[var(--text-muted)]">
                    Grasas (g)
                  </label>
                  <input
                    id="goal-fat"
                    type="number"
                    inputMode="numeric"
                    min="10"
                    max="2000"
                    value={goalsDraft.fatGoalG}
                    onChange={(e) =>
                      setGoalsDraft((d) => ({ ...d, fatGoalG: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingGoals}
                className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-fill)] text-[14px] font-semibold text-[var(--on-accent)] active:scale-[0.98] disabled:opacity-50"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Guardar metas
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => openLogForSlot(undefined)}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--accent-fill)] px-4 text-[15px] font-semibold text-[var(--on-accent)] transition-transform duration-100 active:scale-[0.98]"
            >
              <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
              Registrar comida
            </button>
          )}
        </section>

        {/* Card 2: Calorías por quemar */}
        <CaloriesBurnedCard
          caloriesBurned={burned}
          goalReached={goalReached}
          steps={steps}
          onPressAdd={openLogWorkoutModal}
        />

        {/* Card 3: Plan de comidas */}
        <div className="relative">
          <MealsPlanCard
            meals={allMealsForPlan}
            activeRoutine={activeRoutine}
            pendingPlannedItems={pendingPlannedItems}
            onLogPlannedItem={(item) => void handleLogPlannedItem(item)}
            onApplyAllPlanned={() => void handleApplyAllPlanned()}
            onOpenRoutineBuilder={() => {
              setRoutineBuilderDraft(null);
              setIsRoutineBuilderOpen(true);
            }}
            onOpenAiRecommendations={() => setIsAiRecommendationsOpen(true)}
            className="pb-16"
            onMealPress={(meal) => setEditingMeal(
              meals.find((m) => m.id === meal.id)!
            )}
          />
          {/* FAB */}
          <div className="absolute bottom-3 right-3">
            <FloatingActionButton
              onPress={() => openLogForSlot(undefined)}
              label="Agregar comida"
            />
          </div>
        </div>
      </div>

      {isRoutineBuilderOpen ? (
        <MealRoutineBuilderSheet
          isOpen={isRoutineBuilderOpen}
          onClose={() => {
            setIsRoutineBuilderOpen(false);
            setRoutineBuilderDraft(null);
          }}
          onOpenAiPlanner={() => setIsAiRecommendationsOpen(true)}
          initialDraft={routineBuilderDraft}
          goals={{
            dailyCalorieGoal: dailyGoal,
            proteinGoalG: macros.goals?.proteinG ?? 150,
            carbGoalG: macros.goals?.carbG ?? 200,
            fatGoalG: macros.goals?.fatG ?? 65,
          }}
        />
      ) : null}

      {isAiRecommendationsOpen ? (
        <MealRecommendationsSheet
          isOpen={isAiRecommendationsOpen}
          onClose={() => setIsAiRecommendationsOpen(false)}
          selectedDate={selectedDate}
          consumedToday={{
            calories: consumed,
            proteinG: macros.proteinG,
            carbG: macros.carbG,
            fatG: macros.fatG,
          }}
          goals={{
            dailyCalorieGoal: dailyGoal,
            proteinGoalG: macros.goals?.proteinG ?? 150,
            carbGoalG: macros.goals?.carbG ?? 200,
            fatGoalG: macros.goals?.fatG ?? 65,
          }}
          onEditDraftInBuilder={(draft) => {
            setRoutineBuilderDraft(draft);
            setIsRoutineBuilderOpen(true);
          }}
        />
      ) : null}

      {isLogModalOpen ? (
        <LogMealModal
          isOpen={isLogModalOpen}
          date={selectedDate}
          initialMealType={logModalSlot}
          onClose={() => setIsLogModalOpen(false)}
          onSaved={() => refreshDateStats(selectedDate)}
        />
      ) : null}

      {editingMeal ? (
        <EditMealModal
          isOpen={Boolean(editingMeal)}
          meal={editingMeal}
          date={selectedDate}
          onClose={() => setEditingMeal(null)}
          onSaved={() => refreshDateStats(selectedDate)}
        />
      ) : null}
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-3xl py-8" aria-busy="true" />}>
      <NutritionPageInner />
    </Suspense>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  CustomFood,
  MealRoutine,
  MealRoutineItem,
  MealRoutineMode,
} from '@/lib/api/health';
import { useHealthStore } from '@/store/useHealthStore';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
const DAY_FULL_LABELS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

const MEAL_SLOTS: Array<{ id: MealRoutineItem['mealType']; label: string }> = [
  { id: 'breakfast', label: 'Desayuno' },
  { id: 'lunch', label: 'Almuerzo' },
  { id: 'snack', label: 'Merienda / Snack' },
  { id: 'dinner', label: 'Cena' },
];

const NAME_SUGGESTIONS = [
  'Semana Definición',
  'Volumen Limpio',
  'Mantenimiento',
  'Alto en Proteína',
];

type BuilderStep = 1 | 2 | 3;

interface MealRoutineBuilderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAiPlanner?: () => void;
  initialDraft?: {
    name: string;
    description?: string | null;
    mode: MealRoutineMode;
    items: MealRoutineItem[];
  } | null;
  goals: {
    dailyCalorieGoal: number;
    proteinGoalG: number;
    carbGoalG: number;
    fatGoalG: number;
  };
}

export default function MealRoutineBuilderSheet(
  props: MealRoutineBuilderSheetProps
) {
  if (!props.isOpen) return null;
  const formKey = props.initialDraft
    ? `draft-${props.initialDraft.name}-${props.initialDraft.items.length}`
    : 'editor';
  return <MealRoutineBuilderContent key={formKey} {...props} />;
}

function MealRoutineBuilderContent({
  onClose,
  onOpenAiPlanner,
  initialDraft,
  goals,
}: MealRoutineBuilderSheetProps) {
  const reduceMotion = useReducedMotion();
  const mealRoutines = useHealthStore((s) => s.mealRoutines);
  const customFoods = useHealthStore((s) => s.customFoods);
  const fetchMealRoutines = useHealthStore((s) => s.fetchMealRoutines);
  const createMealRoutine = useHealthStore((s) => s.createMealRoutine);
  const updateMealRoutine = useHealthStore((s) => s.updateMealRoutine);
  const deleteMealRoutine = useHealthStore((s) => s.deleteMealRoutine);
  const setActiveMealRoutine = useHealthStore((s) => s.setActiveMealRoutine);

  const initialRoutine = initialDraft
    ? null
    : (mealRoutines.find((r) => r.isActive) ?? mealRoutines[0] ?? null);

  const [step, setStep] = useState<BuilderStep>(initialDraft ? 3 : 1);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);

  const [editingId, setEditingId] = useState<string | null>(
    initialDraft ? null : (initialRoutine?.id ?? null)
  );
  const [name, setName] = useState(
    initialDraft ? initialDraft.name : (initialRoutine?.name ?? '')
  );
  const [description, setDescription] = useState(
    initialDraft
      ? (initialDraft.description ?? '')
      : (initialRoutine?.description ?? '')
  );
  const [mode, setMode] = useState<MealRoutineMode>(
    initialDraft ? initialDraft.mode : (initialRoutine?.mode ?? 'weekly')
  );
  const [isActive, setIsActive] = useState(
    initialDraft ? true : (initialRoutine?.isActive ?? true)
  );
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [items, setItems] = useState<MealRoutineItem[]>(
    initialDraft
      ? initialDraft.items.map((it) => ({ ...it }))
      : (initialRoutine?.items.map((it) => ({ ...it })) ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Copy day popover state
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  // Inline add meal form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMealType, setNewMealType] =
    useState<MealRoutineItem['mealType']>('breakfast');
  const [newName, setNewName] = useState('');
  const [newCalories, setNewCalories] = useState('');
  const [newProtein, setNewProtein] = useState('');
  const [newCarb, setNewCarb] = useState('');
  const [newFat, setNewFat] = useState('');
  const [newPrepMin, setNewPrepMin] = useState('5');
  const [foodQuery, setFoodQuery] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  const goToStep = (next: BuilderStep) => {
    if (next === step) return;
    setStepDirection(next > step ? 1 : -1);
    setStep(next);
    setShowAddForm(false);
    setCopyOpen(false);
    setConfirmDelete(false);
  };

  const loadRoutineIntoEditor = (routine: MealRoutine) => {
    setEditingId(routine.id);
    setName(routine.name);
    setDescription(routine.description ?? '');
    setMode(routine.mode);
    setIsActive(routine.isActive);
    setItems(routine.items.map((it) => ({ ...it })));
    setSelectedDay(0);
    setShowAddForm(false);
    setConfirmDelete(false);
  };

  const startNewRoutine = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setMode('weekly');
    setIsActive(true);
    setItems([]);
    setSelectedDay(0);
    setShowAddForm(false);
    setConfirmDelete(false);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  useEffect(() => {
    let cancelled = false;
    void fetchMealRoutines().then(() => {
      if (cancelled || initialDraft || initialRoutine) return;
      const latest = useHealthStore.getState().mealRoutines;
      const active = latest.find((r) => r.isActive) ?? latest[0];
      if (active) {
        loadRoutineIntoEditor(active);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleItems = useMemo(() => {
    if (mode === 'daily') return items;
    return items.filter((it) => it.dayOfWeek === selectedDay);
  }, [items, mode, selectedDay]);

  const dayTotals = useMemo(() => {
    return visibleItems.reduce(
      (acc, it) => ({
        calories: acc.calories + (it.calories || 0),
        proteinG: acc.proteinG + (it.proteinG || 0),
        carbG: acc.carbG + (it.carbG || 0),
        fatG: acc.fatG + (it.fatG || 0),
      }),
      { calories: 0, proteinG: 0, carbG: 0, fatG: 0 }
    );
  }, [visibleItems]);

  const estimatedKcal = useMemo(() => {
    const p = Math.max(0, Number(newProtein) || 0);
    const c = Math.max(0, Number(newCarb) || 0);
    const f = Math.max(0, Number(newFat) || 0);
    return Math.round(p * 4 + c * 4 + f * 9);
  }, [newProtein, newCarb, newFat]);

  const filteredCustomFoods = useMemo(() => {
    const q = foodQuery.trim().toLowerCase();
    if (!q) return customFoods.slice(0, 8);
    return customFoods
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [customFoods, foodQuery]);

  const openAddForSlot = (slot: MealRoutineItem['mealType']) => {
    setNewMealType(slot);
    setNewName('');
    setNewCalories('');
    setNewProtein('');
    setNewCarb('');
    setNewFat('');
    setNewPrepMin('5');
    setFoodQuery('');
    setShowAddForm(true);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Escribí el nombre de la comida');
      return;
    }
    const resolvedKcal =
      newCalories.trim() !== ''
        ? Math.max(0, Number(newCalories) || 0)
        : estimatedKcal;

    const item: MealRoutineItem = {
      dayOfWeek: mode === 'daily' ? null : selectedDay,
      mealType: newMealType,
      name: newName.trim(),
      calories: resolvedKcal,
      proteinG: Math.max(0, Number(newProtein) || 0),
      carbG: Math.max(0, Number(newCarb) || 0),
      fatG: Math.max(0, Number(newFat) || 0),
      prepTimeMin: Math.max(1, Number(newPrepMin) || 5),
      order: items.length,
    };
    setItems((prev) => [...prev, item]);
    setShowAddForm(false);
    toast.success(`"${item.name}" agregada`);
  };

  const handleAddCustomFood = (food: CustomFood) => {
    const item: MealRoutineItem = {
      dayOfWeek: mode === 'daily' ? null : selectedDay,
      mealType: newMealType,
      name: food.name,
      calories: Math.round(food.calories),
      proteinG: Math.round(food.proteinG * 10) / 10,
      carbG: Math.round(food.carbG * 10) / 10,
      fatG: Math.round(food.fatG * 10) / 10,
      prepTimeMin: 5,
      customFoodId: food.id,
      order: items.length,
    };
    setItems((prev) => [...prev, item]);
    setShowAddForm(false);
    toast.success(`"${food.name}" agregado`);
  };

  const handleRemoveItem = (targetItem: MealRoutineItem) => {
    const idx = items.indexOf(targetItem);
    if (idx === -1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyCopyToDays = (targets: number[], sourceDay = selectedDay) => {
    if (targets.length === 0) return;
    const sourceItems = items.filter((it) => it.dayOfWeek === sourceDay);
    if (sourceItems.length === 0) {
      toast.error(`${DAY_LABELS[sourceDay]} no tiene comidas para copiar`);
      return;
    }
    setItems((prev) => {
      const targetSet = new Set(targets);
      const kept = prev.filter(
        (it) => it.dayOfWeek === null || !targetSet.has(it.dayOfWeek)
      );
      const duplicated: MealRoutineItem[] = [];
      for (const targetDay of targets) {
        sourceItems.forEach((src, idx) => {
          duplicated.push({
            ...src,
            id: undefined,
            dayOfWeek: targetDay,
            order: idx,
          });
        });
      }
      return [...kept, ...duplicated];
    });
    toast.success(
      `${DAY_LABELS[sourceDay]} copiado a ${targets.length} ${targets.length === 1 ? 'día' : 'días'}`
    );
    setCopyOpen(false);
    setCopyTargets([]);
  };

  const handleNextFromStep1 = () => {
    if (!name.trim()) {
      toast.error('Poné un nombre para tu rutina');
      nameInputRef.current?.focus();
      return;
    }
    goToStep(2);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Poné un nombre para tu rutina');
      goToStep(1);
      return;
    }
    setSaving(true);
    try {
      const normalizedItems: MealRoutineItem[] = items.map((it, idx) => ({
        dayOfWeek: mode === 'daily' ? null : (it.dayOfWeek ?? 0),
        mealType: it.mealType,
        name: it.name,
        calories: Math.max(0, Number(it.calories) || 0),
        proteinG: Math.max(0, Number(it.proteinG) || 0),
        carbG: Math.max(0, Number(it.carbG) || 0),
        fatG: Math.max(0, Number(it.fatG) || 0),
        fiberG: it.fiberG ?? 0,
        sugarG: it.sugarG ?? 0,
        prepTimeMin: it.prepTimeMin ?? 5,
        customFoodId: it.customFoodId ?? null,
        notes: it.notes ?? null,
        order: idx,
      }));

      if (editingId) {
        await updateMealRoutine(editingId, {
          name: name.trim(),
          description: description.trim() || null,
          mode,
          isActive,
          items: normalizedItems,
        });
        toast.success('Rutina actualizada');
      } else {
        await createMealRoutine({
          name: name.trim(),
          description: description.trim() || null,
          mode,
          isActive,
          items: normalizedItems,
        });
        toast.success('Rutina creada');
      }
      onClose();
    } catch {
      toast.error('No se pudo guardar la rutina');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMealRoutine(id);
      toast.success('Rutina eliminada');
      startNewRoutine();
      goToStep(1);
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  const weeklySummary = useMemo(() => {
    return DAY_LABELS.map((label, dayIdx) => {
      const dayItems = items.filter((it) => it.dayOfWeek === dayIdx);
      const kcal = dayItems.reduce((sum, it) => sum + (it.calories || 0), 0);
      return {
        dayIdx,
        label,
        fullLabel: DAY_FULL_LABELS[dayIdx],
        count: dayItems.length,
        kcal: Math.round(kcal),
      };
    });
  }, [items]);

  const firstNonEmptyDay = useMemo(
    () => weeklySummary.find((d) => d.count > 0)?.dayIdx ?? null,
    [weeklySummary]
  );

  const emptyDays = useMemo(
    () => weeklySummary.filter((d) => d.count === 0).map((d) => d.dayIdx),
    [weeklySummary]
  );

  const stepMeta: Record<
    BuilderStep,
    { badge: string; title: string; subtitle: string }
  > = {
    1: {
      badge: 'Paso 1 de 3 · Configuración',
      title: editingId ? 'Configurá tu rutina' : 'Nueva rutina de comidas',
      subtitle: 'Elegí un nombre y si el menú se repite o cambia por día',
    },
    2: {
      badge: 'Paso 2 de 3 · Comidas',
      title: name.trim() || 'Armá tus comidas',
      subtitle:
        mode === 'daily'
          ? 'Agregá lo que comés en un día típico'
          : `Planificando ${DAY_FULL_LABELS[selectedDay]}`,
    },
    3: {
      badge: 'Paso 3 de 3 · Revisión',
      title: 'Revisá y guardá',
      subtitle: 'Confirmá tu plan para registrarlo en 1 toque desde Nutrición',
    },
  };

  const currentMeta = stepMeta[step];
  const stepTransition = reduceMotion
    ? { duration: 0.12 }
    : { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

  const kcalProgressPct = Math.min(
    100,
    goals.dailyCalorieGoal > 0
      ? Math.round((dayTotals.calories / goals.dailyCalorieGoal) * 100)
      : 0
  );

  return (
    <div
      className="mobile-sheet-root fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Configurar rutina de comidas"
    >
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] sm:rounded-[24px]">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <div className="h-1 w-9 rounded-full bg-[var(--border-subtle)]" />
        </div>

        {/* Header */}
        <div className="space-y-1.5 border-b border-[var(--divider)] px-5 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--accent-text)]">
                {currentMeta.badge}
              </span>
              <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
                {([1, 2, 3] as const).map((s) => (
                  <span
                    key={s}
                    className={`h-1 w-4 rounded-full transition-colors duration-200 ${
                      s <= step
                        ? 'bg-[var(--accent-fill)]'
                        : 'bg-[var(--surface-inset)]'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {onOpenAiPlanner ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAiPlanner();
                  }}
                  className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--surface-inset)] px-2.5 text-xs font-semibold text-[var(--accent-text)] hover:opacity-90"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>IA</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-secondary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <h2 className="truncate text-[18px] font-bold text-[var(--text-primary)]">
              {currentMeta.title}
            </h2>
            <p className="text-[12px] text-[var(--text-muted)]">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">
          <AnimatePresence mode="wait" initial={false}>
            {/* STEP 1: CONFIG */}
            {step === 1 ? (
              <motion.div
                key="step-1"
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: stepDirection * 24 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -24 }
                }
                transition={stepTransition}
                className="space-y-5"
              >
                {/* Saved routines */}
                {mealRoutines.length > 0 && !initialDraft ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        Tus rutinas guardadas
                      </span>
                      <button
                        type="button"
                        onClick={startNewRoutine}
                        className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[var(--accent-text)]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Nueva rutina
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {mealRoutines.map((r) => {
                        const selected = editingId === r.id;
                        return (
                          <div
                            key={r.id}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              selected
                                ? 'border-[var(--accent-fill)] bg-[var(--accent-fill)]/15 text-[var(--accent-text)]'
                                : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => loadRoutineIntoEditor(r)}
                              className="cursor-pointer"
                            >
                              {r.name}{' '}
                              <span className="opacity-70">
                                ({r.mode === 'daily' ? 'Diaria' : 'Semanal'})
                              </span>
                            </button>
                            {r.isActive ? (
                              <span className="rounded-full bg-[var(--accent-fill)] px-1.5 py-0.5 text-[10px] text-[var(--on-accent)]">
                                Activa
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void setActiveMealRoutine(r.id)}
                                title="Activar esta rutina"
                                className="cursor-pointer text-[10px] underline opacity-75 hover:opacity-100"
                              >
                                Activar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Routine Name */}
                <div className="space-y-2">
                  <label
                    htmlFor="meal-routine-name"
                    className="block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Nombre de la rutina
                  </label>
                  <input
                    id="meal-routine-name"
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Semana Definición"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {NAME_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setName(suggestion)}
                        className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          name === suggestion
                            ? 'border-[var(--accent-fill)] bg-[var(--accent-fill)]/15 text-[var(--accent-text)]'
                            : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frequency Mode Cards */}
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-[var(--text-secondary)]">
                    ¿Cómo querés organizarla?
                  </span>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setMode('daily')}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                        mode === 'daily'
                          ? 'border-[var(--accent-fill)] bg-[var(--accent-fill)]/10'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 hover:bg-[var(--surface-inset)]'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          mode === 'daily'
                            ? 'bg-[var(--accent-fill)] text-[var(--on-accent)]'
                            : 'bg-[var(--surface-card)] text-[var(--text-muted)]'
                        }`}
                      >
                        <Repeat className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Diaria
                        </p>
                        <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                          Mismo menú todos los días. Más rápido de armar.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('weekly')}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                        mode === 'weekly'
                          ? 'border-[var(--accent-fill)] bg-[var(--accent-fill)]/10'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 hover:bg-[var(--surface-inset)]'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          mode === 'weekly'
                            ? 'bg-[var(--accent-fill)] text-[var(--on-accent)]'
                            : 'bg-[var(--surface-card)] text-[var(--text-muted)]'
                        }`}
                      >
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Semanal (Lun–Dom)
                        </p>
                        <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                          Menú distinto por día. Podés copiar días en 1 toque.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Active toggle */}
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Usar como rutina activa en Nutrición
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Te aparece lista para registrar cada comida en 1 toque
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded accent-[var(--accent-fill)]"
                  />
                </label>
              </motion.div>
            ) : null}

            {/* STEP 2: MEALS */}
            {step === 2 ? (
              <motion.div
                key="step-2"
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: stepDirection * 24 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -24 }
                }
                transition={stepTransition}
                className="space-y-4"
              >
                {/* Weekly Day Selector */}
                {mode === 'weekly' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1">
                        {DAY_LABELS.map((label, idx) => {
                          const count = items.filter(
                            (it) => it.dayOfWeek === idx
                          ).length;
                          const active = selectedDay === idx;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => {
                                setSelectedDay(idx);
                                setShowAddForm(false);
                              }}
                              className={`flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-xl px-3 text-xs font-semibold transition-colors ${
                                active
                                  ? 'bg-[var(--accent-fill)] text-[var(--on-accent)]'
                                  : 'bg-[var(--surface-inset)] text-[var(--text-secondary)]'
                              }`}
                            >
                              <span>{label}</span>
                              {count > 0 ? (
                                <span
                                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                                    active
                                      ? 'bg-black/20 text-white'
                                      : 'bg-[var(--surface-card)] text-[var(--text-muted)]'
                                  }`}
                                >
                                  {count}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      {visibleItems.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCopyTargets([]);
                            setCopyOpen((v) => !v);
                          }}
                          className="flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-[var(--surface-inset)] px-2.5 text-xs font-semibold text-[var(--accent-text)] hover:opacity-90"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar</span>
                        </button>
                      ) : null}
                    </div>

                    {copyOpen ? (
                      <div className="space-y-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[var(--text-primary)]">
                            Copiar {DAY_FULL_LABELS[selectedDay]} a:
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setCopyTargets(
                                  [0, 1, 2, 3, 4].filter((d) => d !== selectedDay)
                                )
                              }
                              className="cursor-pointer rounded-lg bg-[var(--surface-card)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]"
                            >
                              Lun–Vie
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCopyTargets(
                                  [0, 1, 2, 3, 4, 5, 6].filter(
                                    (d) => d !== selectedDay
                                  )
                                )
                              }
                              className="cursor-pointer rounded-lg bg-[var(--surface-card)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]"
                            >
                              Toda la semana
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DAY_LABELS.map((label, idx) => {
                            if (idx === selectedDay) return null;
                            const checked = copyTargets.includes(idx);
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() =>
                                  setCopyTargets((prev) =>
                                    checked
                                      ? prev.filter((d) => d !== idx)
                                      : [...prev, idx]
                                  )
                                }
                                className={`min-h-8 cursor-pointer rounded-lg px-2.5 text-xs font-semibold ${
                                  checked
                                    ? 'bg-[var(--accent-fill)] text-[var(--on-accent)]'
                                    : 'bg-[var(--surface-card)] text-[var(--text-secondary)]'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setCopyOpen(false)}
                            className="cursor-pointer px-2 py-1 text-xs text-[var(--text-muted)]"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={copyTargets.length === 0}
                            onClick={() => applyCopyToDays(copyTargets)}
                            className="cursor-pointer rounded-lg bg-[var(--accent-fill)] px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-40"
                          >
                            Aplicar copia
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Day Macro Progress Card */}
                <div className="space-y-2 rounded-2xl bg-[var(--surface-inset)] p-3.5 text-xs tabular-nums">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {mode === 'daily'
                        ? 'Total diario'
                        : `Total ${DAY_LABELS[selectedDay]}`}
                      : {Math.round(dayTotals.calories)} / {goals.dailyCalorieGoal}{' '}
                      kcal
                    </span>
                    <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                      <span>
                        P {Math.round(dayTotals.proteinG)}/{Math.round(goals.proteinGoalG)}g
                      </span>
                      <span>
                        C {Math.round(dayTotals.carbG)}/{Math.round(goals.carbGoalG)}g
                      </span>
                      <span>
                        G {Math.round(dayTotals.fatG)}/{Math.round(goals.fatGoalG)}g
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-card)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-fill)] transition-all duration-300"
                      style={{ width: `${kcalProgressPct}%` }}
                    />
                  </div>
                </div>

                {/* Inline Add Form OR Slot-by-Slot Meal Builder */}
                {showAddForm ? (
                  <form
                    onSubmit={handleAddItem}
                    className="space-y-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent-text)]">
                        Agregar comida
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Cerrar
                      </button>
                    </div>

                    {/* Slot pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {MEAL_SLOTS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setNewMealType(s.id)}
                          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                            newMealType === s.id
                              ? 'bg-[var(--accent-fill)] text-[var(--on-accent)]'
                              : 'bg-[var(--surface-card)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {/* Quick pick from customFoods */}
                    {customFoods.length > 0 ? (
                      <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                            1 toque desde tus recetas
                          </span>
                          {customFoods.length > 5 ? (
                            <div className="relative flex-1 max-w-[160px]">
                              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
                              <input
                                type="text"
                                value={foodQuery}
                                onChange={(e) => setFoodQuery(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] py-1 pl-6 pr-2 text-[11px] text-[var(--text-primary)] focus:outline-none"
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {filteredCustomFoods.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => handleAddCustomFood(f)}
                              className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent-fill)] hover:text-[var(--text-primary)]"
                            >
                              + {f.name} ({Math.round(f.calories)} kcal)
                            </button>
                          ))}
                          {filteredCustomFoods.length === 0 ? (
                            <span className="text-[11px] text-[var(--text-muted)]">
                              Sin coincidencias
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {/* Manual fields */}
                    <div className="space-y-2.5">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                          Nombre de la comida
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Ej: Yogur griego con whey y frutos rojos"
                          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                            Prot (g)
                          </label>
                          <input
                            type="number"
                            min="0"
                            inputMode="decimal"
                            placeholder="0"
                            value={newProtein}
                            onChange={(e) => setNewProtein(e.target.value)}
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                            Carb (g)
                          </label>
                          <input
                            type="number"
                            min="0"
                            inputMode="decimal"
                            placeholder="0"
                            value={newCarb}
                            onChange={(e) => setNewCarb(e.target.value)}
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                            Gras (g)
                          </label>
                          <input
                            type="number"
                            min="0"
                            inputMode="decimal"
                            placeholder="0"
                            value={newFat}
                            onChange={(e) => setNewFat(e.target.value)}
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                            Kcal {estimatedKcal > 0 && !newCalories ? '(auto)' : ''}
                          </label>
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder={
                              estimatedKcal > 0 ? String(estimatedKcal) : '0'
                            }
                            value={newCalories}
                            onChange={(e) => setNewCalories(e.target.value)}
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
                            <Clock className="h-3 w-3" />
                            Min
                          </label>
                          <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            placeholder="5"
                            value={newPrepMin}
                            onChange={(e) => setNewPrepMin(e.target.value)}
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="cursor-pointer rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-muted)]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="cursor-pointer rounded-xl bg-[var(--accent-fill)] px-4 py-2 text-xs font-semibold text-[var(--on-accent)]"
                      >
                        Agregar a{' '}
                        {MEAL_SLOTS.find((s) => s.id === newMealType)?.label}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2.5">
                    {MEAL_SLOTS.map((slot) => {
                      const slotItems = visibleItems.filter(
                        (it) => it.mealType === slot.id
                      );
                      const slotKcal = slotItems.reduce(
                        (sum, it) => sum + (it.calories || 0),
                        0
                      );

                      return (
                        <div
                          key={slot.id}
                          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]/40 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[var(--text-primary)]">
                                {slot.label}
                              </span>
                              {slotItems.length > 0 ? (
                                <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                                  · {Math.round(slotKcal)} kcal
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => openAddForSlot(slot.id)}
                              className="flex min-h-8 cursor-pointer items-center gap-1 rounded-full bg-[var(--surface-card)] px-2.5 text-[11px] font-semibold text-[var(--accent-text)] hover:opacity-90"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Agregar
                            </button>
                          </div>

                          {slotItems.length > 0 ? (
                            <div className="mt-2.5 space-y-1.5">
                              {slotItems.map((it, idx) => (
                                <div
                                  key={`${it.name}-${idx}`}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                      {it.name}
                                    </p>
                                    <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                                      {Math.round(it.calories)} kcal · P{' '}
                                      {Math.round(it.proteinG)}g · C{' '}
                                      {Math.round(it.carbG)}g · G{' '}
                                      {Math.round(it.fatG)}g
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(it)}
                                    aria-label={`Quitar ${it.name}`}
                                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-inset)] hover:text-red-500"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ) : null}

            {/* STEP 3: REVIEW & SAVE */}
            {step === 3 ? (
              <motion.div
                key="step-3"
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: stepDirection * 24 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -24 }
                }
                transition={stepTransition}
                className="space-y-4"
              >
                {/* Summary Header Card */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]/70 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      {name.trim() || 'Sin nombre'}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-[var(--surface-card)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {mode === 'daily' ? 'Diaria' : 'Semanal'}
                      </span>
                      {isActive ? (
                        <span className="rounded-full bg-[var(--accent-fill)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--on-accent)]">
                          Activa
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {items.length}{' '}
                    {items.length === 1
                      ? 'comida planificada'
                      : 'comidas planificadas'}
                    {mode === 'weekly'
                      ? ` · ${7 - emptyDays.length} de 7 días con comidas`
                      : ''}
                  </p>
                </div>

                {/* Daily vs Weekly Breakdown */}
                {mode === 'daily' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-[var(--surface-inset)] px-3.5 py-2.5 text-xs tabular-nums">
                      <span className="font-semibold text-[var(--text-primary)]">
                        Total diario: {Math.round(dayTotals.calories)} /{' '}
                        {goals.dailyCalorieGoal} kcal
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        P {Math.round(dayTotals.proteinG)}g · C{' '}
                        {Math.round(dayTotals.carbG)}g · G{' '}
                        {Math.round(dayTotals.fatG)}g
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-5 text-center space-y-2">
                        <p className="text-xs text-[var(--text-muted)]">
                          Todavía no agregaste comidas a esta rutina.
                        </p>
                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          className="cursor-pointer text-xs font-semibold text-[var(--accent-text)] underline"
                        >
                          Agregar comidas ahora
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map((it, idx) => {
                          const slotLabel =
                            MEAL_SLOTS.find((s) => s.id === it.mealType)
                              ?.label ?? it.mealType;
                          return (
                            <div
                              key={`${it.name}-${idx}`}
                              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]/40 px-3 py-2 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-[var(--accent-text)]">
                                  {slotLabel}:{' '}
                                </span>
                                <span className="font-medium text-[var(--text-primary)]">
                                  {it.name}
                                </span>
                              </div>
                              <span className="shrink-0 text-[var(--text-muted)] tabular-nums">
                                {Math.round(it.calories)} kcal
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {firstNonEmptyDay !== null && emptyDays.length > 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-fill)]/10 px-3.5 py-2.5">
                        <p className="text-xs text-[var(--text-primary)]">
                          Tenés {emptyDays.length}{' '}
                          {emptyDays.length === 1 ? 'día vacío' : 'días vacíos'}.
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            applyCopyToDays(emptyDays, firstNonEmptyDay)
                          }
                          className="flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--accent-fill)] px-2.5 py-1 text-[11px] font-semibold text-[var(--on-accent)]"
                        >
                          <Copy className="h-3 w-3" />
                          Rellenar con {DAY_LABELS[firstNonEmptyDay]}
                        </button>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      {weeklySummary.map((day) => (
                        <button
                          key={day.dayIdx}
                          type="button"
                          onClick={() => {
                            setSelectedDay(day.dayIdx);
                            goToStep(2);
                          }}
                          className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]/40 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-inset)]"
                        >
                          <div>
                            <p className="text-xs font-semibold text-[var(--text-primary)]">
                              {day.fullLabel}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              {day.count === 0
                                ? 'Sin comidas — tocá para agregar'
                                : `${day.count} ${day.count === 1 ? 'comida' : 'comidas'}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {day.count > 0 ? (
                              <span className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
                                {day.kcal} kcal
                              </span>
                            ) : null}
                            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delete existing routine (2-step inline) */}
                {editingId ? (
                  <div className="pt-2">
                    {confirmDelete ? (
                      <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5">
                        <span className="text-xs font-medium text-red-400">
                          ¿Eliminar esta rutina?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="cursor-pointer px-2 py-1 text-xs text-[var(--text-secondary)]"
                          >
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(editingId)}
                            className="cursor-pointer rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white"
                          >
                            Sí, eliminar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="cursor-pointer text-xs font-semibold text-red-500 hover:underline"
                      >
                        Eliminar rutina
                      </button>
                    )}
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--divider)] px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          {step === 1 ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 cursor-pointer rounded-xl px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-inset)]"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goToStep((step - 1) as BuilderStep)}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-inset)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={handleNextFromStep1}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-4 text-xs font-semibold text-[var(--on-accent)]"
            >
              Siguiente: Comidas
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}

          {step === 2 ? (
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-4 text-xs font-semibold text-[var(--on-accent)]"
            >
              Revisar ({items.length})
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}

          {step === 3 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-4 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar rutina'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

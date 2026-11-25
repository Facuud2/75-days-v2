'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Plus,
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
const MEAL_SLOTS: Array<{ id: MealRoutineItem['mealType']; label: string }> = [
  { id: 'breakfast', label: 'Desayuno' },
  { id: 'lunch', label: 'Almuerzo' },
  { id: 'snack', label: 'Merienda / Snack' },
  { id: 'dinner', label: 'Cena' },
];

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

  // Copy day popover state
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  // Inline add meal form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMealType, setNewMealType] = useState<MealRoutineItem['mealType']>('snack');
  const [newName, setNewName] = useState('');
  const [newCalories, setNewCalories] = useState('');
  const [newProtein, setNewProtein] = useState('');
  const [newCarb, setNewCarb] = useState('');
  const [newFat, setNewFat] = useState('');
  const [newPrepMin, setNewPrepMin] = useState('5');

  const loadRoutineIntoEditor = (routine: MealRoutine) => {
    setEditingId(routine.id);
    setName(routine.name);
    setDescription(routine.description ?? '');
    setMode(routine.mode);
    setIsActive(routine.isActive);
    setItems(routine.items.map((it) => ({ ...it })));
    setSelectedDay(0);
    setShowAddForm(false);
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

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const item: MealRoutineItem = {
      dayOfWeek: mode === 'daily' ? null : selectedDay,
      mealType: newMealType,
      name: newName.trim(),
      calories: Math.max(0, Number(newCalories) || 0),
      proteinG: Math.max(0, Number(newProtein) || 0),
      carbG: Math.max(0, Number(newCarb) || 0),
      fatG: Math.max(0, Number(newFat) || 0),
      prepTimeMin: Math.max(1, Number(newPrepMin) || 5),
      order: items.length,
    };
    setItems((prev) => [...prev, item]);
    setNewName('');
    setNewCalories('');
    setNewProtein('');
    setNewCarb('');
    setNewFat('');
    setShowAddForm(false);
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
    toast.success(`"${food.name}" agregado`);
  };

  const handleRemoveItem = (targetItem: MealRoutineItem, indexInVisible: number) => {
    let seen = -1;
    setItems((prev) =>
      prev.filter((it) => {
        const matchesDay = mode === 'daily' || it.dayOfWeek === selectedDay;
        if (!matchesDay) return true;
        seen += 1;
        return seen !== indexInVisible;
      })
    );
  };

  const handleCopyDay = () => {
    if (copyTargets.length === 0) return;
    const sourceItems = items.filter((it) => it.dayOfWeek === selectedDay);
    setItems((prev) => {
      const targetSet = new Set(copyTargets);
      const kept = prev.filter((it) => it.dayOfWeek === null || !targetSet.has(it.dayOfWeek));
      const duplicated: MealRoutineItem[] = [];
      for (const targetDay of copyTargets) {
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
    toast.success('Día copiado');
    setCopyOpen(false);
    setCopyTargets([]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Poné un nombre para tu rutina');
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
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Configurar rutina de comidas"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] sm:rounded-[24px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--divider)] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
              Rutinas de comidas
            </h2>
            <p className="text-[12px] text-[var(--text-muted)]">
              Armá un plan diario o semanal y registralo en 1 toque
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenAiPlanner ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAiPlanner();
                }}
                className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--surface-inset)] px-3 text-xs font-semibold text-[var(--accent-text)] hover:opacity-90"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Armar con IA
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-secondary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Saved Routines Selector */}
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
            {mealRoutines.length > 0 ? (
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
                        {r.name} {r.mode === 'daily' ? '(Diaria)' : '(Semanal)'}
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
            ) : null}
          </div>

          {/* Name & Mode */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Nombre de la rutina
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Semana Definición"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Frecuencia
              </label>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[var(--surface-inset)] p-1">
                {(['daily', 'weekly'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`min-h-8 cursor-pointer rounded-lg text-xs font-semibold transition-colors ${
                      mode === m
                        ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {m === 'daily' ? 'Diaria (todos los días)' : 'Semanal (Lun-Dom)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--accent-fill)]"
            />
            Usar como rutina activa en Nutrición
          </label>

          {/* Day Selector (Weekly) */}
          {mode === 'weekly' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {DAY_LABELS.map((label, idx) => {
                    const count = items.filter((it) => it.dayOfWeek === idx).length;
                    const active = selectedDay === idx;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setSelectedDay(idx)}
                        className={`min-h-9 cursor-pointer rounded-xl px-2.5 text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[var(--accent-fill)] text-[var(--on-accent)]'
                            : 'bg-[var(--surface-inset)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {label}
                        {count > 0 ? ` (${count})` : ''}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCopyTargets([]);
                    setCopyOpen((v) => !v);
                  }}
                  className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--accent-text)] hover:bg-[var(--surface-inset)]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar día
                </button>
              </div>

              {copyOpen ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3 space-y-2">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Copiar {DAY_LABELS[selectedDay]} a:
                  </p>
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
                              checked ? prev.filter((d) => d !== idx) : [...prev, idx]
                            )
                          }
                          className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold ${
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
                      className="cursor-pointer text-xs text-[var(--text-muted)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyDay}
                      className="cursor-pointer rounded-lg bg-[var(--accent-fill)] px-3 py-1 text-xs font-semibold text-[var(--on-accent)]"
                    >
                      Aplicar copia
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Day Macro Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-inset)] px-3.5 py-2.5 text-xs tabular-nums">
            <span className="font-semibold text-[var(--text-primary)]">
              {mode === 'daily' ? 'Total diario' : `Total ${DAY_LABELS[selectedDay]}`}:{' '}
              {Math.round(dayTotals.calories)} / {goals.dailyCalorieGoal} kcal
            </span>
            <div className="flex items-center gap-3 text-[var(--text-secondary)]">
              <span>P: {Math.round(dayTotals.proteinG)}/{Math.round(goals.proteinGoalG)}g</span>
              <span>C: {Math.round(dayTotals.carbG)}/{Math.round(goals.carbGoalG)}g</span>
              <span>G: {Math.round(dayTotals.fatG)}/{Math.round(goals.fatGoalG)}g</span>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-2">
            {visibleItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-6 text-center text-xs text-[var(--text-muted)]">
                No hay comidas planificadas para {mode === 'daily' ? 'la rutina diaria' : DAY_LABELS[selectedDay]}.
              </p>
            ) : (
              visibleItems.map((it, idx) => {
                const slotLabel =
                  MEAL_SLOTS.find((s) => s.id === it.mealType)?.label ?? it.mealType;
                return (
                  <div
                    key={`${it.name}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-text)]">
                        {slotLabel}
                      </p>
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {it.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        {Math.round(it.calories)} kcal · P {Math.round(it.proteinG)}g · C{' '}
                        {Math.round(it.carbG)}g · G {Math.round(it.fatG)}g
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it, idx)}
                      aria-label={`Quitar ${it.name}`}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-card)] hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Item Section */}
          {showAddForm ? (
            <form
              onSubmit={handleAddItem}
              className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3.5"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={newMealType}
                  onChange={(e) =>
                    setNewMealType(e.target.value as MealRoutineItem['mealType'])
                  }
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre (ej: Yogur griego con whey)"
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
              <div className="grid grid-cols-5 gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Kcal"
                  value={newCalories}
                  onChange={(e) => setNewCalories(e.target.value)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Prot (g)"
                  value={newProtein}
                  onChange={(e) => setNewProtein(e.target.value)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Carb (g)"
                  value={newCarb}
                  onChange={(e) => setNewCarb(e.target.value)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Gras (g)"
                  value={newFat}
                  onChange={(e) => setNewFat(e.target.value)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Min"
                  value={newPrepMin}
                  onChange={(e) => setNewPrepMin(e.target.value)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                />
              </div>
              {customFoods.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    O agregá rápido desde tus recetas:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {customFoods.slice(0, 6).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleAddCustomFood(f)}
                        className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent-fill)]"
                      >
                        + {f.name} ({Math.round(f.calories)} kcal)
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="cursor-pointer px-3 py-1.5 text-xs text-[var(--text-muted)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-xl bg-[var(--accent-fill)] px-3.5 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
                >
                  Agregar comida
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-inset)]"
            >
              <Plus className="h-4 w-4" />
              Agregar comida a {mode === 'daily' ? 'la rutina' : DAY_LABELS[selectedDay]}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--divider)] px-5 py-3.5">
          {editingId ? (
            <button
              type="button"
              onClick={() => void handleDelete(editingId)}
              className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10"
            >
              Eliminar rutina
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-inset)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-4 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar rutina'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

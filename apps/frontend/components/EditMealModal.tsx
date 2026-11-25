'use client';

import { useEffect, useState } from 'react';
import { Check, Trash2, Utensils, X } from 'lucide-react';
import { LogMealPayload, Meal } from '@/lib/api/health';
import { useHealthStore } from '@/store/useHealthStore';
import toast from 'react-hot-toast';

interface EditMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  meal: Meal | null;
  date: string;
}

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_SLOTS: ReadonlyArray<{ id: MealSlot; label: string }> = [
  { id: 'breakfast', label: 'Desayuno' },
  { id: 'lunch', label: 'Almuerzo' },
  { id: 'snack', label: 'Snack' },
  { id: 'dinner', label: 'Cena' },
];

function buildInitialFormData(meal: Meal | null) {
  return {
    mealType: (meal?.mealType ?? 'lunch') as MealSlot,
    name: meal?.name ?? '',
    calories: meal ? String(Math.round(meal.calories)) : '',
    proteinG: meal ? String(meal.proteinG) : '',
    carbG: meal ? String(meal.carbG) : '',
    fatG: meal ? String(meal.fatG) : '',
    fiberG: meal ? String(meal.fiberG ?? 0) : '0',
    sugarG: meal ? String(meal.sugarG ?? 0) : '0',
  };
}

export default function EditMealModal({
  isOpen,
  onClose,
  onSaved,
  meal,
  date,
}: EditMealModalProps) {
  if (!isOpen || !meal) return null;
  return (
    <EditMealModalContent
      key={meal.id}
      meal={meal}
      date={date}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function EditMealModalContent({
  meal,
  date,
  onClose,
  onSaved,
}: {
  meal: Meal;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { updateMealOptimistic, deleteMealOptimistic } = useHealthStore();
  const [formData, setFormData] = useState(() => buildInitialFormData(meal));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.calories) return;

    const payload: LogMealPayload = {
      date,
      mealType: formData.mealType,
      name: formData.name.trim(),
      calories: Math.max(1, Math.round(Number(formData.calories) || 0)),
      proteinG: Math.max(0, Number(formData.proteinG) || 0),
      carbG: Math.max(0, Number(formData.carbG) || 0),
      fatG: Math.max(0, Number(formData.fatG) || 0),
      fiberG: Math.max(0, Number(formData.fiberG) || 0),
      sugarG: Math.max(0, Number(formData.sugarG) || 0),
    };

    onSaved();
    onClose();
    void updateMealOptimistic(meal.id, payload).catch(() => {
      toast.error('No se pudieron guardar los cambios.');
    });
  };

  const handleDelete = () => {
    const mealId = meal.id;
    onSaved();
    onClose();
    void deleteMealOptimistic(mealId, date).catch(() => {
      toast.error('No se pudo eliminar la comida.');
    });
  };

  return (
    <div
      className="mobile-sheet-root fixed inset-0 z-[100] flex items-end justify-center bg-black/65 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-meal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mobile-sheet-panel flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-[var(--border-subtle)] bg-[var(--surface-page)] shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <h2
            id="edit-meal-title"
            className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]"
          >
            <Utensils className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
            Editar comida
          </h2>
          <button
            type="button"
            aria-label="Cerrar edición de comida"
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          id="edit-meal-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-4"
        >
          {/* Meal Slot Selector */}
          <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-1">
            {MEAL_SLOTS.map((slot) => {
              const active = formData.mealType === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setFormData((d) => ({ ...d, mealType: slot.id }))}
                  className={`flex-1 cursor-pointer rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3.5">
            <div>
              <label
                htmlFor="edit-meal-name"
                className="mb-1 block text-[12px] font-medium text-[var(--text-muted)]"
              >
                Alimento o plato
              </label>
              <textarea
                id="edit-meal-name"
                required
                rows={2}
                maxLength={200}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2 text-base leading-snug text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="edit-meal-kcal"
                className="mb-1 block text-[12px] font-medium text-[var(--text-muted)]"
              >
                Calorías (kcal)
              </label>
              <input
                id="edit-meal-kcal"
                required
                type="number"
                inputMode="numeric"
                min="1"
                max="25000"
                value={formData.calories}
                onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2 text-base font-semibold text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label
                  htmlFor="edit-meal-p"
                  className="mb-1 block text-[11px] font-semibold text-[var(--chart-protein)]"
                >
                  Prot (g)
                </label>
                <input
                  id="edit-meal-p"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={formData.proteinG}
                  onChange={(e) => setFormData({ ...formData, proteinG: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-meal-c"
                  className="mb-1 block text-[11px] font-semibold text-[var(--chart-carb)]"
                >
                  Carbs (g)
                </label>
                <input
                  id="edit-meal-c"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={formData.carbG}
                  onChange={(e) => setFormData({ ...formData, carbG: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-meal-f"
                  className="mb-1 block text-[11px] font-semibold text-[var(--chart-fat)]"
                >
                  Grasas (g)
                </label>
                <input
                  id="edit-meal-f"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={formData.fatG}
                  onChange={(e) => setFormData({ ...formData, fatG: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label
                  htmlFor="edit-meal-fiber"
                  className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Fibra (g)
                </label>
                <input
                  id="edit-meal-fiber"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={formData.fiberG}
                  onChange={(e) => setFormData({ ...formData, fiberG: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-meal-sugar"
                  className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]"
                >
                  Azúcares (g)
                </label>
                <input
                  id="edit-meal-sugar"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={formData.sugarG}
                  onChange={(e) => setFormData({ ...formData, sugarG: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Clean 2-step inline delete (no jarring window.confirm) */}
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[13px] font-semibold text-[var(--status-danger)] active:scale-[0.99]"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Eliminar este registro
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2">
              <span className="min-w-0 flex-1 px-1 text-xs font-medium text-[var(--text-secondary)]">
                ¿Eliminar comida?
              </span>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="min-h-9 cursor-pointer rounded-lg px-3 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="min-h-9 cursor-pointer rounded-lg bg-red-600 px-3 text-xs font-semibold text-[#ffffff] active:scale-95"
              >
                Sí, eliminar
              </button>
            </div>
          )}

          <div className="pt-1 pb-[env(safe-area-inset-bottom,0px)]">
            <button
              type="submit"
              disabled={!formData.name.trim() || !formData.calories}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill)] px-4 text-[15px] font-semibold text-[var(--on-accent)] transition-transform duration-100 active:scale-[0.98] disabled:opacity-45"
            >
              <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

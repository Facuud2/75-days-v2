'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CatalogExercise } from '@/lib/api/exerciseCatalog';
import {
  healthService,
  RoutineExerciseItem,
  WorkoutRoutineRecord,
} from '@/lib/api/health';
import { formatMuscleLabel } from '@/lib/constants/fitness';
import ExerciseCatalogBrowser from './ExerciseCatalogBrowser';

interface RoutineBuilderSheetProps {
  isOpen: boolean;
  initialRoutine?: WorkoutRoutineRecord | null;
  onClose: () => void;
  onSaved: (routine: WorkoutRoutineRecord) => void;
}

export default function RoutineBuilderSheet({
  isOpen,
  initialRoutine,
  onClose,
  onSaved,
}: RoutineBuilderSheetProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<RoutineExerciseItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialRoutine && !initialRoutine.id.startsWith('template-')) {
      setName(initialRoutine.name);
      setDescription(initialRoutine.description || '');
      setExercises(initialRoutine.exercises || []);
    } else if (initialRoutine) {
      setName(`${initialRoutine.name}`);
      setDescription(initialRoutine.description || '');
      setExercises(initialRoutine.exercises || []);
    } else {
      setName('');
      setDescription('');
      setExercises([]);
    }
    setShowPicker(false);
  }, [isOpen, initialRoutine]);

  if (!isOpen) return null;

  const isEditingExisting = Boolean(
    initialRoutine && !initialRoutine.id.startsWith('template-')
  );

  const handleAddPicked = (picked: CatalogExercise[]) => {
    setExercises((prev) => [
      ...prev,
      ...picked.map((ex, offset) => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        primaryMuscle: ex.primaryMuscle,
        equipment: ex.equipment,
        order: prev.length + offset,
        targetSets: 3,
        targetReps: '8-12',
        defaultRestSec: 90,
      })),
    ]);
    setShowPicker(false);
  };

  const moveExercise = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= exercises.length) return;
    setExercises((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next.map((ex, i) => ({ ...ex, order: i }));
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Ponle un nombre a tu rutina.');
      return;
    }
    if (exercises.length === 0) {
      toast.error('Añade al menos un ejercicio a la rutina.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        sport: 'strength',
        exercises: exercises.map((ex, idx) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          primaryMuscle: ex.primaryMuscle ?? null,
          equipment: ex.equipment ?? null,
          order: idx,
          targetSets: Math.min(20, Math.max(1, Number(ex.targetSets) || 3)),
          targetReps: ex.targetReps?.trim() || '8-12',
          defaultRestSec: Math.min(600, Math.max(15, Number(ex.defaultRestSec) || 90)),
        })),
      };

      const saved = isEditingExisting
        ? await healthService.updateRoutine(initialRoutine!.id, payload)
        : await healthService.createRoutine(payload);

      toast.success(isEditingExisting ? 'Rutina actualizada' : 'Rutina guardada');
      onSaved(saved);
      onClose();
    } catch {
      toast.error('Error al guardar la rutina.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end justify-center bg-black/80 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="routine-builder-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-4">
          <h2 id="routine-builder-title" className="text-base font-bold text-white">
            {showPicker
              ? 'Elegir ejercicios del catálogo'
              : isEditingExisting
                ? 'Editar rutina'
                : 'Nueva rutina'}
          </h2>
          <button
            type="button"
            onClick={showPicker ? () => setShowPicker(false) : onClose}
            aria-label="Cerrar"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          {showPicker ? (
            <ExerciseCatalogBrowser
              mode="picker"
              onConfirmSelection={handleAddPicked}
              onClosePicker={() => setShowPicker(false)}
            />
          ) : (
            <form id="routine-builder-form" onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="routine-name-input"
                  className="mb-1.5 block text-xs font-semibold text-zinc-400"
                >
                  Nombre de la rutina
                </label>
                <input
                  id="routine-name-input"
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Torso Fuerza · Día A"
                  className="min-h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
              </div>

              <div>
                <label
                  htmlFor="routine-desc-input"
                  className="mb-1.5 block text-xs font-semibold text-zinc-400"
                >
                  Descripción breve (opcional)
                </label>
                <input
                  id="routine-desc-input"
                  type="text"
                  maxLength={300}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Enfoque en progresión de cargas"
                  className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Ejercicios ({exercises.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-rose-500/15 px-3 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500 hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Añadir ejercicios
                  </button>
                </div>

                {exercises.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center transition-colors hover:border-rose-500/50 hover:bg-zinc-900"
                  >
                    <Plus className="h-6 w-6 text-rose-400" />
                    <span className="mt-2 text-sm font-semibold text-white">
                      Elegir del catálogo de 876 ejercicios
                    </span>
                    <span className="mt-0.5 text-xs text-zinc-400">
                      Filtra por grupo muscular o equipamiento
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {exercises.map((ex, idx) => (
                      <div
                        key={`${ex.exerciseId}-${idx}`}
                        className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {idx + 1}. {ex.exerciseName}
                            </p>
                            <p className="text-[11px] text-zinc-400">
                              {formatMuscleLabel(ex.primaryMuscle)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveExercise(idx, -1)}
                              disabled={idx === 0}
                              aria-label="Subir ejercicio"
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveExercise(idx, 1)}
                              disabled={idx === exercises.length - 1}
                              aria-label="Bajar ejercicio"
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExercises((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label="Quitar ejercicio"
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2.5 grid grid-cols-3 gap-2">
                          <label className="block">
                            <span className="text-[10px] font-medium uppercase text-zinc-400">
                              Series
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={20}
                              value={ex.targetSets}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setExercises((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, targetSets: val } : item
                                  )
                                );
                              }}
                              className="mt-1 min-h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-center text-xs font-semibold text-white tabular-nums"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-medium uppercase text-zinc-400">
                              Reps obj.
                            </span>
                            <input
                              type="text"
                              maxLength={20}
                              value={ex.targetReps || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExercises((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, targetReps: val } : item
                                  )
                                );
                              }}
                              placeholder="8-12"
                              className="mt-1 min-h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-center text-xs font-semibold text-white"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-medium uppercase text-zinc-400">
                              Descanso (s)
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={15}
                              max={600}
                              step={15}
                              value={ex.defaultRestSec}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setExercises((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, defaultRestSec: val } : item
                                  )
                                );
                              }}
                              className="mt-1 min-h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-center text-xs font-semibold text-white tabular-nums"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {!showPicker && (
          <div className="flex gap-2.5 border-t border-zinc-900 bg-zinc-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 flex-1 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="routine-builder-form"
              disabled={saving}
              className="flex min-h-12 flex-[2] cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-bold text-[#ffffff] shadow-lg shadow-rose-600/20 transition-transform active:scale-[0.98] hover:bg-rose-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar rutina'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

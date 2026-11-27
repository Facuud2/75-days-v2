'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Coffee,
  Dumbbell,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CatalogExercise } from '@/lib/api/exerciseCatalog';
import {
  healthService,
  type TrainingPlanEnvironment,
  type TrainingPlanPayload,
  type TrainingPlanRecord,
  type TrainingPlanScheduleType,
  type TrainingPlanSlotExercise,
  type TrainingPlanSlotRecord,
  type TrainingSlotTimeOfDay,
  type TrainingSlotType,
  type WorkoutRoutineRecord,
} from '@/lib/api/health';
import ExerciseCatalogBrowser from './ExerciseCatalogBrowser';

const DAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const DAY_FULL = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

const ENV_OPTIONS: Array<{ value: TrainingPlanEnvironment; label: string }> = [
  { value: 'gym', label: 'Gimnasio' },
  { value: 'home', label: 'En casa' },
  { value: 'outdoor', label: 'Aire libre' },
  { value: 'mixed', label: 'Mixto' },
];

const TIME_OPTIONS: Array<{ value: TrainingSlotTimeOfDay; label: string }> = [
  { value: 'any', label: 'Cualquier hora' },
  { value: 'morning', label: 'Mañana' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'evening', label: 'Noche' },
];

const CARDIO_SPORTS: Array<{
  value: TrainingPlanSlotRecord['sport'];
  label: string;
}> = [
  { value: 'walking', label: 'Caminata' },
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Ciclismo' },
  { value: 'swimming', label: 'Natación' },
  { value: 'yoga', label: 'Yoga / Movilidad' },
  { value: 'other', label: 'Otro cardio' },
];

interface EditableSlot extends Omit<TrainingPlanSlotRecord, 'id' | 'planId'> {
  localId: string;
}

interface TrainingPlanBuilderSheetProps {
  isOpen: boolean;
  initialPlan?: TrainingPlanRecord | null;
  initialDraft?: TrainingPlanPayload | null;
  existingPlanId?: string;
  savedRoutines?: WorkoutRoutineRecord[];
  onClose: () => void;
  onSaved: (plan: TrainingPlanRecord) => void;
  onDeleted?: (planId: string) => void;
  onSwitchToAi?: () => void;
}

function makeLocalId() {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function TrainingPlanBuilderSheet(props: TrainingPlanBuilderSheetProps) {
  if (!props.isOpen) return null;
  return (
    <TrainingPlanBuilderContent
      key={props.initialPlan?.id ?? props.existingPlanId ?? (props.initialDraft ? 'draft' : 'new')}
      {...props}
    />
  );
}

function TrainingPlanBuilderContent({
  initialPlan,
  initialDraft,
  existingPlanId,
  savedRoutines = [],
  onClose,
  onSaved,
  onDeleted,
  onSwitchToAi,
}: TrainingPlanBuilderSheetProps) {
  const source = initialDraft ?? initialPlan;
  const targetPlanId = existingPlanId ?? initialPlan?.id;

  const [name, setName] = useState(() => source?.name || '');
  const [goalSummary, setGoalSummary] = useState(() => source?.goalSummary || '');
  const [scheduleType, setScheduleType] = useState<TrainingPlanScheduleType>(() =>
    source?.scheduleType === 'daily' || source?.scheduleType === 'sequential'
      ? 'daily'
      : 'weekly'
  );
  const [environment, setEnvironment] = useState<TrainingPlanEnvironment>(
    () => source?.environment || 'gym'
  );
  const [selectedDay, setSelectedDay] = useState<number>(0);

  const [slots, setSlots] = useState<EditableSlot[]>(() =>
    (source?.slots ?? []).map((s, idx) => ({
      localId: makeLocalId() + idx,
      dayOfWeek: s.dayOfWeek ?? null,
      timeOfDay: s.timeOfDay ?? 'any',
      order: s.order ?? idx,
      slotType: s.slotType ?? 'routine',
      title: s.title,
      focusMuscles: s.focusMuscles ?? [],
      environment: s.environment ?? null,
      sport: s.sport ?? 'strength',
      targetDurationMin: s.targetDurationMin ?? 45,
      targetSteps: s.targetSteps ?? null,
      routineId: s.routineId ?? null,
      notes: s.notes ?? null,
      exercises: s.exercises ?? [],
    }))
  );

  const [pickerSlotLocalId, setPickerSlotLocalId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pickerSlotLocalId) setPickerSlotLocalId(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, pickerSlotLocalId]);

  const visibleSlots = useMemo(() => {
    if (scheduleType === 'daily') return slots;
    return slots.filter((s) => (s.dayOfWeek ?? 0) === selectedDay);
  }, [scheduleType, selectedDay, slots]);

  const addSlot = (slotType: TrainingSlotType) => {
    const newSlot: EditableSlot = {
      localId: makeLocalId(),
      dayOfWeek: scheduleType === 'weekly' ? selectedDay : null,
      timeOfDay: 'any',
      order: visibleSlots.length,
      slotType,
      title:
        slotType === 'cardio'
          ? 'Caminata activa'
          : slotType === 'rest'
            ? 'Descanso'
            : 'Sesión de fuerza',
      focusMuscles: [],
      environment: environment === 'mixed' ? null : environment,
      sport: slotType === 'cardio' ? 'walking' : 'strength',
      targetDurationMin: slotType === 'rest' ? null : 45,
      targetSteps: null,
      routineId: null,
      notes: null,
      exercises: [],
    };
    setSlots((prev) => [...prev, newSlot]);
  };

  const updateSlot = (localId: string, patch: Partial<EditableSlot>) => {
    setSlots((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)));
  };

  const removeSlot = (localId: string) => {
    setSlots((prev) => prev.filter((s) => s.localId !== localId));
  };

  const moveVisibleSlot = (localId: string, delta: -1 | 1) => {
    const daySlots = [...visibleSlots];
    const idx = daySlots.findIndex((s) => s.localId === localId);
    const targetIdx = idx + delta;
    if (idx === -1 || targetIdx < 0 || targetIdx >= daySlots.length) return;

    const [moved] = daySlots.splice(idx, 1);
    daySlots.splice(targetIdx, 0, moved);
    const reorderedIds = new Map(daySlots.map((s, i) => [s.localId, i]));

    setSlots((prev) => {
      const updated = prev.map((s) =>
        reorderedIds.has(s.localId) ? { ...s, order: reorderedIds.get(s.localId)! } : s
      );
      return updated.sort((a, b) => (a.dayOfWeek ?? -1) - (b.dayOfWeek ?? -1) || a.order - b.order);
    });
  };

  const handleLinkSavedRoutine = (localId: string, routineId: string) => {
    const routine = savedRoutines.find((r) => r.id === routineId);
    if (!routine) return;
    const mappedExercises: TrainingPlanSlotExercise[] = routine.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      primaryMuscle: ex.primaryMuscle ?? null,
      equipment: ex.equipment ?? null,
      targetSets: ex.targetSets ?? 3,
      targetReps: ex.targetReps ?? '8-12',
      defaultRestSec: ex.defaultRestSec ?? 90,
    }));
    updateSlot(localId, {
      routineId: routine.id,
      title: routine.name,
      exercises: mappedExercises,
    });
  };

  const handlePickedExercises = (picked: CatalogExercise[]) => {
    if (!pickerSlotLocalId) return;
    setSlots((prev) =>
      prev.map((s) => {
        if (s.localId !== pickerSlotLocalId) return s;
        const existing = s.exercises ?? [];
        const existingIds = new Set(existing.map((e) => e.exerciseId));
        const additions: TrainingPlanSlotExercise[] = picked
          .filter((p) => !existingIds.has(p.id))
          .map((p) => ({
            exerciseId: p.id,
            exerciseName: p.name,
            primaryMuscle: p.primaryMuscle,
            equipment: p.equipment,
            targetSets: 3,
            targetReps: '8-12',
            defaultRestSec: 90,
          }));
        return { ...s, exercises: [...existing, ...additions] };
      })
    );
    setPickerSlotLocalId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Ponle un nombre a tu plan.');
      return;
    }
    if (slots.length === 0) {
      toast.error('Agregá al menos un bloque de entrenamiento.');
      return;
    }

    setSaving(true);
    try {
      const payload: TrainingPlanPayload = {
        name: name.trim(),
        goalSummary: goalSummary.trim() || null,
        scheduleType,
        environment,
        isActive: true,
        slots: slots.map((s, idx) => ({
          dayOfWeek: scheduleType === 'weekly' ? (s.dayOfWeek ?? 0) : null,
          timeOfDay: s.timeOfDay,
          order: idx,
          slotType: s.slotType,
          title: s.title.trim() || 'Bloque de entrenamiento',
          focusMuscles: s.focusMuscles ?? [],
          environment: s.environment ?? (environment !== 'mixed' ? environment : null),
          sport: s.sport,
          targetDurationMin: s.targetDurationMin ? Number(s.targetDurationMin) : null,
          targetSteps: s.targetSteps ? Number(s.targetSteps) : null,
          routineId: s.routineId ?? null,
          notes: s.notes?.trim() || null,
          exercises: s.exercises ?? [],
        })),
      };

      const saved = targetPlanId
        ? await healthService.updateTrainingPlan(targetPlanId, payload)
        : await healthService.createTrainingPlan(payload);

      toast.success(targetPlanId ? 'Plan actualizado' : 'Plan manual creado y activado');
      onSaved(saved);
      onClose();
    } catch {
      toast.error('No se pudo guardar el plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!targetPlanId || deleting) return;
    if (!confirm('¿Eliminar este plan de entrenamiento?')) return;
    setDeleting(true);
    try {
      await healthService.deleteTrainingPlan(targetPlanId);
      toast.success('Plan eliminado');
      onDeleted?.(targetPlanId);
      onClose();
    } catch {
      toast.error('No se pudo eliminar el plan.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Editor manual de plan de entrenamiento"
    >
      <div className="flex h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xl sm:h-[85dvh] sm:rounded-[28px]">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 border-b border-[var(--divider)] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-bold text-[var(--text-primary)]">
              {targetPlanId ? 'Editar plan manual' : 'Crear plan a mano'}
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Organizá tus días, ejercicios y cardio con control total
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {onSwitchToAi && !targetPlanId ? (
              <button
                type="button"
                onClick={onSwitchToAi}
                className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full bg-[var(--accent-fill)]/15 px-2.5 text-[11px] font-bold text-[var(--accent-text)] hover:bg-[var(--accent-fill)]/25 active:scale-95"
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Armar con IA
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar editor"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {/* Name + Goal */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  Nombre del plan
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Fuerza 4 días + Caminata"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-fill)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  Resumen / objetivo (opcional)
                </label>
                <input
                  type="text"
                  value={goalSummary}
                  onChange={(e) => setGoalSummary(e.target.value)}
                  placeholder="Ej: Ganar fuerza y cumplir 45 min diarios"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-fill)] focus:outline-none"
                />
              </div>
            </div>

            {/* Schedule Mode + Environment */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                  Frecuencia
                </span>
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-1">
                  {(
                    [
                      { value: 'weekly', label: 'Semanal (L–D)' },
                      { value: 'daily', label: 'Diario (todos los días)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setScheduleType(opt.value)}
                      className={`min-h-9 cursor-pointer rounded-lg text-xs font-bold transition-colors ${
                        scheduleType === opt.value
                          ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                  Lugar de entrenamiento
                </span>
                <div className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-1">
                  {ENV_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEnvironment(opt.value)}
                      className={`min-h-9 cursor-pointer rounded-lg px-1 text-[11px] font-bold transition-colors ${
                        environment === opt.value
                          ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Weekly Day Selector */}
            {scheduleType === 'weekly' ? (
              <div>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_SHORT.map((letter, idx) => {
                    const isSelected = selectedDay === idx;
                    const count = slots.filter((s) => (s.dayOfWeek ?? 0) === idx).length;
                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => setSelectedDay(idx)}
                        className={`flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border text-xs font-bold transition-colors ${
                          isSelected
                            ? 'border-[var(--accent-fill)] bg-[var(--accent-fill)] text-[var(--on-accent)]'
                            : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span>{letter}</span>
                        <span className="text-[10px] opacity-80 tabular-nums">
                          {count > 0 ? count : '·'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs font-bold text-[var(--text-primary)]">
                  Bloques del {DAY_FULL[selectedDay]}
                </p>
              </div>
            ) : (
              <p className="text-xs font-bold text-[var(--text-primary)]">
                Bloques de tu rutina diaria
              </p>
            )}

            {/* Add Slot Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addSlot('routine')}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent-fill)]/15 px-3 text-xs font-bold text-[var(--accent-text)] hover:bg-[var(--accent-fill)]/25 active:scale-95"
              >
                <Dumbbell className="h-3.5 w-3.5" />+ Bloque de fuerza
              </button>
              <button
                type="button"
                onClick={() => addSlot('cardio')}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 active:scale-95"
              >
                <Activity className="h-3.5 w-3.5" />+ Cardio / Caminata
              </button>
              <button
                type="button"
                onClick={() => addSlot('rest')}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95"
              >
                <Coffee className="h-3.5 w-3.5" />+ Descanso
              </button>
            </div>

            {/* Slots List */}
            {visibleSlots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)]/40 p-6 text-center text-xs text-[var(--text-muted)]">
                Sin bloques todavía. Tocá un botón arriba para sumar fuerza, cardio o descanso.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleSlots.map((slot, idx) => (
                  <div
                    key={slot.localId}
                    className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                        {slot.slotType === 'cardio'
                          ? 'Cardio / Actividad'
                          : slot.slotType === 'rest'
                            ? 'Descanso'
                            : 'Fuerza / Rutina'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveVisibleSlot(slot.localId, -1)}
                          aria-label="Subir bloque"
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)] disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === visibleSlots.length - 1}
                          onClick={() => moveVisibleSlot(slot.localId, 1)}
                          aria-label="Bajar bloque"
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)] disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSlot(slot.localId)}
                          aria-label="Eliminar bloque"
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <input
                        type="text"
                        value={slot.title}
                        onChange={(e) => updateSlot(slot.localId, { title: e.target.value })}
                        placeholder="Título del bloque"
                        className="sm:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-fill)] focus:outline-none"
                      />
                      <select
                        value={slot.timeOfDay}
                        onChange={(e) =>
                          updateSlot(slot.localId, {
                            timeOfDay: e.target.value as TrainingSlotTimeOfDay,
                          })
                        }
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--accent-fill)] focus:outline-none"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {slot.slotType === 'cardio' ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <select
                          value={slot.sport}
                          onChange={(e) =>
                            updateSlot(slot.localId, {
                              sport: e.target.value as TrainingPlanSlotRecord['sport'],
                            })
                          }
                          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--accent-fill)] focus:outline-none"
                        >
                          {CARDIO_SPORTS.map((sp) => (
                            <option key={sp.value} value={sp.value}>
                              {sp.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={5}
                          max={360}
                          value={slot.targetDurationMin ?? ''}
                          onChange={(e) =>
                            updateSlot(slot.localId, {
                              targetDurationMin: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="Minutos (ej. 45)"
                          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-fill)] focus:outline-none"
                        />
                      </div>
                    ) : slot.slotType !== 'rest' ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPickerSlotLocalId(slot.localId)}
                            className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-fill)]/60"
                          >
                            <Plus className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                            Elegir ejercicios ({slot.exercises?.length ?? 0})
                          </button>

                          {savedRoutines.length > 0 ? (
                            <select
                              value={slot.routineId ?? ''}
                              onChange={(e) => handleLinkSavedRoutine(slot.localId, e.target.value)}
                              className="min-h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 text-xs text-[var(--text-secondary)]"
                            >
                              <option value="">O importar rutina guardada...</option>
                              {savedRoutines.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name} ({r.exercises.length} ej.)
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>

                        {slot.exercises && slot.exercises.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {slot.exercises.map((ex) => (
                              <span
                                key={ex.exerciseId}
                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-card)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]"
                              >
                                <span className="max-w-[160px] truncate">{ex.exerciseName}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSlot(slot.localId, {
                                      exercises: (slot.exercises ?? []).filter(
                                        (e) => e.exerciseId !== ex.exerciseId
                                      ),
                                    })
                                  }
                                  aria-label={`Quitar ${ex.exerciseName}`}
                                  className="cursor-pointer text-[var(--text-muted)] hover:text-red-400"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-between gap-2 border-t border-[var(--divider)] bg-[var(--surface-card)] px-4 py-3">
            {targetPlanId ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete()}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-3.5 text-xs font-bold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill)] px-5 text-sm font-bold text-[var(--on-accent)] hover:bg-[var(--accent-fill-hover)] active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar y activar plan
            </button>
          </footer>
        </form>
      </div>

      {/* Exercise Catalog Picker Overlay */}
      {pickerSlotLocalId ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 sm:items-center sm:p-4">
          <div className="flex h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-[var(--divider)] px-4 py-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Elegir ejercicios para el bloque
              </h3>
              <button
                type="button"
                onClick={() => setPickerSlotLocalId(null)}
                aria-label="Cerrar selector de ejercicios"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-secondary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ExerciseCatalogBrowser
                mode="picker"
                environment={
                  environment === 'gym' || environment === 'home' || environment === 'outdoor'
                    ? environment
                    : undefined
                }
                onConfirmSelection={handlePickedExercises}
                onClosePicker={() => setPickerSlotLocalId(null)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

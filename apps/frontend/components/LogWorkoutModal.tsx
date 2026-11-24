'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Bike,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Minus,
  Play,
  Plus,
  Sparkles,
  Waves,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  estimateWorkoutCaloriesClient,
  useHealthStore,
} from '@/store/useHealthStore';
import { useActiveWorkoutStore } from '@/store/useActiveWorkoutStore';

interface LogWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD
  onSaved: () => void;
  initialData?: any;
  onDelete?: (id: string) => void;
}

const SPORT_OPTIONS = [
  { value: 'strength', label: 'Fuerza', icon: Dumbbell },
  { value: 'running', label: 'Running', icon: Footprints },
  { value: 'walking', label: 'Caminata', icon: Activity },
  { value: 'cycling', label: 'Ciclismo', icon: Bike },
  { value: 'swimming', label: 'Natación', icon: Waves },
  { value: 'yoga', label: 'Yoga', icon: Sparkles },
  { value: 'other', label: 'Otro', icon: Flame },
];

const DURATION_PRESETS = [20, 30, 45, 60, 90];

const INTENSITY_OPTIONS = [
  { value: 'low', label: 'Suave' },
  { value: 'medium', label: 'Moderada' },
  { value: 'high', label: 'Intensa' },
] as const;

export default function LogWorkoutModal(props: LogWorkoutModalProps) {
  if (!props.isOpen) return null;
  return (
    <LogWorkoutModalContent
      key={props.initialData?.id ?? 'new'}
      onClose={props.onClose}
      date={props.date}
      onSaved={props.onSaved}
      initialData={props.initialData}
      onDelete={props.onDelete}
    />
  );
}

function LogWorkoutModalContent({
  onClose,
  date,
  onSaved,
  initialData,
  onDelete,
}: Omit<LogWorkoutModalProps, 'isOpen'>) {
  const {
    profileData,
    logWorkoutOptimistic,
    updateWorkoutOptimistic,
    deleteWorkoutOptimistic,
  } = useHealthStore();
  const openPreStartPicker = useActiveWorkoutStore((s) => s.openPreStartPicker);
  const hasActiveWorkout = useActiveWorkoutStore((s) => s.isActive);
  const setMinimized = useActiveWorkoutStore((s) => s.setMinimized);

  const [sport, setSport] = useState<string>(() => initialData?.sport || 'strength');
  const [durationMin, setDurationMin] = useState<number>(() => Number(initialData?.durationMin) || 45);
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>(
    () => initialData?.intensity || 'medium'
  );
  const [title, setTitle] = useState<string>(() => initialData?.title || '');
  const [caloriesBurned, setCaloriesBurned] = useState<string>(() =>
    initialData?.isManualCalories && initialData?.caloriesBurned
      ? String(initialData.caloriesBurned)
      : ''
  );
  const [distanceKm, setDistanceKm] = useState<string>(() =>
    initialData?.distanceKm ? String(initialData.distanceKm) : ''
  );
  const [notes, setNotes] = useState<string>(() => initialData?.notes || '');
  const [showAdvanced, setShowAdvanced] = useState(() =>
    Boolean(
      initialData?.title ||
        initialData?.distanceKm ||
        initialData?.notes ||
        initialData?.isManualCalories
    )
  );
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const estimatedCalories = useMemo(() => {
    const weightKg = Number(profileData?.user?.currentWeight) || 70;
    const heightCm = Number(profileData?.user?.height) || 170;
    return Math.round(
      estimateWorkoutCaloriesClient(sport, durationMin, intensity, weightKg, heightCm)
    );
  }, [sport, durationMin, intensity, profileData]);

  const handleOpenLiveTracker = () => {
    onClose();
    if (hasActiveWorkout) {
      setMinimized(false);
    } else {
      openPreStartPicker();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      setError('La duración debe ser mayor a 0 minutos.');
      return;
    }

    const payload = {
      date,
      title: title.trim() || undefined,
      sport,
      durationMin: Math.round(durationMin),
      intensity,
      notes: notes.trim() || undefined,
      caloriesBurned: caloriesBurned ? Number(caloriesBurned) : undefined,
      distanceKm:
        distanceKm && Number(distanceKm) > 0 ? Number(distanceKm) : undefined,
    };

    onSaved();
    onClose();

    if (initialData?.id) {
      void updateWorkoutOptimistic(initialData.id, payload).catch(() => {
        toast.error('Error al actualizar el entrenamiento.');
      });
    } else {
      void logWorkoutOptimistic(payload).catch(() => {
        toast.error('Error al guardar el entrenamiento.');
      });
    }
  };

  const handleDelete = () => {
    if (!initialData?.id || !onDelete) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este entrenamiento?')) return;

    const workoutId = initialData.id;
    onDelete(workoutId);
    onClose();
    void deleteWorkoutOptimistic(workoutId, date).catch(() => {
      toast.error('Error al eliminar el entrenamiento.');
    });
  };

  return (
    <div
      className="mobile-sheet-root fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-modal-title"
      onClick={onClose}
    >
      <div
        className="mobile-sheet-panel relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-900/40 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-400">
              Anotar actividad
            </p>
            <h2
              id="workout-modal-title"
              className="mt-0.5 text-lg font-bold text-white"
            >
              {initialData ? 'Editar actividad' : 'Ya entrené'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar registro de entrenamiento"
            onClick={onClose}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          {!initialData && (
            <button
              type="button"
              onClick={handleOpenLiveTracker}
              className="mb-4 flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-rose-600/30 bg-rose-600/10 px-4 py-3 text-left transition-colors hover:bg-rose-600/15 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-[#ffffff]">
                  <Play className="h-4 w-4 fill-current" />
                </span>
                <div>
                  <p className="text-xs font-bold text-white">
                    {hasActiveWorkout
                      ? 'Volver a tu sesión en vivo'
                      : '¿Vas a entrenar ahora con series?'}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Usar cronómetro, pesos y descanso guiado
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold text-rose-600 dark:text-rose-400">
                Ir →
              </span>
            </button>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs font-medium text-red-400">
              {error}
            </div>
          )}

          <form id="workout-form" onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Sport Tappable Grid */}
            <div>
              <span className="mb-2 block text-xs font-semibold text-zinc-400">
                1. Tipo de actividad
              </span>
              <div className="grid grid-cols-4 gap-2">
                {SPORT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = sport === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSport(opt.value)}
                      className={`flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-[11px] font-semibold transition-colors active:scale-95 ${
                        active
                          ? 'border-rose-600 bg-rose-600/15 text-rose-600 dark:text-rose-400 shadow-xs'
                          : 'border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Duration Quick Chips + Stepper */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">
                  2. Duración
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 tabular-nums">
                  <Flame className="h-3.5 w-3.5" />
                  ~{caloriesBurned ? Number(caloriesBurned) : estimatedCalories} kcal
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {DURATION_PRESETS.map((preset) => {
                  const active = durationMin === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDurationMin(preset)}
                      className={`min-h-10 flex-1 cursor-pointer rounded-xl border text-xs font-bold tabular-nums transition-colors active:scale-95 ${
                        active
                          ? 'border-rose-600 bg-rose-600 text-[#ffffff] shadow-sm shadow-rose-600/20'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {preset}m
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">
                <button
                  type="button"
                  onClick={() => setDurationMin((prev) => Math.max(5, prev - 5))}
                  aria-label="Restar 5 minutos"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-zinc-800 text-white transition-transform active:scale-95 hover:bg-zinc-700"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-zinc-400" />
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="1440"
                    required
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    aria-label="Duración en minutos"
                    className="w-16 bg-transparent text-center text-lg font-bold text-white tabular-nums focus:outline-none"
                  />
                  <span className="text-xs font-medium text-zinc-400">min</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDurationMin((prev) => Math.min(1440, prev + 5))}
                  aria-label="Sumar 5 minutos"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-zinc-800 text-white transition-transform active:scale-95 hover:bg-zinc-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 3. Segmented Intensity */}
            <div>
              <span className="mb-2 block text-xs font-semibold text-zinc-400">
                3. Intensidad
              </span>
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-1">
                {INTENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setIntensity(opt.value)}
                    className={`min-h-10 cursor-pointer rounded-xl text-xs font-bold transition-colors ${
                      intensity === opt.value
                        ? 'bg-zinc-800 text-white shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Advanced Accordion */}
            <div className="border-t border-zinc-900 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                aria-expanded={showAdvanced}
                className="flex w-full cursor-pointer items-center justify-between py-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
              >
                <span>Más opciones (título, distancia, calorías, notas)</span>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título (ej: Corrida en el parque)"
                    className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                        Calorías manuales
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        placeholder={`Auto (${estimatedCalories})`}
                        value={caloriesBurned}
                        onChange={(e) => setCaloriesBurned(e.target.value)}
                        className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                      />
                    </div>

                    {sport !== 'strength' && sport !== 'yoga' && (
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                          Distancia (km)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0.1"
                          placeholder="0.0"
                          value={distanceKm}
                          onChange={(e) => setDistanceKm(e.target.value)}
                          className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas rápidas..."
                    className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 border-t border-zinc-900 bg-zinc-900/40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {initialData && (
            <button
              type="button"
              onClick={handleDelete}
              className="min-h-12 cursor-pointer rounded-xl border border-red-500/30 px-4 text-sm font-semibold text-red-400 hover:bg-red-500/10"
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="workout-form"
            className="min-h-12 flex-[2] cursor-pointer rounded-xl bg-rose-600 px-4 text-sm font-bold text-[#ffffff] shadow-lg shadow-rose-600/20 transition-transform active:scale-[0.98] hover:bg-rose-700"
          >
            {initialData ? 'Actualizar' : 'Guardar actividad'}
          </button>
        </div>
      </div>
    </div>
  );
}

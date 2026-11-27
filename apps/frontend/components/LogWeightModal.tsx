'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Check, Minus, Plus, Scale, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useHealthStore } from '@/store/useHealthStore';
import { userService } from '@/lib/api/users';
import { getLocalDateString } from '@/lib/utils/date';

interface LogWeightModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD
  onSaved?: () => void;
}

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 500;

export default function LogWeightModal(props: LogWeightModalProps) {
  if (!props.isOpen) return null;
  return (
    <LogWeightModalContent
      key={props.date}
      onClose={props.onClose}
      date={props.date}
      onSaved={props.onSaved}
    />
  );
}

function LogWeightModalContent({
  onClose,
  date,
  onSaved,
}: Omit<LogWeightModalProps, 'isOpen'>) {
  const { isActive, logs, logDailyMetrics, checkDailyReset } = useChallengeStore();
  const { user, updateProfile } = useAuthStore();
  const profileData = useHealthStore((s) => s.profileData);
  const fetchProfileBundle = useHealthStore((s) => s.fetchProfileBundle);
  const applyOptimisticProfilePatch = useHealthStore(
    (s) => s.applyOptimisticProfilePatch
  );

  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(date || todayStr);

  const latestLoggedWeight = useMemo(() => {
    const entries = Object.values(logs)
      .filter((entry) => typeof entry.weight === 'number' && entry.weight > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    return entries[0]?.weight ?? null;
  }, [logs]);

  const fallbackWeight =
    logs[selectedDate]?.weight ??
    latestLoggedWeight ??
    profileData?.user?.currentWeight ??
    user?.weight ??
    null;

  const [weightInput, setWeightInput] = useState<string>(() =>
    fallbackWeight ? String(fallbackWeight) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDateChange = (nextDate: string) => {
    setSelectedDate(nextDate);
    setError(null);
    const existingWeight = logs[nextDate]?.weight;
    if (typeof existingWeight === 'number' && existingWeight > 0) {
      setWeightInput(String(existingWeight));
    }
  };

  const stepWeight = (delta: number) => {
    setError(null);
    const base = Number.parseFloat(weightInput.replace(',', '.'));
    const current = Number.isFinite(base) && base > 0 ? base : fallbackWeight ?? 70;
    const next = Math.min(
      MAX_WEIGHT_KG,
      Math.max(MIN_WEIGHT_KG, Math.round((current + delta) * 10) / 10)
    );
    setWeightInput(String(next));
  };

  const parsedWeight = Number.parseFloat(weightInput.replace(',', '.'));
  const targetWeight =
    profileData?.user?.targetWeight && profileData.user.targetWeight > 0
      ? profileData.user.targetWeight
      : user?.targetWeight && user.targetWeight > 0
        ? user.targetWeight
        : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(parsedWeight) || parsedWeight < MIN_WEIGHT_KG || parsedWeight > MAX_WEIGHT_KG) {
      setError(`Ingresa un peso válido entre ${MIN_WEIGHT_KG} y ${MAX_WEIGHT_KG} kg.`);
      return;
    }

    const roundedWeight = Math.round(parsedWeight * 10) / 10;
    setIsSaving(true);
    setError(null);

    try {
      let savedInChallengeLog = false;

      if (isActive) {
        if (!useChallengeStore.getState().logs[selectedDate] && selectedDate === todayStr) {
          await checkDailyReset().catch(() => {});
        }

        if (useChallengeStore.getState().logs[selectedDate]) {
          await logDailyMetrics(selectedDate, { weight: roundedWeight });
          savedInChallengeLog = true;
        }
      }

      if (!savedInChallengeLog) {
        await userService.updateProfile({ weight: roundedWeight });
        updateProfile({ weight: roundedWeight });
        applyOptimisticProfilePatch({ weight: roundedWeight });
      }

      void fetchProfileBundle(selectedDate);
      toast.success('Peso registrado');
      onSaved?.();
      onClose();
    } catch {
      toast.error('No se pudo guardar el peso.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="mobile-sheet-root fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weight-modal-title"
      onClick={onClose}
    >
      <div
        className="mobile-sheet-panel relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-900/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
              <Scale className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-400">
                Seguimiento corporal
              </p>
              <h2
                id="weight-modal-title"
                className="mt-0.5 text-lg font-bold text-white"
              >
                Registrar peso
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar registro de peso"
            onClick={onClose}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5">
          {/* Weight Input + Quick Steppers */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="weight-modal-input" className="text-xs font-semibold text-zinc-400">
                Peso (kg)
              </label>
              {targetWeight !== null && (
                <span className="text-xs font-medium text-zinc-400 tabular-nums">
                  Meta: <span className="text-zinc-200">{targetWeight} kg</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                id="weight-modal-input"
                type="number"
                inputMode="decimal"
                min={MIN_WEIGHT_KG}
                max={MAX_WEIGHT_KG}
                step="0.1"
                placeholder={fallbackWeight ? String(fallbackWeight) : '70.0'}
                value={weightInput}
                onChange={(e) => {
                  setWeightInput(e.target.value);
                  setError(null);
                }}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-center text-3xl font-bold tracking-tight text-white tabular-nums placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              <span className="shrink-0 text-sm font-semibold text-zinc-400">kg</span>
            </div>

            {/* Quick Step Buttons */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[-0.5, -0.1, 0.1, 0.5].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => stepWeight(delta)}
                  aria-label={`${delta < 0 ? 'Restar' : 'Sumar'} ${Math.abs(delta).toFixed(1)} kg`}
                  className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/70 text-xs font-bold text-zinc-200 tabular-nums transition-colors hover:border-zinc-700 hover:bg-zinc-800 active:scale-95"
                >
                  {delta < 0 ? (
                    <Minus className="h-3 w-3 text-rose-400" aria-hidden="true" />
                  ) : (
                    <Plus className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                  )}
                  <span>{Math.abs(delta).toFixed(1)}</span>
                </button>
              ))}
            </div>

            {error && (
              <p role="alert" className="mt-2 text-xs font-medium text-rose-400">
                {error}
              </p>
            )}
          </div>

          {/* Date selector */}
          <div>
            <label
              htmlFor="weight-modal-date"
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-400"
            >
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Fecha
            </label>
            <input
              id="weight-modal-date"
              type="date"
              max={todayStr}
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm font-medium text-white focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 flex-1 cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition-colors hover:bg-rose-400 disabled:opacity-60 active:scale-95"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>{isSaving ? 'Guardando...' : 'Guardar peso'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

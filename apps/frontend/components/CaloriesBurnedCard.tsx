'use client';

import { Plus, Footprints, CheckCircle2 } from 'lucide-react';

interface CaloriesBurnedCardProps {
  caloriesBurned: number;
  goalReached: number;
  steps: number;
  onPressAdd: () => void;
  className?: string;
}

/**
 * Tarjeta "Calorías por quemar" estilo Bitepal.
 * Muestra calorías quemadas, pasos y meta alcanzada con ícono de zapatilla verde.
 */
export default function CaloriesBurnedCard({
  caloriesBurned,
  goalReached,
  steps,
  onPressAdd,
  className,
}: CaloriesBurnedCardProps) {
  const metaAlcanzada = goalReached > 0;

  return (
    <section
      aria-label="Calorías por quemar"
      className={`rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-3.5 ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="tabular-nums">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">Calorías por quemar</p>
          <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[28px] font-bold leading-none tracking-[-0.03em] text-[var(--text-primary)]">
              {caloriesBurned}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onPressAdd}
          aria-label="Agregar actividad"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--surface-inset)] border border-[var(--divider)]">
        <div>
          <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.04em]">Pasos</p>
          <span className="text-[18px] font-bold text-[var(--text-primary)] tabular-nums">{steps.toLocaleString()}</span>
        </div>
        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--status-success)] text-white shadow-[0_4px_12px_rgba(34,197,94,0.35)]"
        >
          <Footprints className="h-5 w-5" />
        </div>
      </div>

      {metaAlcanzada ? (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-[var(--divider)] bg-[var(--surface-inset)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" aria-hidden="true" />
            <span className="text-[12px] font-semibold text-[var(--status-success)]">
              Meta alcanzada: {goalReached} kcal
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

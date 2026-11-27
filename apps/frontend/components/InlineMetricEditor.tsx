'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, Minus, Pencil, Plus, RotateCcw } from 'lucide-react';
import {
  formatMetricReadout,
  getSmartStep,
  roundDynamicValue,
} from '@/lib/utils/goalInference';

interface InlineMetricEditorProps {
  currentValue: number;
  targetValue: number;
  targetUnit?: string | null;
  measurementType?: string;
  stepOverride?: number | null;
  disabled?: boolean;
  isCompleted?: boolean;
  isFailed?: boolean;
  onDelta: (delta: number) => void;
  onSetValue: (value: number) => void;
  compact?: boolean;
}

export default function InlineMetricEditor({
  currentValue,
  targetValue,
  targetUnit,
  measurementType,
  stepOverride,
  disabled = false,
  isCompleted = false,
  isFailed = false,
  onDelta,
  onSetValue,
  compact = false,
}: InlineMetricEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const safeTarget = targetValue > 0 ? targetValue : 1;
  const safeCurrent = Number.isFinite(currentValue) ? Math.max(0, currentValue) : 0;
  const pct = Math.min(100, Math.round((safeCurrent / safeTarget) * 100));
  const step =
    typeof stepOverride === 'number' && Number.isFinite(stepOverride) && stepOverride > 0
      ? stepOverride
      : getSmartStep(measurementType, safeTarget, targetUnit);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const openEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isFailed) return;
    setDraft(String(roundDynamicValue(safeCurrent)));
    setIsEditing(true);
  };

  const commitValue = (e?: React.FormEvent | React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const parsed = Number(draft.replace(',', '.').trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetValue(roundDynamicValue(parsed));
    }
    setIsEditing(false);
  };

  const handleQuickComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetValue(safeTarget);
    setIsEditing(false);
  };

  const handleQuickReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetValue(0);
    setIsEditing(false);
  };

  return (
    <div
      className={
        compact
          ? 'mt-2.5 space-y-2'
          : 'mt-3 pt-2.5 border-t border-[var(--divider)] space-y-2'
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress bar with guaranteed contrast in both Light and Dark themes */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="flex-1 min-w-0 h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--progress-track, rgba(148,163,184,0.22))' }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${pct}%`,
              backgroundColor: isFailed
                ? 'var(--status-danger, #ef4444)'
                : isCompleted
                  ? 'var(--status-success, #10b981)'
                  : 'var(--accent-fill, #f43f5e)',
            }}
          />
        </div>
        <span
          className="text-xs font-bold tabular-nums shrink-0"
          style={{ color: isCompleted ? 'var(--status-success, #10b981)' : 'var(--text-muted)' }}
        >
          {pct}%
        </span>
      </div>

      {/* Interactive controls */}
      {isEditing ? (
        <form
          onSubmit={commitValue}
          className="flex flex-wrap items-center gap-1.5 min-w-0"
        >
          <div
            className="flex items-center gap-1 flex-1 min-w-[110px] rounded-xl border px-2.5 py-1.5"
            style={{
              backgroundColor: 'var(--surface-inset)',
              borderColor: 'var(--accent-fill, #e11d48)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setIsEditing(false);
                }
              }}
              aria-label="Ingresar valor actual"
              className="w-full min-w-0 bg-transparent text-xs font-semibold tabular-nums focus:outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {targetUnit && (
              <span
                className="text-[11px] font-medium shrink-0 max-w-[64px] truncate"
                style={{ color: 'var(--text-muted)' }}
              >
                {targetUnit}
              </span>
            )}
          </div>
          <button
            type="submit"
            aria-label="Confirmar valor"
            className="min-h-[34px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-opacity hover:opacity-90 cursor-pointer shrink-0"
            style={{
              backgroundColor: 'var(--accent-fill, #e11d48)',
              color: 'var(--on-accent, #ffffff)',
            }}
          >
            <Check className="w-3.5 h-3.5" />
            OK
          </button>
          <button
            type="button"
            onClick={handleQuickComplete}
            aria-label="Completar objetivo"
            className="min-h-[34px] px-2.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer shrink-0"
            style={{
              backgroundColor: 'var(--surface-inset)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            100%
          </button>
          {safeCurrent > 0 && (
            <button
              type="button"
              onClick={handleQuickReset}
              aria-label="Reiniciar a cero"
              className="min-h-[34px] min-w-[34px] rounded-xl border inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
              style={{
                backgroundColor: 'var(--surface-inset)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={openEditor}
            disabled={disabled || isFailed}
            title="Tocar para ingresar un valor exacto"
            className="group/val inline-flex items-center gap-1.5 min-h-[32px] min-w-0 max-w-full text-left rounded-lg border border-transparent hover:border-[var(--border-subtle)] px-2 py-1 -ml-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
            style={{ backgroundColor: 'transparent' }}
          >
            <span
              className="text-xs font-bold tabular-nums truncate"
              style={{
                color: isCompleted ? 'var(--status-success, #10b981)' : 'var(--text-primary)',
              }}
            >
              {formatMetricReadout(safeCurrent, safeTarget, targetUnit)}
            </span>
            {!disabled && !isFailed && (
              <Pencil
                className="w-3 h-3 shrink-0 opacity-70 group-hover/val:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
              />
            )}
          </button>

          {!disabled && !isFailed && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelta(-step);
                }}
                disabled={safeCurrent <= 0}
                aria-label={`Restar ${step}`}
                className="min-h-[34px] min-w-[34px] px-2 rounded-xl border inline-flex items-center justify-center transition-transform active:scale-95 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--surface-inset)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelta(step);
                }}
                aria-label={`Sumar ${step}`}
                className="min-h-[34px] min-w-[34px] px-2.5 rounded-xl border text-xs font-bold tabular-nums inline-flex items-center justify-center gap-0.5 transition-transform active:scale-95 cursor-pointer bg-rose-500/15 border-rose-500/35 text-rose-600 dark:text-rose-300 hover:bg-rose-500/25"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                {step !== 1 && <span>{step >= 1000 ? `${step / 1000}k` : step}</span>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

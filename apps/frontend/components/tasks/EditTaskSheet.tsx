'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Book,
  Brain,
  Camera,
  Droplet,
  Dumbbell,
  HeartPulse,
  Sun,
  Target,
  Utensils,
  X,
} from 'lucide-react';
import {
  formatMetricValue,
  getSmartStep,
  getStepPresets,
  parseFlexibleNumber,
  roundDynamicValue,
} from '@/lib/utils/goalInference';
import type { GoalMeasurementType } from '@/store/useChallengeStore';
import type { ContextTaskTarget, TaskEditPatch } from './taskTemplates';

const ICON_OPTIONS = [
  { id: 'target', label: 'Meta', Icon: Target },
  { id: 'dumbbell', label: 'Entreno', Icon: Dumbbell },
  { id: 'droplet', label: 'Agua', Icon: Droplet },
  { id: 'utensils', label: 'Comida', Icon: Utensils },
  { id: 'book', label: 'Lectura', Icon: Book },
  { id: 'sun', label: 'Hábito', Icon: Sun },
  { id: 'brain', label: 'Mente', Icon: Brain },
  { id: 'heart', label: 'Salud', Icon: HeartPulse },
  { id: 'camera', label: 'Foto', Icon: Camera },
] as const;

export interface EditTaskSheetProps {
  open: boolean;
  task: ContextTaskTarget | null;
  isBasePlan: boolean;
  planName: string;
  stepOverride?: number | null;
  onClose: () => void;
  onSave: (
    task: ContextTaskTarget,
    patch: TaskEditPatch,
    nextStepOverride: number | null
  ) => Promise<void>;
}

export default function EditTaskSheet({
  open,
  task,
  isBasePlan,
  planName,
  stepOverride,
  onClose,
  onSave,
}: EditTaskSheetProps) {
  const reduceMotion = useReducedMotion();
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('target');
  const [measurementType, setMeasurementType] = useState<GoalMeasurementType>('boolean');
  const [targetValueInput, setTargetValueInput] = useState('1');
  const [targetUnit, setTargetUnit] = useState('');
  const [stepInput, setStepInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    const syncTimer = window.setTimeout(() => {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setIcon(task.icon || 'target');
      setMeasurementType(task.measurementType);
      setTargetValueInput(
        task.measurementType === 'boolean' ? '10' : String(roundDynamicValue(task.targetValue))
      );
      setTargetUnit(task.targetUnit ?? '');
      setStepInput(
        typeof stepOverride === 'number' && stepOverride > 0 ? String(stepOverride) : ''
      );
      setIsSaving(false);
    }, 0);

    const focusTimer = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 60);
    return () => {
      window.clearTimeout(syncTimer);
      window.clearTimeout(focusTimer);
    };
  }, [open, task, stepOverride]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const parsedTarget = parseFlexibleNumber(targetValueInput) ?? 1;
  const parsedStep = parseFlexibleNumber(stepInput);
  const effectiveStep =
    parsedStep && parsedStep > 0
      ? parsedStep
      : getSmartStep(measurementType, parsedTarget, targetUnit);
  const stepPresets = getStepPresets(measurementType, parsedTarget, targetUnit, effectiveStep);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const nextTarget =
        measurementType === 'boolean'
          ? 1
          : measurementType === 'count'
            ? Math.max(1, Math.round(parsedTarget))
            : Math.max(0.1, roundDynamicValue(parsedTarget));

      await onSave(
        task,
        {
          title: title.trim(),
          description: description.trim(),
          icon,
          measurementType,
          targetValue: nextTarget,
          targetUnit: measurementType === 'boolean' ? null : targetUnit.trim() || null,
        },
        measurementType === 'boolean'
          ? null
          : parsedStep && parsedStep > 0
            ? roundDynamicValue(parsedStep)
            : null
      );
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && task && (
        <div
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-task-sheet-title"
        >
          <motion.div
            className="fixed inset-0"
            style={{
              backgroundColor: 'var(--context-backdrop)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={
              reduceMotion
                ? { duration: 0.08 }
                : { type: 'spring', stiffness: 420, damping: 34 }
            }
            style={{
              borderColor: 'var(--context-menu-border)',
              boxShadow: 'var(--context-menu-shadow)',
            }}
            className="relative z-[141] w-full sm:max-w-md max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border bg-[var(--surface-card)]"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3.5">
              <h2
                id="edit-task-sheet-title"
                className="text-base font-bold text-[var(--text-primary)] tracking-tight"
              >
                Editar tarea
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="min-h-10 min-w-10 -mr-1.5 rounded-full inline-flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--context-menu-hover)] cursor-pointer"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-4 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
            >
              {isBasePlan && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/12 px-3 py-2.5 text-xs leading-snug text-amber-800 dark:text-amber-200">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    Al modificar una tarea de <strong>Plan {planName}</strong>, tu reto pasará a{' '}
                    <strong>Plan Custom</strong> conservando tu racha y registros.
                  </span>
                </div>
              )}

              {/* Título */}
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Título
                </span>
                <input
                  ref={titleInputRef}
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3.5 text-[16px] sm:text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                />
              </label>

              {/* Descripción */}
              <label className="block">
                <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Descripción
                </span>
                <input
                  type="text"
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcional"
                  className="w-full min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3.5 text-[16px] sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                />
              </label>

              {/* Ícono */}
              <div>
                <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Ícono
                </span>
                <div className="grid grid-cols-9 gap-1.5">
                  {ICON_OPTIONS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setIcon(id)}
                      aria-label={label}
                      aria-pressed={icon === id}
                      className={`min-h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                        icon === id
                          ? 'bg-rose-500/20 border-rose-500 text-rose-500'
                          : 'bg-[var(--surface-inset)] border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon size={17} strokeWidth={1.75} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de medición */}
              <div>
                <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Tipo de medición
                </span>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--surface-inset)] p-1 border border-[var(--border-subtle)]">
                  {(
                    [
                      { id: 'boolean', label: 'Sí / No' },
                      { id: 'count', label: 'Contador' },
                      { id: 'numeric', label: 'Numérico' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMeasurementType(opt.id)}
                      className={`min-h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        measurementType === opt.id
                          ? 'bg-rose-500 text-[var(--on-accent)] shadow-sm'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meta, Unidad y Factor de aumento */}
              {measurementType !== 'boolean' && (
                <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                        Meta
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={targetValueInput}
                        onChange={(e) => setTargetValueInput(e.target.value)}
                        className="w-full min-h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-[16px] sm:text-sm font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                        Unidad
                      </span>
                      <input
                        type="text"
                        value={targetUnit}
                        onChange={(e) => setTargetUnit(e.target.value)}
                        placeholder="L, pasos, págs"
                        className="w-full min-h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-[16px] sm:text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                      />
                    </label>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">
                      Factor de aumento (±)
                    </span>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {stepPresets.map((preset) => {
                        const isSelected = Math.abs(effectiveStep - preset) < 1e-6;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setStepInput(String(preset))}
                            className={`min-h-8 px-2.5 rounded-lg text-xs font-bold tabular-nums border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-600 dark:text-rose-300'
                                : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-rose-500/40'
                            }`}
                          >
                            ±{formatMetricValue(preset)}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={stepInput}
                      onChange={(e) => setStepInput(e.target.value)}
                      placeholder={`Automático (±${formatMetricValue(getSmartStep(measurementType, parsedTarget, targetUnit))})`}
                      aria-label="Factor de aumento personalizado"
                      className="w-full min-h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-[16px] sm:text-sm font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* Footer buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] text-sm font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || isSaving}
                  className="min-h-11 rounded-xl bg-rose-500 text-[var(--on-accent)] text-sm font-bold hover:bg-rose-400 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

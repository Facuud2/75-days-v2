'use client';

import React, { useEffect, useState } from 'react';
import {
  Brain,
  BookOpen,
  Camera,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  GripVertical,
  HeartPulse,
  Plus,
  Sparkles,
  Sun,
  Utensils,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';
import type { GoalCadence, GoalMeasurementType } from '@/store/useChallengeStore';
import { inferGoalMeasurement, UNIT_PRESETS } from '@/lib/utils/goalInference';

export type CustomTask = {
  id: string;
  title: string;
  description: string;
  icon: string;
  cadence?: GoalCadence;
  measurementType?: GoalMeasurementType;
  targetValue?: number;
  targetUnit?: string;
};

export const CADENCE_LABELS: Record<GoalCadence, string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  monthly: 'Mensual',
};

export const MEASUREMENT_LABELS: Record<GoalMeasurementType, string> = {
  boolean: 'Check',
  count: 'Veces',
  numeric: 'Cantidad',
};

export function formatTaskBadge(task: {
  cadence?: GoalCadence;
  measurementType?: GoalMeasurementType;
  targetValue?: number;
  targetUnit?: string | null;
}): string {
  const cadenceLabel = CADENCE_LABELS[task.cadence || 'daily'];
  const measurement = task.measurementType || 'boolean';
  if (measurement === 'boolean') return cadenceLabel;
  const value = task.targetValue ?? 1;
  const unit = (task.targetUnit || (measurement === 'count' ? 'veces' : '')).trim();
  return unit ? `${cadenceLabel} · ${value} ${unit}` : `${cadenceLabel} · ${value}`;
}

export const CUSTOM_ICON_OPTIONS = [
  { name: 'utensils', label: 'Alimentación', Icon: Utensils },
  { name: 'dumbbell', label: 'Ejercicio', Icon: Dumbbell },
  { name: 'droplet', label: 'Hidratación', Icon: Droplets },
  { name: 'book', label: 'Lectura', Icon: BookOpen },
  { name: 'camera', label: 'Fotos', Icon: Camera },
  { name: 'sun', label: 'Exterior', Icon: Sun },
  { name: 'brain', label: 'Mentalidad', Icon: Brain },
  { name: 'heart', label: 'Bienestar', Icon: HeartPulse },
];

export const DEFAULT_CUSTOM_TASKS: CustomTask[] = [
  {
    id: 'water',
    title: 'Agua (3.7L)',
    description: 'Beber al menos 3.7 litros de agua durante el día.',
    icon: 'droplet',
    cadence: 'daily',
    measurementType: 'numeric',
    targetValue: 3.7,
    targetUnit: 'L',
  },
  {
    id: 'reading',
    title: 'Lectura (10 págs)',
    description: 'Leer 10 páginas de cualquier libro.',
    icon: 'book',
    cadence: 'daily',
    measurementType: 'numeric',
    targetValue: 10,
    targetUnit: 'págs',
  },
  {
    id: 'workout',
    title: 'Entrenamiento 45m',
    description: 'Completar 5 sesiones de 45 minutos de actividad física por semana.',
    icon: 'dumbbell',
    cadence: 'weekly',
    measurementType: 'count',
    targetValue: 5,
    targetUnit: 'sesiones',
  },
];

export function getCustomTaskIcon(iconName: string) {
  return (
    CUSTOM_ICON_OPTIONS.find((option) => option.name === iconName)?.Icon ??
    Dumbbell
  );
}

export function createEmptyCustomTask(): CustomTask {
  return {
    id: `task-${Date.now()}`,
    title: '',
    description: '',
    icon: 'dumbbell',
    cadence: 'daily',
    measurementType: 'boolean',
    targetValue: 1,
    targetUnit: '',
  };
}

type CustomTaskEditorSheetProps = {
  isOpen: boolean;
  /** Render only the editor content inside a parent-owned dialog shell. */
  embedded?: boolean;
  tasks: CustomTask[];
  onChange: (tasks: CustomTask[]) => void;
  onClose: () => void;
  breakStreakOnPeriodFail?: boolean;
  onChangeBreakStreak?: (value: boolean) => void;
};

export default function CustomTaskEditorSheet({
  isOpen,
  embedded = false,
  tasks,
  onChange,
  onClose,
  breakStreakOnPeriodFail = false,
  onChangeBreakStreak,
}: CustomTaskEditorSheetProps) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [openIconTaskId, setOpenIconTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || embedded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, embedded, onClose]);

  const patchTask = (id: string, patch: Partial<CustomTask>) => {
    onChange(
      tasks.map((task) => (task.id === id ? { ...task, ...patch } : task))
    );
  };

  const dropTask = (targetId: string) => {
    if (!draggedTaskId || draggedTaskId === targetId) return;
    const from = tasks.findIndex((t) => t.id === draggedTaskId);
    const to = tasks.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...tasks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setDraggedTaskId(null);
  };

  const hasPeriodTasks = tasks.some(
    (t) => t.cadence === 'weekly' || t.cadence === 'monthly'
  );

  const editorBody = (
    <div className="relative w-full h-full min-h-0 flex flex-col overflow-hidden">
            <header
              className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--accent-text)' }}
                >
                  Custom Challenge
                </p>
                <h2
                  id="custom-editor-title"
                  className="text-lg font-bold leading-snug mt-0.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Personalizá tus tareas
                </h2>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Definí si cada meta es diaria, semanal o mensual y cómo medirla.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--surface-inset)',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3">
              {tasks.map((task, index) => {
                const TaskIcon = getCustomTaskIcon(task.icon);
                const isIconOpen = openIconTaskId === task.id;
                const cadence: GoalCadence = task.cadence || 'daily';
                const measurementType: GoalMeasurementType =
                  task.measurementType || 'boolean';
                const targetValue = task.targetValue ?? 1;
                const targetUnit = task.targetUnit ?? '';

                return (
                  <article
                    key={task.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropTask(task.id)}
                    className="rounded-2xl border p-3.5 space-y-3"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-1.5"
                        style={{ color: 'var(--text-muted)' }}
                        draggable
                        onDragStart={() => setDraggedTaskId(task.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Arrastrar ${task.title || 'tarea'} para reordenar`}
                      >
                        <GripVertical
                          size={15}
                          className="cursor-grab active:cursor-grabbing"
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-bold uppercase tracking-wider">
                          Tarea {index + 1}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onChange(tasks.filter((t) => t.id !== task.id))
                        }
                        aria-label={`Eliminar ${task.title || 'tarea'}`}
                        className="h-8 w-8 rounded-lg flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                        style={{
                          touchAction: 'manipulation',
                          color: 'var(--status-danger)',
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenIconTaskId(isIconOpen ? null : task.id)
                          }
                          aria-label={`Cambiar icono de ${task.title || 'tarea'}`}
                          className="w-12 h-12 rounded-xl border flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--surface-card)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--accent-text)',
                          }}
                        >
                          <TaskIcon size={20} />
                        </button>

                        {isIconOpen && (
                          <div
                            className="absolute z-20 left-0 top-[calc(100%+6px)] grid grid-cols-4 gap-1 p-2 rounded-xl border shadow-xl w-44"
                            style={{
                              backgroundColor: 'var(--surface-card)',
                              borderColor: 'var(--border-subtle)',
                            }}
                          >
                            {CUSTOM_ICON_OPTIONS.map(({ name, label, Icon }) => (
                              <button
                                key={name}
                                type="button"
                                aria-label={label}
                                onClick={() => {
                                  patchTask(task.id, { icon: name });
                                  setOpenIconTaskId(null);
                                }}
                                className="p-2 rounded-lg flex items-center justify-center cursor-pointer"
                                style={{
                                  touchAction: 'manipulation',
                                  backgroundColor:
                                    task.icon === name
                                      ? 'var(--accent-fill)'
                                      : 'transparent',
                                  color:
                                    task.icon === name
                                      ? 'var(--on-accent)'
                                      : 'var(--text-muted)',
                                }}
                              >
                                <Icon size={16} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <input
                          value={task.title}
                          autoFocus={index === tasks.length - 1 && task.title === ''}
                          onChange={(e) =>
                            patchTask(task.id, { title: e.target.value })
                          }
                          aria-label="Nombre de la tarea"
                          placeholder="Nombre de la tarea"
                          className="w-full bg-transparent border-b pb-1 text-base font-semibold outline-none select-text"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <textarea
                          value={task.description}
                          onChange={(e) =>
                            patchTask(task.id, { description: e.target.value })
                          }
                          aria-label="Explicación de la tarea"
                          placeholder="Explicá qué hay que hacer..."
                          rows={2}
                          className="w-full resize-none bg-transparent text-xs leading-relaxed outline-none select-text"
                          style={{ color: 'var(--text-muted)' }}
                        />
                      </div>
                    </div>

                    {/* Cadencia y Medición (M2) */}
                    <div
                      className="pt-2.5 border-t space-y-2.5"
                      style={{ borderColor: 'var(--divider)' }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Selector de Cadencia */}
                        <div className="space-y-1">
                          <span
                            className="block text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Frecuencia
                          </span>
                          <div
                            className="grid grid-cols-3 gap-1 p-1 rounded-xl border"
                            style={{
                              backgroundColor: 'var(--surface-card)',
                              borderColor: 'var(--border-subtle)',
                            }}
                            role="group"
                            aria-label="Frecuencia de la tarea"
                          >
                            {(['daily', 'weekly', 'monthly'] as GoalCadence[]).map(
                              (opt) => {
                                const active = cadence === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => {
                                      const nextPatch: Partial<CustomTask> = {
                                        cadence: opt,
                                      };
                                      // Default weekly/monthly to count if switching from daily boolean
                                      if (
                                        opt !== 'daily' &&
                                        measurementType === 'boolean' &&
                                        cadence === 'daily'
                                      ) {
                                        nextPatch.measurementType = 'count';
                                        nextPatch.targetValue =
                                          opt === 'weekly' ? 3 : 4;
                                        nextPatch.targetUnit = 'veces';
                                      }
                                      patchTask(task.id, nextPatch);
                                    }}
                                    className="py-1.5 px-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                                    style={{
                                      touchAction: 'manipulation',
                                      backgroundColor: active
                                        ? 'var(--accent-fill)'
                                        : 'transparent',
                                      color: active
                                        ? 'var(--on-accent)'
                                        : 'var(--text-muted)',
                                    }}
                                  >
                                    {CADENCE_LABELS[opt]}
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>

                        {/* Selector de Medición */}
                        <div className="space-y-1">
                          <span
                            className="block text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Medición
                          </span>
                          <div
                            className="grid grid-cols-3 gap-1 p-1 rounded-xl border"
                            style={{
                              backgroundColor: 'var(--surface-card)',
                              borderColor: 'var(--border-subtle)',
                            }}
                            role="group"
                            aria-label="Tipo de medición"
                          >
                            {(
                              ['boolean', 'count', 'numeric'] as GoalMeasurementType[]
                            ).map((opt) => {
                              const active = measurementType === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => {
                                    patchTask(task.id, {
                                      measurementType: opt,
                                      targetValue:
                                        opt === 'boolean'
                                          ? 1
                                          : targetValue > 1
                                            ? targetValue
                                            : opt === 'count'
                                              ? 3
                                              : 10,
                                      targetUnit:
                                        opt === 'boolean'
                                          ? ''
                                          : targetUnit ||
                                            (opt === 'count' ? 'veces' : 'km'),
                                    });
                                  }}
                                  className="py-1.5 px-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                                  style={{
                                    touchAction: 'manipulation',
                                    backgroundColor: active
                                      ? 'var(--accent-fill)'
                                      : 'transparent',
                                    color: active
                                      ? 'var(--on-accent)'
                                      : 'var(--text-muted)',
                                  }}
                                >
                                  {MEASUREMENT_LABELS[opt]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const suggestion = inferGoalMeasurement(task.title, task.description);
                        const shouldShowSuggestion =
                          suggestion &&
                          (measurementType === 'boolean' ||
                            suggestion.measurementType !== measurementType ||
                            suggestion.targetValue !== targetValue ||
                            (suggestion.targetUnit ?? '') !== targetUnit.trim() ||
                            suggestion.cadence !== cadence);
                        if (!shouldShowSuggestion) return null;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              patchTask(task.id, {
                                cadence: suggestion.cadence,
                                measurementType: suggestion.measurementType,
                                targetValue: suggestion.targetValue,
                                targetUnit: suggestion.targetUnit ?? '',
                              })
                            }
                            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer hover:opacity-90"
                            style={{
                              backgroundColor: 'var(--accent-soft, rgba(225,29,72,0.1))',
                              borderColor: 'var(--accent-fill)',
                              color: 'var(--accent-text)',
                            }}
                          >
                            <span className="flex items-center gap-1.5 min-w-0 truncate">
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                Detectado: {suggestion.targetValue}{' '}
                                {suggestion.targetUnit || ''} · {CADENCE_LABELS[suggestion.cadence]}
                              </span>
                            </span>
                            <span className="font-bold shrink-0">Aplicar</span>
                          </button>
                        );
                      })()}

                      {measurementType !== 'boolean' && (
                        <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span
                              className="block text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Meta objetivo
                            </span>
                            <input
                              type="number"
                              min={measurementType === 'count' ? 1 : 0.1}
                              step={measurementType === 'count' ? 1 : 'any'}
                              value={targetValue}
                              onChange={(e) => {
                                const parsed = parseFloat(e.target.value);
                                if (!Number.isNaN(parsed) && parsed > 0) {
                                  patchTask(task.id, {
                                    targetValue:
                                      measurementType === 'count'
                                        ? Math.max(1, Math.round(parsed))
                                        : parsed,
                                  });
                                }
                              }}
                              aria-label="Valor objetivo"
                              className="w-full rounded-xl border px-3 py-1.5 text-sm font-semibold tabular-nums outline-none"
                              style={{
                                backgroundColor: 'var(--surface-card)',
                                borderColor: 'var(--border-subtle)',
                                color: 'var(--text-primary)',
                              }}
                            />
                          </label>

                          <label className="space-y-1">
                            <span
                              className="block text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Unidad
                            </span>
                            <input
                              type="text"
                              maxLength={24}
                              value={targetUnit}
                              onChange={(e) =>
                                patchTask(task.id, {
                                  targetUnit: e.target.value,
                                })
                              }
                              placeholder={
                                measurementType === 'count'
                                  ? 'sesiones, veces...'
                                  : 'L, km, págs, min...'
                              }
                              aria-label="Unidad de medida"
                              className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none"
                              style={{
                                backgroundColor: 'var(--surface-card)',
                                borderColor: 'var(--border-subtle)',
                                color: 'var(--text-primary)',
                              }}
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {UNIT_PRESETS.slice(0, 10).map((preset) => {
                            const isSelected = targetUnit.trim().toLowerCase() === preset.unit.toLowerCase();
                            return (
                              <button
                                key={preset.unit}
                                type="button"
                                onClick={() =>
                                  patchTask(task.id, {
                                    measurementType: preset.measurementType,
                                    targetUnit: preset.unit,
                                    targetValue:
                                      targetValue > 1 ? targetValue : preset.defaultTarget,
                                  })
                                }
                                className="px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap"
                                style={{
                                  backgroundColor: isSelected
                                    ? 'var(--accent-fill)'
                                    : 'var(--surface-card)',
                                  borderColor: isSelected
                                    ? 'var(--accent-fill)'
                                    : 'var(--border-subtle)',
                                  color: isSelected
                                    ? 'var(--on-accent)'
                                    : 'var(--text-muted)',
                                }}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              <button
                type="button"
                onClick={() => onChange([...tasks, createEmptyCustomTask()])}
                className="w-full min-h-[44px] rounded-2xl border border-dashed flex items-center justify-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98] cursor-pointer"
                style={{
                  touchAction: 'manipulation',
                  borderColor: 'var(--border-control)',
                  color: 'var(--accent-text)',
                }}
              >
                <Plus size={15} />
                Añadir tarea
              </button>

              {onChangeBreakStreak && hasPeriodTasks && (
                <label
                  className="flex items-start justify-between gap-3 rounded-2xl border p-3.5 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Flame
                      size={17}
                      className="shrink-0 mt-0.5 text-amber-400"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <span
                        className="block text-xs font-bold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        Modo estricto en metas semanales/mensuales
                      </span>
                      <span
                        className="block text-[11px] leading-snug mt-0.5"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Si cierra la semana o el mes sin cumplirlas, reiniciar la
                        racha global.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={breakStreakOnPeriodFail}
                    onChange={(e) => onChangeBreakStreak(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-rose-500 cursor-pointer shrink-0"
                  />
                </label>
              )}
            </div>

            <footer
              className="shrink-0 px-5 py-4 border-t pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
              style={{ borderColor: 'var(--divider)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[46px] px-5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--accent-fill)',
                  color: 'var(--on-accent)',
                }}
              >
                <Check size={17} strokeWidth={2.5} />
                Listo
              </button>
            </footer>
    </div>
  );

  if (embedded) {
    return isOpen ? editorBody : null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-editor-title"
          onClick={(event) => event.stopPropagation()}
        >
          <motion.button
            type="button"
            aria-label="Cerrar editor personalizado"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          <motion.div
            initial={
              reduceMotion
                ? { opacity: 0 }
                : isDesktop
                  ? { opacity: 0, y: 20, scale: 0.96 }
                  : { y: '100%' }
            }
            animate={
              reduceMotion
                ? { opacity: 1 }
                : isDesktop
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { y: 0 }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : isDesktop
                  ? { opacity: 0, y: 12, scale: 0.96, transition: SHEET_EXIT_TRANSITION }
                  : { y: '100%', transition: SHEET_EXIT_TRANSITION }
            }
            transition={reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING}
            drag={!isDesktop ? 'y' : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.42 }}
            dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
            onDragEnd={(_, info) => {
              if (shouldDismissSheet(info.offset.y, info.velocity.y)) onClose();
            }}
            className="relative w-full max-w-lg max-h-[88dvh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border shadow-2xl"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {!isDesktop && (
              <div
                className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 cursor-grab touch-none rounded-full bg-[var(--border-control)]/50 active:cursor-grabbing sm:hidden"
                aria-hidden="true"
                onPointerDown={(event) => dragControls.start(event)}
              />
            )}
            {editorBody}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

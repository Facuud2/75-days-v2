'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pencil,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Trash2,
  AlertTriangle,
  Utensils,
  Dumbbell,
  Sun,
  Droplet,
  Book,
  Camera,
  Brain,
  HeartPulse,
} from 'lucide-react';
import InlineMetricEditor from '@/components/InlineMetricEditor';
import {
  formatMetricValue,
  getSmartStep,
  getStepPresets,
  parseFlexibleNumber,
  roundDynamicValue,
} from '@/lib/utils/goalInference';
import type { GoalMeasurementType } from '@/store/useChallengeStore';
import {
  computeContextMenuLayout,
  type ContextTaskTarget,
  type SimpleRect,
} from './taskTemplates';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  utensils: Utensils,
  dumbbell: Dumbbell,
  sun: Sun,
  droplet: Droplet,
  book: Book,
  camera: Camera,
  brain: Brain,
  heart: HeartPulse,
  target: Target,
};

type MenuView = 'main' | 'increment' | 'confirm-delete';

export interface TaskContextMenuProps {
  open: boolean;
  task: ContextTaskTarget | null;
  anchorRect: SimpleRect | null;
  isBasePlan: boolean;
  planName: string;
  canDelete: boolean;
  stepOverride?: number | null;
  onClose: () => void;
  onToggleComplete: (task: ContextTaskTarget) => void;
  onDeltaProgress: (task: ContextTaskTarget, delta: number) => void;
  onSetProgress: (task: ContextTaskTarget, value: number) => void;
  onChangeStepOverride: (task: ContextTaskTarget, step: number | null) => void;
  onQuickChangeMeasurement: (
    task: ContextTaskTarget,
    next: {
      measurementType: GoalMeasurementType;
      targetValue: number;
      targetUnit: string | null;
      stepOverride?: number | null;
    }
  ) => Promise<void>;
  onRequestEdit: (task: ContextTaskTarget) => void;
  onConfirmDelete: (task: ContextTaskTarget) => Promise<void>;
}

export default function TaskContextMenu({
  open,
  task,
  anchorRect,
  isBasePlan,
  planName,
  canDelete,
  stepOverride,
  onClose,
  onToggleComplete,
  onDeltaProgress,
  onSetProgress,
  onChangeStepOverride,
  onQuickChangeMeasurement,
  onRequestEdit,
  onConfirmDelete,
}: TaskContextMenuProps) {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<MenuView>('main');
  const [showProgressFocus, setShowProgressFocus] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Sub-panel "Factor de aumento y tipo"
  const [draftType, setDraftType] = useState<GoalMeasurementType>('boolean');
  const [draftTarget, setDraftTarget] = useState('1');
  const [draftUnit, setDraftUnit] = useState('');
  const [customStepInput, setCustomStepInput] = useState('');

  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 375,
    h: typeof window !== 'undefined' ? window.innerHeight : 812,
  });

  const menuRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Sincronizar estado interno al abrir o cambiar de tarea
  useEffect(() => {
    if (!open || !task) return;
    setView('main');
    setShowProgressFocus(false);
    setIsBusy(false);
    setDraftType(task.measurementType);
    setDraftTarget(
      task.measurementType === 'boolean' ? '10' : String(roundDynamicValue(task.targetValue))
    );
    setDraftUnit(task.targetUnit ?? '');
    setCustomStepInput('');
  }, [open, task?.id]);

  // Actualizar dimensiones del viewport al abrir / resize
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const syncViewport = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, [open]);

  // Bloqueo de scroll, Escape, navegación con flechas y restauración de foco
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      firstItem?.focus();
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (view !== 'main') {
          setView('main');
        } else {
          onClose();
        }
        return;
      }

      if (view === 'main' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []
        );
        if (items.length === 0) return;
        e.preventDefault();
        const activeIdx = items.indexOf(document.activeElement as HTMLElement);
        const nextIdx =
          e.key === 'ArrowDown'
            ? (activeIdx + 1 + items.length) % items.length
            : (activeIdx - 1 + items.length) % items.length;
        items[nextIdx]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, view, onClose]);

  const isQuantified = task ? task.measurementType !== 'boolean' : false;
  const activeStep = task
    ? typeof stepOverride === 'number' && stepOverride > 0
      ? stepOverride
      : getSmartStep(task.measurementType, task.targetValue, task.targetUnit)
    : 1;

  const stepSummaryLabel = task
    ? task.measurementType === 'boolean'
      ? 'Sí / No'
      : `±${formatMetricValue(activeStep)}${task.targetUnit ? ` ${task.targetUnit}` : ''}`
    : '';

  const draftTargetNum = parseFlexibleNumber(draftTarget) ?? (task?.targetValue || 1);
  const effectiveDraftStep =
    draftType === 'count'
      ? typeof stepOverride === 'number' && Number.isInteger(stepOverride) && stepOverride >= 1
        ? stepOverride
        : 1
      : typeof stepOverride === 'number' && stepOverride > 0
        ? stepOverride
        : getSmartStep(draftType, draftTargetNum, draftUnit || task?.targetUnit);

  const stepPresets = task
    ? getStepPresets(
        draftType,
        draftTargetNum,
        draftUnit || task.targetUnit,
        draftType === 'count' && !Number.isInteger(effectiveDraftStep)
          ? 1
          : effectiveDraftStep
      )
    : [1, 2, 5, 10];

  const hasTypeOrTargetChange = Boolean(
    task &&
      (draftType !== task.measurementType ||
        (draftType !== 'boolean' &&
          (Math.abs(draftTargetNum - task.targetValue) > 1e-6 ||
            (draftUnit.trim() || null) !== (task.targetUnit?.trim() || null))))
  );

  const estimatedMenuHeight =
    view === 'increment'
      ? draftType === 'boolean'
        ? hasTypeOrTargetChange
          ? 248
          : 150
        : hasTypeOrTargetChange && isBasePlan
          ? 430
          : hasTypeOrTargetChange
            ? 370
            : 318
      : view === 'confirm-delete'
        ? isBasePlan
          ? 220
          : 150
        : 244;

  const layout = useMemo(() => {
    if (!anchorRect) return null;
    return computeContextMenuLayout({
      anchorRect,
      viewportWidth: viewport.w,
      viewportHeight: viewport.h,
      estimatedMenuHeight,
      matchCardWidth: view !== 'main',
      safeTop: 18,
      safeBottom: 24,
    });
  }, [anchorRect, viewport.w, viewport.h, estimatedMenuHeight, view]);

  if (typeof document === 'undefined') return null;

  const handleApplyStepChip = (step: number) => {
    if (!task) return;
    setCustomStepInput('');
    if (!hasTypeOrTargetChange && task.measurementType !== 'boolean') {
      onChangeStepOverride(task, step);
      onClose();
      return;
    }
    onChangeStepOverride(task, step);
  };

  const handleApplyCustomStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    const parsed = parseFlexibleNumber(customStepInput);
    if (!parsed || parsed <= 0) return;
    onChangeStepOverride(task, roundDynamicValue(parsed));
    setCustomStepInput('');
    if (!hasTypeOrTargetChange && task.measurementType !== 'boolean') {
      onClose();
    }
  };

  const handleSaveMeasurementChange = async () => {
    if (!task || isBusy) return;
    setIsBusy(true);
    try {
      const parsedStep = parseFlexibleNumber(customStepInput);
      const nextTarget =
        draftType === 'boolean'
          ? 1
          : draftType === 'count'
            ? Math.max(1, Math.round(draftTargetNum))
            : Math.max(0.1, roundDynamicValue(draftTargetNum));
      await onQuickChangeMeasurement(task, {
        measurementType: draftType,
        targetValue: nextTarget,
        targetUnit: draftType === 'boolean' ? null : draftUnit.trim() || null,
        stepOverride: parsedStep && parsedStep > 0 ? roundDynamicValue(parsedStep) : undefined,
      });
      onClose();
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmDeleteClick = async () => {
    if (!task || isBusy || !canDelete) return;
    setIsBusy(true);
    try {
      await onConfirmDelete(task);
      onClose();
    } finally {
      setIsBusy(false);
    }
  };

  const IconComponent = task ? ICON_MAP[task.icon || 'target'] || Target : Target;

  const springTransition = reduceMotion
    ? { duration: 0.08 }
    : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.85 };

  const menuSpring = reduceMotion
    ? { duration: 0.08 }
    : { type: 'spring' as const, stiffness: 460, damping: 33, mass: 0.72 };

  return createPortal(
    <AnimatePresence>
      {open && task && layout && (
        <motion.div
          key={`task-context-menu-${task.id}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduceMotion ? 0.08 : 0.16 } }}
          className="fixed inset-0 z-[130]"
          role="dialog"
          aria-modal="true"
          aria-label={`Opciones para ${task.title}`}
        >
          {/* Scrim sutil estilo WhatsApp iOS: oscurece sin lavar el fondo para que el vidrio líquido refracte el contenido */}
          <motion.div
            className="fixed inset-0"
            style={{
              backgroundColor: 'var(--context-backdrop)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Tarjeta destacada y elevada */}
          <motion.div
            initial={
              reduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0.96,
                    scale: 0.98,
                    y: anchorRect ? anchorRect.top - layout.cardTop : 0,
                  }
            }
            animate={{
              opacity: 1,
              scale: reduceMotion ? 1 : 1.015,
              y: 0,
            }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={springTransition}
            style={{
              position: 'fixed',
              top: layout.cardTop,
              left: layout.cardLeft,
              width: layout.cardWidth,
              transformOrigin: 'center center',
              backgroundColor: 'var(--surface-card)',
              boxShadow: 'var(--context-card-shadow)',
            }}
            className="z-[131] rounded-[22px] px-3.5 py-3 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  task.completed
                    ? task.kind === 'period'
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'bg-rose-500/20 text-rose-500'
                    : task.cadence === 'monthly'
                      ? 'bg-violet-500/15 text-violet-500 dark:text-violet-300'
                      : task.cadence === 'weekly'
                        ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
                        : 'bg-[var(--surface-inset)] text-rose-500'
                }`}
              >
                <IconComponent size={18} strokeWidth={1.7} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className={`font-semibold text-[15px] leading-snug sm:text-base ${
                      task.completed
                        ? 'text-[var(--text-secondary)] line-through'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {task.title}
                  </h3>
                  {task.kind === 'period' && task.periodNumber && (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        task.cadence === 'monthly'
                          ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300'
                          : 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                      }`}
                    >
                      {task.cadence === 'monthly'
                        ? `Mes ${task.periodNumber}`
                        : `Sem ${task.periodNumber}`}
                    </span>
                  )}
                </div>
                {task.description ? (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                    {task.description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onToggleComplete(task)}
                disabled={task.isFailed}
                aria-label={task.completed ? 'Desmarcar tarea' : 'Completar tarea'}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-90 ${
                  task.completed
                    ? task.kind === 'period'
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'bg-rose-500 border-rose-500 shadow-[0_0_14px_var(--color-rose-500)]'
                    : 'border-rose-500/45 hover:border-rose-500'
                }`}
              >
                {task.completed && (
                  <Check size={14} className="text-[var(--on-accent)]" strokeWidth={3} />
                )}
              </button>
            </div>

            {(isQuantified || showProgressFocus) && (
              <div className="mt-2.5">
                <InlineMetricEditor
                  currentValue={task.currentValue}
                  targetValue={task.targetValue}
                  targetUnit={task.targetUnit}
                  measurementType={task.measurementType}
                  stepOverride={stepOverride}
                  isCompleted={task.completed}
                  isFailed={task.isFailed}
                  compact
                  onDelta={(delta) => onDeltaProgress(task, delta)}
                  onSetValue={(val) => onSetProgress(task, val)}
                />
              </div>
            )}
          </motion.div>

          {/* Menú contextual inferior estilo WhatsApp iOS Liquid Glass (100% tokens semánticos) */}
          <motion.div
            ref={menuRef}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.9, y: -10 }
            }
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.93, y: -6 }}
            transition={menuSpring}
            style={{
              position: 'fixed',
              top: layout.menuTop,
              left: layout.menuLeft,
              width: layout.menuWidth,
              maxHeight: `calc(100dvh - ${layout.menuTop}px - env(safe-area-inset-bottom, 0px) - 16px)`,
              transformOrigin: 'top left',
              backgroundColor: 'var(--context-menu-bg)',
              backgroundImage: 'var(--context-menu-sheen)',
              borderColor: 'var(--context-menu-border)',
              boxShadow: 'var(--context-menu-shadow)',
              backdropFilter: 'blur(36px) saturate(200%)',
              WebkitBackdropFilter: 'blur(36px) saturate(200%)',
            }}
            className="z-[132] overflow-y-auto rounded-[28px] border transition-[width] duration-200 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {view === 'main' && (
              <div role="menu" aria-label="Acciones de tarea" className="p-2 flex flex-col gap-0.5">
                <button
                  type="button"
                  role="menuitem"
                  disabled={task.isFailed}
                  onClick={() => {
                    onToggleComplete(task);
                    onClose();
                  }}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-[18px] flex items-center gap-3 text-left text-[15.5px] font-[450] tracking-[-0.012em] text-[var(--text-primary)] hover:bg-[var(--context-menu-hover)] active:bg-[var(--context-menu-active)] active:scale-[0.985] focus-visible:outline-none focus-visible:bg-[var(--context-menu-hover)] transition-[background-color,transform] duration-150 cursor-pointer disabled:opacity-40"
                >
                  {task.completed ? (
                    <RotateCcw
                      size={19}
                      strokeWidth={1.65}
                      style={{ color: 'var(--context-menu-icon)' }}
                      className="shrink-0"
                    />
                  ) : (
                    <Check
                      size={19}
                      strokeWidth={1.85}
                      style={{ color: 'var(--context-menu-icon)' }}
                      className="shrink-0"
                    />
                  )}
                  <span className="flex-1 truncate">
                    {task.completed ? 'Marcar pendiente' : 'Completar'}
                  </span>
                </button>

                {isQuantified && !task.isFailed && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setShowProgressFocus(true)}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-[18px] flex items-center gap-3 text-left text-[15.5px] font-[450] tracking-[-0.012em] text-[var(--text-primary)] hover:bg-[var(--context-menu-hover)] active:bg-[var(--context-menu-active)] active:scale-[0.985] focus-visible:outline-none focus-visible:bg-[var(--context-menu-hover)] transition-[background-color,transform] duration-150 cursor-pointer"
                  >
                    <SlidersHorizontal
                      size={19}
                      strokeWidth={1.65}
                      style={{ color: 'var(--context-menu-icon)' }}
                      className="shrink-0"
                    />
                    <span className="flex-1 truncate">
                      {showProgressFocus ? 'Ajustá arriba' : 'Marcar progreso'}
                    </span>
                    <span
                      style={{
                        backgroundColor: 'var(--context-menu-pill)',
                        color: 'var(--text-secondary)',
                      }}
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums shrink-0"
                    >
                      {Math.min(100, Math.round((task.currentValue / task.targetValue) * 100))}%
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView('increment')}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-[18px] flex items-center gap-3 text-left text-[15.5px] font-[450] tracking-[-0.012em] text-[var(--text-primary)] hover:bg-[var(--context-menu-hover)] active:bg-[var(--context-menu-active)] active:scale-[0.985] focus-visible:outline-none focus-visible:bg-[var(--context-menu-hover)] transition-[background-color,transform] duration-150 cursor-pointer"
                >
                  <Gauge
                    size={19}
                    strokeWidth={1.65}
                    style={{ color: 'var(--context-menu-icon)' }}
                    className="shrink-0"
                  />
                  <span className="flex-1 whitespace-nowrap">Factor y medición</span>
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <span
                      style={{
                        backgroundColor: 'var(--context-menu-pill)',
                        color: 'var(--text-secondary)',
                      }}
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums"
                    >
                      {stepSummaryLabel}
                    </span>
                    <ChevronRight size={15} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onClose();
                    onRequestEdit(task);
                  }}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-[18px] flex items-center gap-3 text-left text-[15.5px] font-[450] tracking-[-0.012em] text-[var(--text-primary)] hover:bg-[var(--context-menu-hover)] active:bg-[var(--context-menu-active)] active:scale-[0.985] focus-visible:outline-none focus-visible:bg-[var(--context-menu-hover)] transition-[background-color,transform] duration-150 cursor-pointer"
                >
                  <Pencil
                    size={19}
                    strokeWidth={1.65}
                    style={{ color: 'var(--context-menu-icon)' }}
                    className="shrink-0"
                  />
                  <span className="flex-1 truncate">Editar tarea</span>
                </button>

                {/* Separador hairline inset estilo WhatsApp iOS antes de acción destructiva */}
                <div
                  className="mx-3 my-1 h-px"
                  style={{ backgroundColor: 'var(--context-menu-divider)' }}
                  aria-hidden="true"
                />

                <button
                  type="button"
                  role="menuitem"
                  disabled={!canDelete}
                  onClick={() => setView('confirm-delete')}
                  style={{ color: 'var(--context-danger)' }}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-[18px] flex items-center gap-3 text-left text-[15.5px] font-[450] tracking-[-0.012em] hover:bg-[var(--context-danger-hover)] active:bg-[var(--context-danger-hover)] active:scale-[0.985] focus-visible:outline-none focus-visible:bg-[var(--context-danger-hover)] transition-[background-color,transform] duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={19} strokeWidth={1.65} className="shrink-0" />
                  <span className="flex-1 truncate">Eliminar</span>
                </button>
              </div>
            )}

            {view === 'increment' && (
              <div className="p-4 pt-3 space-y-3">
                <div
                  className="flex items-center gap-1.5 pb-2.5 border-b"
                  style={{
                    borderColor: 'var(--context-menu-divider)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setView('main')}
                    aria-label="Volver al menú"
                    className="min-h-8 min-w-8 -ml-1 rounded-full inline-flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--context-menu-hover)] active:scale-95 transition-all cursor-pointer"
                  >
                    <ChevronLeft size={18} strokeWidth={1.8} />
                  </button>
                  <span className="text-[15px] font-semibold tracking-[-0.012em] text-[var(--text-primary)]">
                    Factor y medición
                  </span>
                </div>

                {/* Tipo de medición */}
                <div
                  className="grid grid-cols-3 gap-1 rounded-xl p-1"
                  style={{ backgroundColor: 'var(--surface-raised)' }}
                >
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
                      onClick={() => setDraftType(opt.id)}
                      className={`min-h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        draftType === opt.id
                          ? 'bg-rose-500 text-[var(--on-accent)] shadow-sm'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Meta y unidad si pasa a cuantitativa o cambia objetivo */}
                {draftType !== 'boolean' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                          Meta
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draftTarget}
                          onChange={(e) => setDraftTarget(e.target.value)}
                          style={{
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-subtle)',
                          }}
                          className="w-full min-h-9 rounded-xl border px-2.5 text-[16px] sm:text-sm font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                          Unidad
                        </span>
                        <input
                          type="text"
                          value={draftUnit}
                          onChange={(e) => setDraftUnit(e.target.value)}
                          placeholder="L, pasos..."
                          style={{
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-subtle)',
                          }}
                          className="w-full min-h-9 rounded-xl border px-2.5 text-[16px] sm:text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                        />
                      </label>
                    </div>

                    {/* Factor de aumento (±) */}
                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">
                        Incremento (±)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {stepPresets.map((preset) => {
                          const isSelected = Math.abs(effectiveDraftStep - preset) < 1e-6;
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleApplyStepChip(preset)}
                              style={
                                isSelected
                                  ? undefined
                                  : {
                                      backgroundColor: 'var(--surface-inset)',
                                      borderColor: 'var(--border-subtle)',
                                    }
                              }
                              className={`min-h-8 px-2.5 rounded-lg text-xs font-bold tabular-nums border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-500/18 border-rose-500/55 text-[var(--accent-text)]'
                                  : 'text-[var(--text-primary)] hover:border-rose-500/40'
                              }`}
                            >
                              ±{formatMetricValue(preset)}
                            </button>
                          );
                        })}
                      </div>

                      <form onSubmit={handleApplyCustomStep} className="mt-2 flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={customStepInput}
                          onChange={(e) => setCustomStepInput(e.target.value)}
                          placeholder="Otro incremento"
                          aria-label="Incremento personalizado"
                          style={{
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-subtle)',
                          }}
                          className="flex-1 min-w-0 min-h-9 rounded-xl border px-2.5 text-[16px] sm:text-xs font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                        />
                        <button
                          type="submit"
                          disabled={!parseFlexibleNumber(customStepInput)}
                          style={{
                            backgroundColor: 'var(--surface-raised)',
                            borderColor: 'var(--border-subtle)',
                          }}
                          className="min-h-9 px-3 rounded-xl border text-xs font-bold text-[var(--text-primary)] hover:opacity-90 disabled:opacity-40 cursor-pointer"
                        >
                          Aplicar
                        </button>
                      </form>
                    </div>
                  </>
                )}

                {hasTypeOrTargetChange && isBasePlan && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/12 px-2.5 py-2 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                    <span>
                      Cambiar la medición en Plan {planName} lo convierte a{' '}
                      <strong>Plan Custom</strong> sin perder tu racha.
                    </span>
                  </div>
                )}

                {hasTypeOrTargetChange && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleSaveMeasurementChange}
                    className="w-full min-h-10 rounded-xl bg-rose-500 text-[var(--on-accent)] text-sm font-bold hover:bg-rose-400 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isBusy ? 'Guardando...' : 'Guardar medición'}
                  </button>
                )}
              </div>
            )}

            {view === 'confirm-delete' && (
              <div className="p-4 pt-3 space-y-3.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setView('main')}
                    aria-label="Volver al menú"
                    className="min-h-8 min-w-8 -ml-1 rounded-full inline-flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--context-menu-hover)] active:scale-95 transition-all cursor-pointer"
                  >
                    <ChevronLeft size={18} strokeWidth={1.8} />
                  </button>
                  <span className="text-[15px] font-semibold tracking-[-0.012em] text-[var(--text-primary)]">
                    ¿Eliminar tarea?
                  </span>
                </div>

                {isBasePlan && (
                  <div className="flex items-start gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/12 px-3 py-2.5 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                    <span>
                      Eliminar una tarea de Plan {planName} pasará tu reto a{' '}
                      <strong>Plan Custom</strong> conservando tu racha y registros.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setView('main')}
                    style={{
                      backgroundColor: 'var(--context-menu-pill)',
                    }}
                    className="min-h-11 rounded-2xl text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--context-menu-hover)] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleConfirmDeleteClick}
                    className="min-h-11 rounded-2xl bg-red-600 text-[var(--on-accent)] text-sm font-semibold hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isBusy ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

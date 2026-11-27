'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from 'motion/react';
import { useUIStore } from '@/store/useUIStore';
import { useChallengeStore, Difficulty } from '@/store/useChallengeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuestStore } from '@/store/useQuestStore';
import type { AiSideQuestDraft, AiUserContext } from '@/lib/api/ai';
import {
  SHEET_SNAP_SPRING,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  Droplets,
  Dumbbell,
  Pencil,
  Sparkles,
  Star,
  Target,
  Utensils,
  X,
} from 'lucide-react';
import CustomTaskEditorSheet, {
  createEmptyCustomTask,
  DEFAULT_CUSTOM_TASKS,
  getCustomTaskIcon,
  type CustomTask,
} from '@/components/onboarding/CustomTaskEditorSheet';
import AICustomPlanSheet from '@/components/onboarding/AICustomPlanSheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type PlansModalView = 'plans' | 'modify' | 'restart-confirm' | 'custom-editor' | 'ai-plan';
type PlansModalTitleId =
  | 'plans-modal-title'
  | 'custom-editor-title'
  | 'ai-plan-sheet-title'
  | 'ai-side-quest-title';

export const PLANS: {
  difficulty: Difficulty;
  shortLabel: string;
  title: string;
  description: string;
  color: string;
  borderColor: string;
  glowColor: string;
  tasks: { icon: React.ReactElement; label: string }[];
}[] = [
  {
    difficulty: 'Soft',
    shortLabel: 'Soft',
    title: 'Soft Challenge',
    description: 'Versión suave para principiantes o recuperación',
    color: 'text-sky-400',
    borderColor: 'border-sky-500',
    glowColor: 'shadow-sky-500/20',
    tasks: [
      { icon: <Utensils className="size-3.5 text-sky-400" />, label: 'Comer saludable (alcohol social)' },
      { icon: <Droplets className="size-3.5 text-sky-400" />, label: 'Agua (3L al día)' },
      { icon: <Dumbbell className="size-3.5 text-sky-400" />, label: 'Ejercicio 45 min (1 día libre)' },
      { icon: <Star className="size-3.5 text-sky-400" />, label: 'Leer 10 páginas' },
      { icon: <Star className="size-3.5 text-sky-400" />, label: 'Sin fotos de progreso' },
    ],
  },
  {
    difficulty: 'Medium',
    shortLabel: 'Medium',
    title: 'Medium Challenge',
    description: 'Versión intermedia con desafíos balanceados',
    color: 'text-rose-300',
    borderColor: 'border-rose-400',
    glowColor: 'shadow-rose-500/20',
    tasks: [
      { icon: <Utensils className="size-3.5 text-rose-300" />, label: 'Dieta saludable (Sin alcohol)' },
      { icon: <Dumbbell className="size-3.5 text-rose-300" />, label: 'Ejercicio 45 min' },
      { icon: <Star className="size-3.5 text-rose-300" />, label: 'Leer 10 páginas' },
      { icon: <ClipboardList className="size-3.5 text-rose-300" />, label: '3-4 fotos de progreso/sem' },
    ],
  },
  {
    difficulty: 'Hard',
    shortLabel: 'Hard',
    title: 'Hard Challenge',
    description: 'El desafío completo 75 HARD original',
    color: 'text-rose-400',
    borderColor: 'border-rose-500',
    glowColor: 'shadow-rose-500/20',
    tasks: [
      { icon: <Utensils className="size-3.5 text-rose-400" />, label: 'Dieta Estricta' },
      { icon: <Dumbbell className="size-3.5 text-rose-400" />, label: 'Primer Entrenamiento' },
      { icon: <Dumbbell className="size-3.5 text-rose-400" />, label: 'Segundo Entrenamiento' },
      { icon: <Droplets className="size-3.5 text-rose-400" />, label: 'Agua (3.7L)' },
      { icon: <Star className="size-3.5 text-rose-400" />, label: 'Leer 10 páginas' },
      { icon: <Star className="size-3.5 text-rose-400" />, label: 'Sin alcohol' },
    ],
  },
  {
    difficulty: 'Custom',
    shortLabel: 'Custom',
    title: 'Custom Challenge',
    description: 'Creá o ajustá tus propias metas con IA o a mano',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500',
    glowColor: 'shadow-emerald-500/20',
    tasks: [
      { icon: <Utensils className="size-3.5 text-emerald-400" />, label: 'Dieta Personalizada' },
      { icon: <Dumbbell className="size-3.5 text-emerald-400" />, label: 'Ejercicio Personalizado' },
      { icon: <Droplets className="size-3.5 text-emerald-400" />, label: 'Hidratación Personalizada' },
      { icon: <Pencil className="size-3.5 text-emerald-400" />, label: 'Tus propias metas' },
    ],
  },
];

export default function PlansModal() {
  const router = useRouter();
  const { isPlansModalOpen, closePlansModal } = useUIStore();
  const {
    startChallenge,
    updateCustomGoals,
    isActive,
    difficulty: currentDifficulty,
    customGoalsTemplate,
  } = useChallengeStore();
  const { user } = useAuthStore();
  const { quests, createCustomQuest } = useQuestStore();

  const [difficulty, setDifficulty] = useState<Difficulty>(() => currentDifficulty || 'Hard');
  const [customTasks, setCustomTasks] = useState<CustomTask[]>(() =>
    customGoalsTemplate.length > 0
      ? customGoalsTemplate.map((goal, index) => ({
          id: goal.id || `existing-${index}-${goal.title}`,
          title: goal.title,
          description: goal.description || '',
          icon: goal.icon || 'dumbbell',
          cadence: goal.cadence || 'daily',
          measurementType: goal.measurementType || 'boolean',
          targetValue: goal.targetValue ?? 1,
          targetUnit: goal.targetUnit ?? '',
        }))
      : DEFAULT_CUSTOM_TASKS
  );
  const [pendingAiSideQuests, setPendingAiSideQuests] = useState<AiSideQuestDraft[]>([]);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(false);
  const [isAiPlanSheetOpen, setIsAiPlanSheetOpen] = useState(false);
  const [showModifyChoiceView, setShowModifyChoiceView] = useState(false);
  const [showRestartConfirmView, setShowRestartConfirmView] = useState(false);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [aiTitleId, setAiTitleId] =
    useState<Extract<PlansModalTitleId, 'ai-plan-sheet-title' | 'ai-side-quest-title'>>(
      'ai-plan-sheet-title'
    );
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const aiBackHandlerRef = useRef<(() => boolean) | null>(null);
  const aiDismissLockedRef = useRef(false);
  const rootActionLockRef = useRef(false);
  const dragControls = useDragControls();
  const sheetY = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const isMobileSheet = useMediaQuery('(max-width: 639px)');

  const currentView: PlansModalView = isCustomEditorOpen
    ? 'custom-editor'
    : isAiPlanSheetOpen
      ? 'ai-plan'
      : showModifyChoiceView
        ? 'modify'
        : showRestartConfirmView
          ? 'restart-confirm'
          : 'plans';
  const titleId: PlansModalTitleId =
    currentView === 'custom-editor'
      ? 'custom-editor-title'
      : currentView === 'ai-plan'
        ? aiTitleId
        : 'plans-modal-title';

  const plansModalUserContext = useMemo<AiUserContext>(
    () => ({
      age: user?.age ?? null,
      heightCm: user?.height ?? null,
      weightKg: user?.weight ?? null,
      targetWeightKg: user?.targetWeight ?? null,
      activeSideQuests: (quests || [])
        .filter((q) => !q.completed)
        .map((q) => ({
          title: q.title,
          difficulty: q.difficulty,
          durationDays: q.durationDays,
          description: q.description,
          tasks: q.currentRun?.tasks?.map((t) => t.title) ?? [],
        })),
    }),
    [user?.age, user?.height, user?.weight, user?.targetWeight, quests]
  );

  const onboardingCompleted = user?.onboardingCompleted === true;
  const isActiveCustom = isActive && currentDifficulty === 'Custom';
  const isCurrentPlan =
    isActive &&
    Boolean(currentDifficulty) &&
    difficulty === currentDifficulty &&
    difficulty !== 'Custom';

  const handleClose = useCallback(() => {
    if (isSavingCustom || aiDismissLockedRef.current || rootActionLockRef.current) return;
    aiBackHandlerRef.current = null;
    aiDismissLockedRef.current = false;
    setIsCustomEditorOpen(false);
    setIsAiPlanSheetOpen(false);
    setShowModifyChoiceView(false);
    setShowRestartConfirmView(false);
    setPendingAiSideQuests([]);
    setAiTitleId('ai-plan-sheet-title');
    closePlansModal();
  }, [closePlansModal, isSavingCustom]);

  const handleAiBackHandlerChange = useCallback((handler: (() => boolean) | null) => {
    aiBackHandlerRef.current = handler;
  }, []);

  const handleAiDismissLockChange = useCallback((locked: boolean) => {
    aiDismissLockedRef.current = locked;
  }, []);

  const closeCustomEditor = useCallback(() => {
    const validTasks = customTasks.filter((task) => task.title.trim() !== '');
    setCustomTasks(validTasks);
    setIsCustomEditorOpen(false);
    if (isActiveCustom && validTasks.length > 0) {
      setShowModifyChoiceView(true);
    }
  }, [customTasks, isActiveCustom]);

  const handleBack = useCallback(() => {
    if (isSavingCustom || aiDismissLockedRef.current || rootActionLockRef.current) return;
    if (isCustomEditorOpen) {
      closeCustomEditor();
      return;
    }
    if (isAiPlanSheetOpen) {
      if (aiBackHandlerRef.current?.()) return;
      aiBackHandlerRef.current = null;
      setIsAiPlanSheetOpen(false);
      setAiTitleId('ai-plan-sheet-title');
      return;
    }
    if (showModifyChoiceView) {
      setShowModifyChoiceView(false);
      return;
    }
    if (showRestartConfirmView) {
      setShowRestartConfirmView(false);
      return;
    }
    handleClose();
  }, [
    closeCustomEditor,
    handleClose,
    isAiPlanSheetOpen,
    isCustomEditorOpen,
    isSavingCustom,
    showModifyChoiceView,
    showRestartConfirmView,
  ]);

  useEffect(() => {
    if (!isPlansModalOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog?.contains(document.activeElement)) {
        dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
      }
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [isPlansModalOpen]);

  useEffect(() => {
    if (!isPlansModalOpen) return;
    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog?.contains(document.activeElement)) {
        dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
      }
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [aiTitleId, currentView, isPlansModalOpen]);

  useEffect(() => {
    if (!isPlansModalOpen) {
      aiBackHandlerRef.current = null;
    }
  }, [isPlansModalOpen]);

  useEffect(() => {
    if (!isPlansModalOpen) return;
    sheetY.set(0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handleBack();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeInDialog = dialog.contains(document.activeElement);
      if (
        event.shiftKey &&
        (!activeInDialog || document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!activeInDialog || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleBack, isPlansModalOpen, sheetY]);

  if (!isPlansModalOpen) return null;

  const formatCustomGoals = (tasksToFormat: CustomTask[]) =>
    tasksToFormat
      .filter((task) => task.title.trim())
      .map(
        ({
          id,
          title,
          description,
          icon,
          cadence,
          measurementType,
          targetValue,
          targetUnit,
        }) => ({
          id,
          title: title.trim(),
          description: description.trim(),
          icon,
          cadence: cadence || 'daily',
          measurementType: measurementType || 'boolean',
          targetValue: targetValue ?? 1,
          targetUnit: targetUnit?.trim() || null,
        })
      );

  const executeStartChallenge = async (
    targetDifficulty: Difficulty,
    tasksOverride?: CustomTask[],
    sideQuestsOverride?: AiSideQuestDraft[]
  ) => {
    if (rootActionLockRef.current || isSavingCustom) return;
    const tasksToUse = tasksOverride ?? customTasks;
    const formattedCustomGoals = formatCustomGoals(tasksToUse);
    if (targetDifficulty === 'Custom' && formattedCustomGoals.length === 0) return;

    rootActionLockRef.current = true;
    setIsSavingCustom(true);
    try {
      await startChallenge(
        targetDifficulty,
        targetDifficulty === 'Custom' ? formattedCustomGoals : undefined
      );
      await persistPendingSideQuests(sideQuestsOverride ?? pendingAiSideQuests);
      setPendingAiSideQuests([]);
      rootActionLockRef.current = false;
      handleClose();
      router.push('/dashboard');
    } finally {
      rootActionLockRef.current = false;
      setIsSavingCustom(false);
    }
  };

  const handleStart = async () => {
    if (rootActionLockRef.current || isSavingCustom) return;
    if (isActive) {
      if (isCurrentPlan) return;
      if (difficulty === 'Custom') {
        setShowModifyChoiceView(true);
        return;
      }
      setShowRestartConfirmView(true);
      return;
    }
    await executeStartChallenge(difficulty);
  };

  const persistPendingSideQuests = async (sideQuestsToCreate: AiSideQuestDraft[]) => {
    if (sideQuestsToCreate.length === 0) return;
    const seen = new Set<string>();
    const uniqueQuests = sideQuestsToCreate.filter((quest) => {
      const key = quest.title.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const results = await Promise.all(
      uniqueQuests.map((quest) =>
        createCustomQuest({
          title: quest.title,
          description: quest.description,
          icon: quest.icon,
          difficulty: quest.difficulty,
          durationDays: quest.durationDays,
          tasks: quest.tasks.map((t) => ({
            title: t.title,
            description: t.description?.trim() || '',
            icon: t.icon || 'target',
            frequency: t.frequency,
            measurementType:
              t.measurementType ?? (t.targetValue && t.targetValue > 1 ? 'numeric' : 'boolean'),
            targetValue: t.targetValue ?? null,
            targetUnit: t.targetUnit?.trim() || '',
          })),
        })
      )
    );
    if (results.some((ok) => !ok)) {
      throw new Error('No pudimos guardar una de las misiones secundarias. Intentá de nuevo.');
    }
  };

  const handleContinueActiveCustom = async () => {
    if (rootActionLockRef.current || isSavingCustom) return;
    const formattedCustomGoals = formatCustomGoals(customTasks);
    if (formattedCustomGoals.length === 0) return;
    rootActionLockRef.current = true;
    setIsSavingCustom(true);
    try {
      await updateCustomGoals(formattedCustomGoals);
      await persistPendingSideQuests(pendingAiSideQuests);
      setPendingAiSideQuests([]);
      rootActionLockRef.current = false;
      handleClose();
      router.push('/dashboard');
    } finally {
      rootActionLockRef.current = false;
      setIsSavingCustom(false);
    }
  };

  const handleRestartActiveCustom = async () => {
    await executeStartChallenge('Custom');
  };

  const openManualEditor = () => {
    if (customTasks.length === 0) {
      setCustomTasks([createEmptyCustomTask()]);
    }
    setIsCustomEditorOpen(true);
  };

  const openAiDesigner = () => {
    setAiTitleId('ai-plan-sheet-title');
    setIsAiPlanSheetOpen(true);
  };

  const selectedPlan = PLANS.find((p) => p.difficulty === difficulty) ?? PLANS[2];
  const resolvedTasksForPlan = (planDifficulty: Difficulty, fallbackTasks: typeof PLANS[number]['tasks']) =>
    planDifficulty === 'Custom'
      ? customTasks
          .filter((task) => task.title.trim())
          .map((task) => {
            const TaskIcon = getCustomTaskIcon(task.icon);
            return {
              icon: <TaskIcon className="size-3.5 shrink-0" style={{ color: 'var(--accent-text)' }} />,
              label: task.title,
              description: task.description,
            };
          })
      : fallbackTasks.map((t) => ({ ...t, description: '' }));

  return (
    <div
      className="mobile-sheet-root fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-[3px]"
      onClick={handleBack}
    >
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-5xl overflow-hidden border border-b-0 rounded-t-3xl pb-[env(safe-area-inset-bottom,0px)] shadow-2xl flex flex-col h-[92dvh] max-h-[min(92dvh,100%)] sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl sm:border-b sm:pb-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          y: sheetY,
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        drag={isMobileSheet && !reduceMotion ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.25 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (shouldDismissSheet(info.offset.y, info.velocity.y)) {
            handleBack();
          } else {
            animate(sheetY, 0, {
              ...SHEET_SNAP_SPRING,
              velocity: info.velocity.y,
            });
          }
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {isMobileSheet && (
          <div
            className="flex h-6 shrink-0 items-center justify-center cursor-grab touch-none active:cursor-grabbing"
            aria-hidden="true"
            onPointerDown={(event) => dragControls.start(event)}
          >
            <span className="h-1 w-10 rounded-full bg-[var(--border-control)]" />
          </div>
        )}

        {currentView === 'custom-editor' ? (
          <CustomTaskEditorSheet
            isOpen
            embedded
            tasks={customTasks}
            onChange={setCustomTasks}
            onClose={closeCustomEditor}
          />
        ) : currentView === 'ai-plan' ? (
          <AICustomPlanSheet
            isOpen
            embedded
            onTitleIdChange={setAiTitleId}
            onBackHandlerChange={handleAiBackHandlerChange}
            onDismissLockChange={handleAiDismissLockChange}
            initialTasks={customTasks}
            userContext={plansModalUserContext}
            saveButtonLabel={
              isActiveCustom ? 'Guardar cambios del plan' : 'Guardar todo y comenzar plan'
            }
            isSaving={isSavingCustom}
            onApplyPlan={async (tasks, createdSideQuests = []) => {
              const validTasks = tasks.filter((task) => task.title.trim() !== '');
              setCustomTasks(validTasks);
              if (validTasks.length === 0) {
                setIsAiPlanSheetOpen(false);
                setAiTitleId('ai-plan-sheet-title');
                return;
              }

              if (isActiveCustom) {
                setPendingAiSideQuests(createdSideQuests);
                setIsAiPlanSheetOpen(false);
                setAiTitleId('ai-plan-sheet-title');
                setShowModifyChoiceView(true);
                return;
              }

              if (isActive) {
                setPendingAiSideQuests(createdSideQuests);
                setDifficulty('Custom');
                setIsAiPlanSheetOpen(false);
                setAiTitleId('ai-plan-sheet-title');
                setShowRestartConfirmView(true);
                return;
              }

              await executeStartChallenge('Custom', validTasks, createdSideQuests);
            }}
            onEditManually={(tasks, createdSideQuests = []) => {
              setCustomTasks(tasks);
              if (createdSideQuests.length > 0) {
                setPendingAiSideQuests((prev) => {
                  const seen = new Set(prev.map((q) => q.title.trim().toLowerCase()));
                  const next = [...prev];
                  for (const q of createdSideQuests) {
                    const key = q.title.trim().toLowerCase();
                    if (key && !seen.has(key)) {
                      seen.add(key);
                      next.push(q);
                    }
                  }
                  return next;
                });
              }
              setIsAiPlanSheetOpen(false);
              setAiTitleId('ai-plan-sheet-title');
              setIsCustomEditorOpen(true);
            }}
            onClose={() => {
              setIsAiPlanSheetOpen(false);
              setAiTitleId('ai-plan-sheet-title');
            }}
          />
        ) : (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-7 sm:py-4 border-b shrink-0"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {showModifyChoiceView || showRestartConfirmView ? (
                  <button
                    type="button"
                    disabled={isSavingCustom}
                    onClick={() => {
                      setShowModifyChoiceView(false);
                      setShowRestartConfirmView(false);
                    }}
                    aria-label="Volver a planes"
                    className="size-9 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                    style={{
                      touchAction: 'manipulation',
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                ) : (
                  <div
                    className="size-8 rounded-xl border flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    <Target className="size-4" />
                  </div>
                )}

                <h2
                  id="plans-modal-title"
                  className="text-base sm:text-lg font-bold tracking-tight truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {showModifyChoiceView
                    ? '¿Cómo aplicar los cambios?'
                    : showRestartConfirmView
                      ? '¿Reiniciar desafío actual?'
                      : 'Seleccionar Plan de Desafío'}
                </h2>
              </div>

              <button
                aria-label="Cerrar selección de plan"
                onClick={handleClose}
                className="size-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--surface-inset)',
                  color: 'var(--text-secondary)',
                }}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-7 overflow-y-auto overscroll-contain flex-1">
              {showModifyChoiceView || showRestartConfirmView ? (
                <div className="max-w-md mx-auto py-3 flex flex-col gap-4">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {showModifyChoiceView
                      ? 'Podés continuar con tu desafío actual conservando todo tu historial y tu racha, o reiniciar desde el Día 1 con las nuevas metas.'
                      : `Ya tenés un desafío activo (${currentDifficulty}). Si cambiás al plan ${selectedPlan.title}, tu desafío se reiniciará desde el Día 1 y perderás tu racha actual.`}
                  </p>

                  {(showModifyChoiceView ||
                    (difficulty === 'Custom' && formatCustomGoals(customTasks).length > 0)) && (
                    <div
                      className="rounded-2xl border p-3.5 flex flex-col gap-2"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <span
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Resumen a aplicar ({formatCustomGoals(customTasks).length} metas
                        {pendingAiSideQuests.length > 0
                          ? ` + ${pendingAiSideQuests.length} misión`
                          : ''}
                        )
                      </span>
                      <ul className="flex flex-col gap-1.5">
                        {formatCustomGoals(customTasks).map((g, idx) => (
                          <li
                            key={idx}
                            className="text-xs font-medium truncate"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {idx + 1}. {g.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col gap-2.5 pt-1">
                    {showModifyChoiceView ? (
                      <>
                        <button
                          type="button"
                          disabled={isSavingCustom}
                          onClick={handleContinueActiveCustom}
                          className="w-full min-h-[48px] px-4 rounded-xl font-semibold text-sm cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--accent-fill)',
                            color: 'var(--on-accent)',
                          }}
                        >
                          {isSavingCustom
                            ? 'Guardando...'
                            : currentDifficulty !== 'Custom'
                              ? 'Pasar a Custom manteniendo mi racha actual'
                              : 'Continuar manteniendo mi racha actual'}
                        </button>

                        <button
                          type="button"
                          disabled={isSavingCustom}
                          onClick={handleRestartActiveCustom}
                          className="w-full min-h-[48px] px-4 rounded-xl font-semibold text-sm border cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-control)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          Reiniciar desafío desde el Día 1
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isSavingCustom}
                          onClick={() => void executeStartChallenge(difficulty)}
                          className="w-full min-h-[48px] px-4 rounded-xl font-semibold text-sm cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--accent-fill)',
                            color: 'var(--on-accent)',
                          }}
                        >
                          {isSavingCustom ? 'Reiniciando...' : 'Reiniciar desafío desde el Día 1'}
                        </button>

                        <button
                          type="button"
                          disabled={isSavingCustom}
                          onClick={() => setShowRestartConfirmView(false)}
                          className="w-full min-h-[48px] px-4 rounded-xl font-semibold text-sm border cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-control)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : !onboardingCompleted ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3.5 text-center">
                  <div
                    className="size-14 rounded-2xl border flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    <ClipboardList size={26} />
                  </div>
                  <div>
                    <p
                      className="font-bold text-base mb-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      ¡Completá el Sobre Vos para generar tu plan!
                    </p>
                    <p
                      className="text-xs max-w-xs mx-auto leading-relaxed"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Necesitás finalizar el proceso de configuración inicial antes de seleccionar un
                      plan.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* MOBILE (< 640px): Segmented Plan Selector + Focused Inset View (zero 4-card vertical bloat) */}
                  <div className="flex flex-col gap-3.5 sm:hidden">
                    <div
                      role="tablist"
                      aria-label="Nivel de desafío"
                      className="grid grid-cols-4 gap-1 p-1 rounded-xl border"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      {PLANS.map((plan) => {
                        const active = difficulty === plan.difficulty;
                        return (
                          <button
                            key={plan.difficulty}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setDifficulty(plan.difficulty)}
                            className="min-h-[38px] rounded-lg text-xs font-semibold cursor-pointer transition-colors duration-150 ease-out"
                            style={{
                              touchAction: 'manipulation',
                              backgroundColor: active ? 'var(--surface-card)' : 'transparent',
                              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                            }}
                          >
                            {plan.shortLabel}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Plan Summary + Inset Grouped Task List */}
                    <div
                      className="rounded-2xl border overflow-hidden"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div
                        className="p-3.5 border-b flex items-start justify-between gap-2"
                        style={{ borderColor: 'var(--divider)' }}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3
                              className="text-base font-bold leading-tight"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {selectedPlan.title}
                            </h3>
                            {isActive && currentDifficulty === selectedPlan.difficulty && (
                              <span
                                className="pv2-chip text-[10px]"
                                style={{ color: 'var(--accent-text)' }}
                              >
                                Actual
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs mt-0.5 leading-snug"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {selectedPlan.description}
                          </p>
                        </div>

                        <span className="pv2-chip text-[11px] shrink-0">
                          <Calendar className="size-3" />
                          75d
                        </span>
                      </div>

                      <ul className="divide-y" style={{ borderColor: 'var(--divider)' }}>
                        {resolvedTasksForPlan(selectedPlan.difficulty, selectedPlan.tasks).map(
                          (task, idx) => (
                            <li
                              key={idx}
                              className="px-3.5 py-2.5 flex items-start gap-2.5"
                              style={{ borderColor: 'var(--divider)' }}
                            >
                              <span className="mt-0.5 shrink-0">{task.icon}</span>
                              <div className="min-w-0 flex-1">
                                <p
                                  className="text-xs font-semibold leading-snug"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  {task.label}
                                </p>
                                {task.description && (
                                  <p
                                    className="text-[11px] mt-0.5 leading-snug line-clamp-2"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </li>
                          )
                        )}
                      </ul>

                      {/* Direct inline Custom Plan actions (eliminates intermediate CustomModePicker modal) */}
                      {difficulty === 'Custom' && (
                        <div
                          className="p-3 border-t grid grid-cols-2 gap-2"
                          style={{
                            backgroundColor: 'var(--surface-card)',
                            borderColor: 'var(--divider)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={openAiDesigner}
                            className="min-h-[42px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                            style={{
                              touchAction: 'manipulation',
                              backgroundColor: 'var(--surface-inset)',
                              borderColor: 'var(--border-control)',
                              color: 'var(--accent-text)',
                            }}
                          >
                            <Sparkles className="size-3.5" />
                            <span>{isActiveCustom ? 'Ajustar con IA' : 'Diseñar con IA'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={openManualEditor}
                            className="min-h-[42px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                            style={{
                              touchAction: 'manipulation',
                              backgroundColor: 'var(--surface-inset)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <Pencil className="size-3.5" />
                            <span>Editar manual</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DESKTOP / TABLET (>= 640px): 4-Column Comparison Grid */}
                  <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {PLANS.map((plan) => {
                      const isSelected = difficulty === plan.difficulty;
                      const tasks = resolvedTasksForPlan(plan.difficulty, plan.tasks);

                      return (
                        <div
                          key={plan.difficulty}
                          onClick={() => setDifficulty(plan.difficulty)}
                          className="relative rounded-2xl border p-5 cursor-pointer flex flex-col gap-4 transition-colors duration-150 ease-out"
                          style={{
                            backgroundColor: isSelected
                              ? 'var(--surface-inset)'
                              : 'var(--surface-card)',
                            borderColor: isSelected
                              ? 'var(--accent-fill)'
                              : 'var(--border-subtle)',
                          }}
                        >
                          <div>
                            <h3
                              className="font-bold text-base leading-tight mb-1"
                              style={{
                                color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)',
                              }}
                            >
                              {plan.title}
                            </h3>
                            <p
                              className="text-xs leading-relaxed"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {plan.description}
                            </p>
                          </div>

                          <div
                            className="flex items-center gap-1.5 text-xs"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Calendar className="size-3.5" />
                            <span className="font-medium">75 días</span>
                          </div>

                          <div className="flex-1 flex flex-col gap-2">
                            <p
                              className="text-[11px] font-bold uppercase tracking-wider"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Tareas Diarias:
                            </p>
                            <ul className="flex flex-col gap-1.5">
                              {tasks.map((task, i) => (
                                <li
                                  key={i}
                                  className="flex items-center gap-2 text-xs font-medium"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {task.icon}
                                  <span className="leading-snug">{task.label}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {(plan.difficulty === 'Custom' || (isActive && currentDifficulty === plan.difficulty)) && isSelected && (
                            <div className="pt-2 border-t flex flex-col gap-1.5" style={{ borderColor: 'var(--divider)' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDifficulty('Custom');
                                  openAiDesigner();
                                }}
                                className="w-full min-h-[36px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--surface-card)',
                                  borderColor: 'var(--border-control)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <Sparkles className="size-3.5" />
                                <span>
                                  {isActive ? 'Personalizar con IA' : 'Armar con IA'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDifficulty('Custom');
                                  openManualEditor();
                                }}
                                className="w-full min-h-[36px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--surface-card)',
                                  borderColor: 'var(--border-subtle)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                <Pencil className="size-3.5" />
                                <span>
                                  {plan.difficulty !== 'Custom'
                                    ? 'Editar manual (a Custom)'
                                    : 'Editar manual'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer (Hidden when inside modify-choice or restart-confirm subview since its buttons are inline) */}
            {!showModifyChoiceView && !showRestartConfirmView && (
              <div
                className="px-4 py-3 sm:px-7 sm:py-4 border-t flex items-center justify-between gap-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:pb-4"
                style={{
                  backgroundColor: 'var(--surface-card)',
                  borderColor: 'var(--divider)',
                }}
              >
                <span
                  className="hidden text-xs font-medium sm:block"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Plan seleccionado:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedPlan.title}</strong>
                </span>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="min-h-[44px] px-4 rounded-xl font-semibold text-sm border cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                    style={{
                      touchAction: 'manipulation',
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Cancelar
                  </button>

                  {onboardingCompleted && (
                    <button
                      type="button"
                      onClick={handleStart}
                      disabled={
                        isCurrentPlan ||
                        (difficulty === 'Custom' && formatCustomGoals(customTasks).length === 0)
                      }
                      className="min-h-[44px] flex-1 sm:flex-none px-5 rounded-xl font-semibold text-sm cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-45 disabled:cursor-not-allowed"
                      style={{
                        touchAction: 'manipulation',
                        backgroundColor: isCurrentPlan
                          ? 'var(--surface-raised)'
                          : 'var(--accent-fill)',
                        color: isCurrentPlan ? 'var(--text-muted)' : 'var(--on-accent)',
                      }}
                    >
                      {isCurrentPlan
                        ? 'Plan actual'
                        : difficulty === 'Custom' && isActive
                        ? 'Aplicar cambios'
                        : isActive
                        ? 'Reiniciar Desafío'
                        : 'Comenzar Desafío'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

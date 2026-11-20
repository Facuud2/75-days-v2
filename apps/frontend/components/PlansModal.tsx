'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useChallengeStore, Difficulty } from '@/store/useChallengeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuestStore } from '@/store/useQuestStore';
import type { AiSideQuestDraft, AiUserContext } from '@/lib/api/ai';
import {
  X, Target, Calendar, Utensils, Dumbbell, Droplets, ClipboardList, Star, Pencil, Sparkles,
} from 'lucide-react';
import CustomTaskEditorSheet, {
  createEmptyCustomTask,
  DEFAULT_CUSTOM_TASKS,
  formatTaskBadge,
  getCustomTaskIcon,
  type CustomTask,
} from '@/components/onboarding/CustomTaskEditorSheet';
import AICustomPlanSheet from '@/components/onboarding/AICustomPlanSheet';

export const PLANS: {
  difficulty: Difficulty;
  title: string;
  description: string;
  color: string;
  borderColor: string;
  glowColor: string;
  tasks: { icon: React.ReactElement; label: string }[];
  }[] = [
    {
      difficulty: 'Soft',
      title: 'Soft Challenge',
      description: 'Versión suave para principiantes o recuperación',
      color: 'text-sky-400',
      borderColor: 'border-sky-500',
      glowColor: 'shadow-sky-500/20',
      tasks: [
        { icon: <Utensils className="w-3.5 h-3.5 text-sky-400" />, label: 'Comer saludable (diaria)' },
        { icon: <Droplets className="w-3.5 h-3.5 text-sky-400" />, label: 'Agua: 3 L/día' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-sky-400" />, label: 'Entrenamiento: 6 sesiones/sem' },
        { icon: <Star className="w-3.5 h-3.5 text-sky-400" />, label: 'Lectura: 10 págs/día' },
      ],
    },
    {
      difficulty: 'Medium',
      title: 'Medium Challenge',
      description: 'Versión intermedia con desafíos balanceados',
      color: 'text-rose-300',
      borderColor: 'border-rose-400',
      glowColor: 'shadow-rose-500/20',
      tasks: [
        { icon: <Utensils className="w-3.5 h-3.5 text-rose-300" />, label: 'Dieta saludable (Sin alcohol)' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-rose-300" />, label: 'Ejercicio 45 min (diaria)' },
        { icon: <Star className="w-3.5 h-3.5 text-rose-300" />, label: 'Lectura: 10 págs/día' },
        { icon: <ClipboardList className="w-3.5 h-3.5 text-rose-300" />, label: 'Fotos de progreso: 4/sem' },
      ],
    },
    {
      difficulty: 'Hard',
      title: 'Hard Challenge',
      description: 'El desafío completo 75 HARD original',
      color: 'text-rose-400',
      borderColor: 'border-rose-500',
      glowColor: 'shadow-rose-500/20',
      tasks: [
        { icon: <Utensils className="w-3.5 h-3.5 text-rose-400" />, label: 'Dieta Estricta' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-rose-400" />, label: 'Primer Entrenamiento' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-rose-400" />, label: 'Segundo Entrenamiento' },
        { icon: <Droplets className="w-3.5 h-3.5 text-rose-400" />, label: 'Agua (3.7L)' },
        { icon: <Star className="w-3.5 h-3.5 text-rose-400" />, label: 'Leer 10 páginas' },
        { icon: <Star className="w-3.5 h-3.5 text-rose-400" />, label: 'Sin alcohol' },
      ],
    },
    {
      difficulty: 'Custom',
      title: 'Custom Challenge',
      description: 'Crea tu propio desafío personalizado',
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500',
      glowColor: 'shadow-emerald-500/20',
      tasks: [
        { icon: <Utensils className="w-3.5 h-3.5 text-emerald-400" />, label: 'Dieta Personalizada' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />, label: 'Ejercicio Personalizado' },
        { icon: <Droplets className="w-3.5 h-3.5 text-emerald-400" />, label: 'Hidratación Personalizada' },
        { icon: <Pencil className="w-3.5 h-3.5 text-emerald-400" />, label: 'Tus propias metas' },
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
    breakStreakOnPeriodFail: currentBreakStreakOnPeriodFail,
  } = useChallengeStore();
  const { user } = useAuthStore();
  const { quests, createCustomQuest } = useQuestStore();
  const [difficulty, setDifficulty] = useState<Difficulty>(currentDifficulty || 'Hard');
  const [customTasks, setCustomTasks] = useState<CustomTask[]>(DEFAULT_CUSTOM_TASKS);
  const [breakStreakOnPeriodFail, setBreakStreakOnPeriodFail] = useState<boolean>(
    Boolean(currentBreakStreakOnPeriodFail)
  );
  const [pendingAiSideQuests, setPendingAiSideQuests] = useState<AiSideQuestDraft[]>([]);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(false);
  const [isAiPlanSheetOpen, setIsAiPlanSheetOpen] = useState(false);
  const [showCustomModePicker, setShowCustomModePicker] = useState(false);
  const [showModifyChoiceModal, setShowModifyChoiceModal] = useState(false);
  const [isSavingCustom, setIsSavingCustom] = useState(false);

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
  // Reiniciar con el plan que ya está corriendo no cambia nada para planes fijos;
  // pero si es Custom, el usuario sí puede modificarlo.
  const isActiveCustom = isActive && currentDifficulty === 'Custom';
  const isCurrentPlan =
    isActive &&
    Boolean(currentDifficulty) &&
    difficulty === currentDifficulty &&
    difficulty !== 'Custom';

  useEffect(() => {
    if (!isPlansModalOpen) return;
    setDifficulty(currentDifficulty || 'Hard');
    setShowCustomModePicker(false);
    setShowModifyChoiceModal(false);
    setPendingAiSideQuests([]);
    if (currentDifficulty === 'Custom' && customGoalsTemplate.length > 0) {
      setCustomTasks(
        customGoalsTemplate.map((g, idx) => ({
          id: g.id || `existing-${idx}-${g.title}`,
          title: g.title,
          description: g.description || '',
          icon: g.icon || 'dumbbell',
          cadence: g.cadence || 'daily',
          measurementType: g.measurementType || 'boolean',
          targetValue: g.targetValue ?? 1,
          targetUnit: g.targetUnit || '',
        }))
      );
      setBreakStreakOnPeriodFail(Boolean(currentBreakStreakOnPeriodFail));
    } else {
      setCustomTasks(DEFAULT_CUSTOM_TASKS);
      setBreakStreakOnPeriodFail(false);
    }
  }, [
    isPlansModalOpen,
    currentDifficulty,
    customGoalsTemplate,
    currentBreakStreakOnPeriodFail,
  ]);

  const handleClose = useCallback(() => {
    setIsCustomEditorOpen(false);
    setIsAiPlanSheetOpen(false);
    setShowCustomModePicker(false);
    setShowModifyChoiceModal(false);
    closePlansModal();
  }, [closePlansModal]);

  useEffect(() => {
    if (!isPlansModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isCustomEditorOpen || isAiPlanSheetOpen) return;
      if (showCustomModePicker) {
        event.stopPropagation();
        setShowCustomModePicker(false);
        return;
      }
      if (showModifyChoiceModal) {
        event.stopPropagation();
        if (!isSavingCustom) setShowModifyChoiceModal(false);
        return;
      }
      event.stopPropagation();
      handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlansModalOpen,
    isCustomEditorOpen,
    isAiPlanSheetOpen,
    showCustomModePicker,
    showModifyChoiceModal,
    isSavingCustom,
    handleClose,
  ]);

  if (!isPlansModalOpen) return null;

  const formatCustomGoals = (tasksToFormat: CustomTask[]) =>
    tasksToFormat
      .filter((task) => task.title.trim())
      .map(
        (
          { title, description, icon, cadence, measurementType, targetValue, targetUnit },
          index
        ) => ({
          title: title.trim(),
          description: description.trim(),
          icon,
          cadence: cadence || ('daily' as const),
          measurementType: measurementType || ('boolean' as const),
          targetValue: targetValue ?? 1,
          targetUnit: targetUnit?.trim() || null,
          order: index,
        })
      );

  const handleStart = async () => {
    if (isActive) {
      if (isCurrentPlan) return;
      if (difficulty === 'Custom' && isActiveCustom) {
        setShowModifyChoiceModal(true);
        return;
      }
      if (!confirm('Ya tienes un desafío activo. ¿Estás seguro de que quieres reiniciarlo con un nuevo plan? Perderás tu racha actual.')) {
        return;
      }
    }
    const formattedCustomGoals = formatCustomGoals(customTasks);
    await startChallenge(
      difficulty,
      difficulty === 'Custom' ? formattedCustomGoals : undefined,
      difficulty === 'Custom' ? breakStreakOnPeriodFail : undefined
    );
    handleClose();
    router.push('/dashboard');
  };

  const persistPendingSideQuests = async (sideQuestsToCreate: AiSideQuestDraft[]) => {
    if (sideQuestsToCreate.length === 0) return;
    await Promise.all(
      sideQuestsToCreate.map((quest) =>
        createCustomQuest({
          title: quest.title,
          description: quest.description,
          icon: quest.icon,
          difficulty: quest.difficulty,
          durationDays: quest.durationDays,
          tasks: quest.tasks.map((t) => ({
            title: t.title,
            description: t.description || null,
            icon: t.icon || 'target',
            frequency: t.frequency,
            targetValue: t.targetValue ?? null,
            targetUnit: t.targetUnit || null,
          })),
        })
      )
    );
  };

  const handleContinueActiveCustom = async () => {
    const formattedCustomGoals = formatCustomGoals(customTasks);
    if (formattedCustomGoals.length === 0) return;
    setIsSavingCustom(true);
    try {
      await updateCustomGoals(formattedCustomGoals, breakStreakOnPeriodFail);
      await persistPendingSideQuests(pendingAiSideQuests);
      setPendingAiSideQuests([]);
      handleClose();
      router.push('/dashboard');
    } finally {
      setIsSavingCustom(false);
    }
  };

  const handleRestartActiveCustom = async () => {
    const formattedCustomGoals = formatCustomGoals(customTasks);
    if (formattedCustomGoals.length === 0) return;
    setIsSavingCustom(true);
    try {
      await startChallenge('Custom', formattedCustomGoals, breakStreakOnPeriodFail);
      await persistPendingSideQuests(pendingAiSideQuests);
      setPendingAiSideQuests([]);
      handleClose();
      router.push('/dashboard');
    } finally {
      setIsSavingCustom(false);
    }
  };

  const openManualEditor = () => {
    setShowCustomModePicker(false);
    if (customTasks.length === 0) {
      setCustomTasks([createEmptyCustomTask()]);
    }
    setIsCustomEditorOpen(true);
  };

  const openAiDesigner = () => {
    setShowCustomModePicker(false);
    setIsAiPlanSheetOpen(true);
  };

  const selectedPlan = PLANS.find(p => p.difficulty === difficulty);

  return (
    <>
      <div
        className="mobile-sheet-root fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        onClick={handleClose}
      >
        <div
          className="mobile-sheet-panel bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom-4 duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plans-modal-title"
          onClick={e => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
              <Target className="text-rose-500 w-4 h-4" />
            </div>
            <h2 id="plans-modal-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Seleccionar Plan de Desafío
            </h2>
          </div>
          <button
            aria-label="Cerrar selección de plan"
             onClick={handleClose}
            className="text-white/60 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-8 overflow-y-auto overscroll-contain flex-1">
          {!onboardingCompleted ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-rose-500/5" />
                <ClipboardList size={28} className="text-rose-500 relative z-10" />
              </div>
              <div>
                <p className="text-white font-bold text-lg mb-1">¡Completa el Sobre Vos para generar tu plan!</p>
                <p className="text-white/50 text-sm max-w-xs mx-auto">
                  Necesitás finalizar el proceso de configuración inicial antes de seleccionar un plan.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {PLANS.map((plan) => {
                  const isSelected = difficulty === plan.difficulty;
                  const tasks = plan.difficulty === 'Custom'
                    ? customTasks
                      .filter(task => task.title.trim())
                      .map(task => {
                        const TaskIcon = getCustomTaskIcon(task.icon);
                        return {
                          icon: <TaskIcon className="w-3.5 h-3.5 text-emerald-400" />,
                          label: `${task.title} (${formatTaskBadge(task)})`,
                        };
                      })
                    : plan.tasks;
                  return (
                    <div
                      key={plan.difficulty}
                      onClick={() => setDifficulty(plan.difficulty)}
                      className={`
                        relative rounded-xl border-2 p-5 cursor-pointer flex flex-col gap-4 transition-all duration-200
                        ${isSelected
                          ? `${plan.borderColor} bg-white/5 shadow-xl ${plan.glowColor}`
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                        }
                      `}
                    >
                      {/* Title & Description */}
                      <div>
                        <h3 className={`font-bold text-lg leading-tight mb-1 ${isSelected ? plan.color : 'text-white/80'}`}>
                          {plan.title}
                        </h3>
                        <p className="text-white/50 text-xs leading-relaxed">{plan.description}</p>
                      </div>

                      {/* Duration badge */}
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="font-medium">75 días</span>
                      </div>

                      {/* Tasks */}
                      <div className="space-y-2">
                        <p className="text-white/50 text-[11px] font-bold uppercase tracking-wider">Tareas Diarias:</p>
                        <ul className="space-y-1.5">
                            {tasks.map((task, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-white/70 font-medium">
                              {task.icon}
                              <span className="leading-snug">{task.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>

            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-8 sm:py-4 border-t border-white/5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between bg-zinc-900 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:pb-4">
          <span className="hidden text-sm text-white/40 font-medium sm:block">
            {selectedPlan ? (
              <span>
                Plan seleccionado:{' '}
                <span className={`font-bold ${selectedPlan.color}`}>{selectedPlan.title}</span>
              </span>
            ) : (
              'No hay plan seleccionado'
            )}
          </span>
          <div className="flex items-center gap-3">
            <button
               onClick={handleClose}
              className="min-h-12 flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors border border-white/10"
            >
              Cancelar
            </button>
            {onboardingCompleted && difficulty === 'Custom' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModePicker(true)}
                  className="min-h-12 px-4 py-2.5 rounded-xl font-bold text-sm border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  {isActiveCustom ? 'Modificar plan' : 'Personalizar'}
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={formatCustomGoals(customTasks).length === 0}
                  className="min-h-12 flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-colors bg-rose-400 text-zinc-950 hover:bg-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.25)] disabled:opacity-40"
                >
                  {isActiveCustom ? 'Aplicar cambios' : isActive ? 'Reiniciar Desafío' : 'Comenzar Desafío'}
                </button>
              </div>
            ) : onboardingCompleted && (
              <button
                onClick={handleStart}
                disabled={isCurrentPlan}
                title={isCurrentPlan ? 'Ya estás en este plan. Elegí otro para reiniciar el desafío.' : undefined}
                 className={`min-h-12 flex-[1.4] sm:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                   isCurrentPlan
                     ? 'bg-white/10 text-white/40 cursor-not-allowed'
                     : 'bg-rose-400 text-zinc-950 hover:bg-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                 }`}
              >
                {isCurrentPlan
                  ? 'Plan actual'
                  : (isActive ? 'Reiniciar Desafío' : 'Comenzar Desafío')}
              </button>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Elección: Armar con IA vs Armar manualmente */}
      {showCustomModePicker && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowCustomModePicker(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">¿Cómo querés armar tu plan Custom?</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Podés dictarle tu idea a la IA por voz o editar cada tarea manualmente.
            </p>
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <button
                type="button"
                onClick={openAiDesigner}
                className="w-full min-h-[48px] px-4 rounded-xl font-bold text-sm bg-emerald-500 text-zinc-950 hover:bg-emerald-400 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {isActiveCustom ? 'Modificar plan con IA' : 'Armar plan con IA'}
              </button>
              <button
                type="button"
                onClick={openManualEditor}
                className="w-full min-h-[48px] px-4 rounded-xl font-bold text-sm border border-white/15 text-white hover:bg-white/5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                {isActiveCustom ? 'Modificar manualmente' : 'Armar plan manualmente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pregunta tras modificar un Custom activo: ¿Reiniciar o Continuar? */}
      {showModifyChoiceModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            if (!isSavingCustom) setShowModifyChoiceModal(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">¿Cómo querés aplicar los cambios?</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Podés continuar con tu desafío actual conservando todo tu historial y racha, o reiniciar desde el Día 1.
            </p>
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSavingCustom}
                onClick={handleContinueActiveCustom}
                className="w-full min-h-[48px] px-4 rounded-xl font-bold text-sm bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                {isSavingCustom ? 'Guardando...' : 'Continuar con el desafío actual'}
              </button>
              <button
                type="button"
                disabled={isSavingCustom}
                onClick={handleRestartActiveCustom}
                className="w-full min-h-[48px] px-4 rounded-xl font-bold text-sm border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 cursor-pointer"
              >
                Reiniciar desafío desde el Día 1
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomTaskEditorSheet
        isOpen={isCustomEditorOpen}
        tasks={customTasks}
        onChange={setCustomTasks}
        breakStreakOnPeriodFail={breakStreakOnPeriodFail}
        onChangeBreakStreak={setBreakStreakOnPeriodFail}
        onClose={() => {
          const validTasks = customTasks.filter((t) => t.title.trim() !== '');
          setCustomTasks(validTasks);
          setIsCustomEditorOpen(false);
          if (isActiveCustom && validTasks.length > 0) {
            setShowModifyChoiceModal(true);
          }
        }}
      />

      <AICustomPlanSheet
        isOpen={isAiPlanSheetOpen}
        initialTasks={customTasks}
        userContext={plansModalUserContext}
        saveButtonLabel={isActiveCustom ? 'Guardar cambios del plan' : 'Guardar todo y comenzar plan'}
        isSaving={isSavingCustom}
        onApplyPlan={async (tasks, createdSideQuests = []) => {
          const validTasks = tasks.filter((t) => t.title.trim() !== '');
          setCustomTasks(validTasks);
          if (validTasks.length === 0) {
            setIsAiPlanSheetOpen(false);
            return;
          }

          if (isActiveCustom) {
            setPendingAiSideQuests(createdSideQuests);
            setIsAiPlanSheetOpen(false);
            setShowModifyChoiceModal(true);
            return;
          }

          if (
            isActive &&
            !confirm(
              'Ya tienes un desafío activo. ¿Estás seguro de que quieres reiniciarlo con este nuevo plan Custom? Perderás tu racha actual.'
            )
          ) {
            return;
          }

          setIsSavingCustom(true);
          try {
            await startChallenge('Custom', formatCustomGoals(validTasks));
            await persistPendingSideQuests(createdSideQuests);
            handleClose();
            router.push('/dashboard');
          } finally {
            setIsSavingCustom(false);
          }
        }}
        onEditManually={(tasks) => {
          setCustomTasks(tasks);
          setIsAiPlanSheetOpen(false);
          setIsCustomEditorOpen(true);
        }}
        onClose={() => setIsAiPlanSheetOpen(false)}
      />
    </>
  );
}

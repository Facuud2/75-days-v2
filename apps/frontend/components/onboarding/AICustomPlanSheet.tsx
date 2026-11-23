'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Check,
  ChevronRight,
  ListChecks,
  MessageSquare,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import {
  aiService,
  blobToBase64,
  type AiConversationTurn,
  type AiCustomTask,
  type AiSideQuestDraft,
  type AiSideQuestSuggestion,
  type AiUserContext,
  type QuickReplySelectionMode,
} from '@/lib/api/ai';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  SHEET_SNAP_SPRING,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';
import { getCustomTaskIcon, type CustomTask } from './CustomTaskEditorSheet';
import AISideQuestSheet, { getSideQuestIcon } from './AISideQuestSheet';
import AIThinkingStatus from './AIThinkingStatus';
import AutoGrowComposer from './AutoGrowComposer';
import QuickReplyOptionsCard from './QuickReplyOptionsCard';

type DraftCustomTask = CustomTask & {
  changeType?: 'kept' | 'modified' | 'added';
};

interface PlanProposalSummary {
  totalCount: number;
  addedCount: number;
  modifiedCount: number;
  previewTitles: string[];
}

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  viaVoice?: boolean;
  openQuestions?: string[];
  suggestedQuickReplies?: string[];
  quickReplySelectionMode?: QuickReplySelectionMode;
  proposalSummary?: PlanProposalSummary;
}

export type AICustomPlanSheetProps = {
  isOpen: boolean;
  initialTasks?: CustomTask[];
  userContext?: AiUserContext;
  saveButtonLabel?: string;
  isSaving?: boolean;
  onApplyPlan: (
    tasks: CustomTask[],
    createdSideQuests?: AiSideQuestDraft[]
  ) => void | Promise<void>;
  onEditManually: (tasks: CustomTask[]) => void;
  onClose: () => void;
};

const DISCOVERY_THINKING_STATES = [
  'Analizando tu idea...',
  'Revisando tu contexto...',
  'Evaluando qué conviene aclarar...',
] as const;

const PROPOSAL_THINKING_STATES = [
  'Diseñando metas atómicas...',
  'Ajustando tus tareas...',
  'Organizando el orden del plan...',
] as const;

const ALLOWED_ICON_SET = new Set([
  'utensils',
  'dumbbell',
  'droplet',
  'book',
  'camera',
  'sun',
  'brain',
  'heart',
]);

function toDraftCustomTasks(aiTasks: AiCustomTask[]): DraftCustomTask[] {
  const stamp = Date.now();
  return aiTasks.map((t, idx) => ({
    id: t.id?.trim() || `ai-task-${stamp}-${idx}`,
    title: t.title,
    description: t.description,
    icon: ALLOWED_ICON_SET.has(t.icon) ? t.icon : 'dumbbell',
    changeType: t.changeType,
  }));
}

function toAiTasks(tasks: DraftCustomTask[]): AiCustomTask[] {
  return tasks
    .filter((t) => t.title.trim() !== '')
    .map((t) => ({
      id: t.id,
      title: t.title.trim(),
      description: t.description.trim() || t.title.trim(),
      icon: (ALLOWED_ICON_SET.has(t.icon) ? t.icon : 'dumbbell') as AiCustomTask['icon'],
    }));
}

function stripChangeTypes(tasks: DraftCustomTask[]): CustomTask[] {
  return tasks.map(({ id, title, description, icon }) => ({
    id,
    title,
    description,
    icon,
  }));
}

function summarizeContextChips(userContext?: AiUserContext): string[] {
  if (!userContext) return [];
  const chips: string[] = [];
  if (typeof userContext.weightKg === 'number' && typeof userContext.targetWeightKg === 'number') {
    chips.push(`Meta: ${userContext.weightKg.toFixed(1)} → ${userContext.targetWeightKg.toFixed(1)} kg`);
  }
  const questsCount = userContext.activeSideQuests?.length ?? 0;
  if (questsCount > 0) {
    chips.push(
      questsCount === 1
        ? `1 misión activa (${userContext.activeSideQuests![0].title})`
        : `${questsCount} misiones activas`
    );
  }
  return chips;
}

export default function AICustomPlanSheet({
  isOpen,
  initialTasks = [],
  userContext,
  saveButtonLabel = 'Guardar plan',
  isSaving = false,
  onApplyPlan,
  onEditManually,
  onClose,
}: AICustomPlanSheetProps) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const sheetY = useMotionValue(0);
  const backdropOpacity = useTransform(sheetY, [0, 360], [1, 0]);

  const {
    status: recStatus,
    isSpeaking,
    elapsedSeconds,
    errorMessage: recError,
    subscribeAudioMetrics,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    setTranscribing,
    setProcessing,
    resetStatus,
  } = useVoiceRecorder();

  const [subView, setSubView] = useState<'plan' | 'side-quest'>('plan');
  const [activeTab, setActiveTab] = useState<'chat' | 'draft'>('chat');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [history, setHistory] = useState<AiConversationTurn[]>([]);
  const [understoodFacts, setUnderstoodFacts] = useState<string[]>([]);
  const [generatedTasks, setGeneratedTasks] = useState<DraftCustomTask[]>([]);
  const [hasAiProposalReady, setHasAiProposalReady] = useState(false);
  const [hasUnreadDraftChanges, setHasUnreadDraftChanges] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sideQuestSuggestion, setSideQuestSuggestion] = useState<AiSideQuestSuggestion | null>(
    null
  );
  const [dismissedSideQuestOffer, setDismissedSideQuestOffer] = useState(false);
  const [sessionSideQuests, setSessionSideQuests] = useState<AiSideQuestDraft[]>([]);
  const [sideQuestInitialPrompt, setSideQuestInitialPrompt] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedTaskSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const contextChips = useMemo(() => summarizeContextChips(userContext), [userContext]);

  const enrichedContextForSideQuest = useMemo<AiUserContext>(() => {
    const combinedSideQuests = [
      ...(userContext?.activeSideQuests ?? []),
      ...sessionSideQuests.map((q) => ({
        title: q.title,
        difficulty: q.difficulty,
        durationDays: q.durationDays,
        description: q.description,
        tasks: q.tasks.map((t) => t.title),
      })),
    ];

    return {
      ...userContext,
      activeSideQuests: combinedSideQuests,
      mainPlanTasks: generatedTasks.map((t) => ({
        title: t.title,
        description: t.description,
      })),
    };
  }, [userContext, sessionSideQuests, generatedTasks]);

  // Reset conversation state when sheet opens
  useEffect(() => {
    if (!isOpen) return;
    sheetY.set(0);
    setSubView('plan');
    setActiveTab('chat');
    setApiError(null);
    setHistory([]);
    setUnderstoodFacts([]);
    setSelectedTaskIds([]);
    setHasAiProposalReady(false);
    setHasUnreadDraftChanges(false);
    setSideQuestSuggestion(null);
    setDismissedSideQuestOffer(false);
    setSessionSideQuests([]);
    setSideQuestInitialPrompt('');
    setTextInput('');
    resetStatus();

    const validInitial = initialTasks
      .filter((t) => t.title.trim() !== '')
      .map((t) => ({ ...t }));
    setGeneratedTasks(validInitial);

    const hasContext =
      Boolean(userContext?.activeSideQuests?.length) ||
      typeof userContext?.targetWeightKg === 'number';

    const welcomeMessage =
      validInitial.length > 0
        ? 'Contame acá abajo (por texto o voz) cómo querés armar o modificar tu plan. Si querés editar tareas puntuales de tu base actual, podés tocarlas en la pestaña "Metas".'
        : hasContext
        ? 'Contame tu idea para el reto de 75 días (por texto o voz). Ya tengo en cuenta tus datos y misiones activas para no preguntarte lo obvio.'
        : 'Contame tu idea para tu plan de 75 días (por texto o voz). Te agrupo cualquier duda abierta en un solo mensaje antes de armar tus metas.';

    setMessages([
      {
        id: `plan-welcome-${Date.now()}`,
        role: 'assistant',
        text: welcomeMessage,
      },
    ]);
  }, [isOpen, initialTasks, userContext, resetStatus, sheetY]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (subView === 'side-quest') {
        e.stopPropagation();
        setSubView('plan');
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, subView, onClose]);

  const scrollToLatestMessage = useCallback(
    (behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth') => {
      const container = chatScrollRef.current;
      const target = lastMsgRef.current;
      if (!container) return;
      if (target) {
        // Anchor near the start of the latest message so open questions + options stay readable from line 1
        const targetTop = target.offsetTop - 12;
        const maxScroll = container.scrollHeight - container.clientHeight;
        container.scrollTo({
          top: Math.max(0, Math.min(targetTop, maxScroll)),
          behavior,
        });
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior });
      }
    },
    [reduceMotion]
  );

  useEffect(() => {
    if (!isOpen || subView !== 'plan' || activeTab !== 'chat') return;
    const raf = requestAnimationFrame(() => scrollToLatestMessage());
    return () => cancelAnimationFrame(raf);
  }, [messages.length, recStatus, activeTab, subView, isOpen, scrollToLatestMessage]);

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distFromBottom > 140);
  };

  const micBlocked =
    recStatus === 'permission-denied' ||
    recStatus === 'unsupported' ||
    recStatus === 'error';

  const isBusy = recStatus === 'processing' || recStatus === 'transcribing' || isSaving;
  const isAiThinking = recStatus === 'processing';

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const sendToAi = async (opts: {
    audioBase64?: string;
    mimeType?: string;
    text?: string;
    forceProposal?: boolean;
  }) => {
    setApiError(null);
    setActiveTab('chat');
    setProcessing(true);

    const optimisticMsgId = `plan-user-${Date.now()}`;
    const isVoice = Boolean(opts.audioBase64);
    const optimisticText = opts.forceProposal
      ? 'Armá la propuesta de tareas con lo que hablamos.'
      : opts.text?.trim() || 'Procesando tu mensaje de voz...';

    setMessages((prev) => [
      ...prev,
      {
        id: optimisticMsgId,
        role: 'user',
        text: optimisticText,
        viaVoice: isVoice,
      },
    ]);

    try {
      const currentAiTasks =
        generatedTasks.length > 0 ? toAiTasks(generatedTasks) : undefined;

      const contextWithSessionQuests: AiUserContext | undefined =
        userContext || sessionSideQuests.length > 0
          ? {
              ...userContext,
              activeSideQuests: [
                ...(userContext?.activeSideQuests ?? []),
                ...sessionSideQuests.map((q) => ({
                  title: q.title,
                  difficulty: q.difficulty,
                  durationDays: q.durationDays,
                  description: q.description,
                  tasks: q.tasks.map((t) => t.title),
                })),
              ],
            }
          : undefined;

      const res = await aiService.generateCustomPlan({
        audioBase64: opts.audioBase64,
        mimeType: opts.mimeType,
        textInput: opts.text,
        history,
        currentTasks: currentAiTasks,
        selectedTaskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
        understoodFacts: understoodFacts.length > 0 ? understoodFacts : undefined,
        userContext: contextWithSessionQuests,
        forceProposal: opts.forceProposal,
      });

      const resolvedUserText = res.userTranscript?.trim() || optimisticText;
      const assistantHistorySummary =
        res.openQuestions && res.openQuestions.length > 0
          ? `${res.assistantMessage}\nPreguntas:\n${res.openQuestions
              .map((q, i) => `${i + 1}. ${q}`)
              .join('\n')}`
          : res.assistantMessage;

      let proposalSummary: PlanProposalSummary | undefined;
      if (res.tasks && res.tasks.length > 0) {
        const nextDraft = toDraftCustomTasks(res.tasks);
        setGeneratedTasks(nextDraft);
        setSelectedTaskIds([]);
        if (res.status === 'ready') {
          setHasAiProposalReady(true);
          setHasUnreadDraftChanges(true);
          proposalSummary = {
            totalCount: nextDraft.length,
            addedCount: nextDraft.filter((t) => t.changeType === 'added').length,
            modifiedCount: nextDraft.filter((t) => t.changeType === 'modified').length,
            previewTitles: nextDraft.slice(0, 3).map((t) => t.title),
          };
        }
      }

      if (res.status === 'ready' && res.sideQuestSuggestion) {
        setSideQuestSuggestion(res.sideQuestSuggestion);
      }

      setMessages((prev) => [
        ...prev.map((m) =>
          m.id === optimisticMsgId ? { ...m, text: resolvedUserText } : m
        ),
        {
          id: `plan-ai-${Date.now()}`,
          role: 'assistant',
          text: res.assistantMessage,
          openQuestions: res.openQuestions ?? [],
          suggestedQuickReplies: res.suggestedQuickReplies ?? [],
          quickReplySelectionMode: res.quickReplySelectionMode ?? 'single',
          proposalSummary,
        },
      ]);

      setHistory((prev) => [
        ...prev,
        { role: 'user', text: resolvedUserText },
        { role: 'assistant', text: assistantHistorySummary },
      ]);

      if (res.understoodFacts && res.understoodFacts.length > 0) {
        setUnderstoodFacts(res.understoodFacts);
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsgId));
      setApiError(
        err?.message ||
          'No pudimos comunicarnos con la IA en este momento. Tu borrador sigue intacto.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleStopAndTranscribe = async () => {
    const result = await stopRecording();
    if (!result || result.blob.size === 0) {
      resetStatus();
      return;
    }
    setApiError(null);
    setTranscribing(true);
    try {
      const base64 = await blobToBase64(result.blob);
      const res = await aiService.transcribeAudio({
        audioBase64: base64,
        mimeType: result.mimeType,
      });
      setTranscribing(false);
      if (!res.hasSpeech || !res.transcript.trim()) {
        setApiError('No detectamos voz clara en el audio. Probá hablar más cerca del micrófono.');
        return;
      }
      setTextInput((prev) =>
        prev.trim() ? `${prev.trim()} ${res.transcript.trim()}` : res.transcript.trim()
      );
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (err: any) {
      setTranscribing(false);
      setApiError(err?.message || 'No pudimos transcribir el audio. Intentá de nuevo.');
    }
  };

  const handleSendVoiceDirect = async () => {
    const result = await stopRecording();
    if (!result || result.blob.size === 0) {
      resetStatus();
      return;
    }
    const base64 = await blobToBase64(result.blob);
    await sendToAi({ audioBase64: base64, mimeType: result.mimeType });
  };

  const handleTextSubmit = async () => {
    const trimmed = textInput.trim();
    if (!trimmed || isBusy) return;
    setTextInput('');
    await sendToAi({ text: trimmed });
  };

  const handleOpenSideQuestDesigner = (ideaPrompt?: string) => {
    setSideQuestInitialPrompt(ideaPrompt ?? '');
    setSubView('side-quest');
  };

  const handleAddSessionSideQuest = (quest: AiSideQuestDraft) => {
    setSessionSideQuests((prev) => [...prev, quest]);
    setSubView('plan');
    setActiveTab('chat');
    setMessages((prev) => [
      ...prev,
      {
        id: `plan-sq-added-${Date.now()}`,
        role: 'assistant',
        text: `Sumé la misión secundaria "${quest.title}" (${quest.durationDays} días) a tu borrador. Se activará junto con tu plan al guardar.`,
      },
    ]);
  };

  const hasReadyTasks = generatedTasks.length > 0;
  const canQuickSaveFromHeader =
    hasReadyTasks && (hasAiProposalReady || sessionSideQuests.length > 0);
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={subView === 'side-quest' ? 'ai-side-quest-title' : 'ai-plan-sheet-title'}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            type="button"
            aria-label="Cerrar asistente de IA"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={isDesktop ? undefined : { opacity: backdropOpacity }}
            className="absolute inset-0 bg-black/68 backdrop-blur-[3px]"
          />

          <motion.div
            style={
              isDesktop
                ? {
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }
                : {
                    y: sheetY,
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }
            }
            initial={
              reduceMotion
                ? { opacity: 0 }
                : isDesktop
                ? { opacity: 0, scale: 0.96, y: 8 }
                : { y: '100%' }
            }
            animate={
              reduceMotion
                ? { opacity: 1 }
                : isDesktop
                ? { opacity: 1, scale: 1, y: 0 }
                : { y: 0 }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : isDesktop
                ? { opacity: 0, scale: 0.97, y: 6, transition: SHEET_EXIT_TRANSITION }
                : { y: '100%', transition: SHEET_EXIT_TRANSITION }
            }
            transition={
              reduceMotion
                ? REDUCED_MOTION_TRANSITION
                : isDesktop
                ? { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                : SHEET_ENTER_SPRING
            }
            drag={!isDesktop && !reduceMotion ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (shouldDismissSheet(info.offset.y, info.velocity.y)) {
                onClose();
              } else {
                animate(sheetY, 0, {
                  ...SHEET_SNAP_SPRING,
                  velocity: info.velocity.y,
                });
              }
            }}
            className="relative z-10 w-full max-w-xl h-[95dvh] sm:h-[88dvh] max-h-[840px] rounded-t-3xl sm:rounded-3xl border flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Drag handle mobile */}
            {!isDesktop && (
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex justify-center pt-2.5 pb-0.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
              >
                <span
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border-control)' }}
                />
              </div>
            )}

            {/* Embedded Side Quest Designer inside the same sheet (zero modal stacking) */}
            {subView === 'side-quest' ? (
              <AISideQuestSheet
                isOpen
                embedded
                onBack={() => setSubView('plan')}
                initialIdeaPrompt={sideQuestInitialPrompt}
                userContext={enrichedContextForSideQuest}
                saveButtonLabel="Sumar al plan"
                onApplyQuest={handleAddSessionSideQuest}
                onClose={() => setSubView('plan')}
              />
            ) : (
              <>
                {/* Compact Header + Segmented View Switcher */}
                <header
                  className="px-4 sm:px-5 pt-2.5 pb-3 border-b shrink-0 flex flex-col gap-2.5"
                  style={{ borderColor: 'var(--divider)' }}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="size-9 rounded-xl border flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'var(--surface-inset)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        <Sparkles className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2
                            id="ai-plan-sheet-title"
                            className="text-[15px] sm:text-base font-bold leading-tight truncate"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            Diseñar plan con IA
                          </h2>
                        </div>
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {contextChips.length > 0
                            ? contextChips.join(' · ')
                            : 'Charlá por voz o texto y guardá recién al confirmar'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {canQuickSaveFromHeader && activeTab === 'chat' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            onApplyPlan(stripChangeTypes(generatedTasks), sessionSideQuests)
                          }
                          className="min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out disabled:opacity-50"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--accent-fill)',
                            color: 'var(--on-accent)',
                          }}
                        >
                          <Check className="size-3.5" />
                          <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar"
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
                  </div>

                  {/* Segmented Control: Conversación vs Metas (N) */}
                  {hasReadyTasks && (
                    <div
                      role="tablist"
                      aria-label="Secciones del diseñador de plan"
                      className="grid grid-cols-2 gap-1 p-1 rounded-xl border"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'chat'}
                        onClick={() => setActiveTab('chat')}
                        className="min-h-[34px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-150 ease-out"
                        style={{
                          touchAction: 'manipulation',
                          backgroundColor:
                            activeTab === 'chat' ? 'var(--surface-card)' : 'transparent',
                          color: activeTab === 'chat' ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Conversación</span>
                      </button>

                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'draft'}
                        onClick={() => {
                          setActiveTab('draft');
                          setHasUnreadDraftChanges(false);
                        }}
                        className="min-h-[34px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-150 ease-out"
                        style={{
                          touchAction: 'manipulation',
                          backgroundColor:
                            activeTab === 'draft' ? 'var(--surface-card)' : 'transparent',
                          color:
                            activeTab === 'draft' ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        <ListChecks className="size-3.5" />
                        <span>
                          Metas ({generatedTasks.length}
                          {sessionSideQuests.length > 0 ? ` + ${sessionSideQuests.length}M` : ''})
                        </span>
                        {hasUnreadDraftChanges && activeTab !== 'draft' && (
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: 'var(--accent-fill)' }}
                          />
                        )}
                      </button>
                    </div>
                  )}
                </header>

                {/* Main Body: Clean Chat Stream OR Inset Grouped Draft View */}
                {activeTab === 'chat' ? (
                  <div className="relative flex-1 min-h-0 flex flex-col">
                    <div
                      ref={chatScrollRef}
                      onScroll={handleChatScroll}
                      className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3.5 flex flex-col gap-3"
                    >
                      {/* Compact 1-line base tasks pill instead of dumping 5 huge cards into the chat */}
                      {hasReadyTasks && !hasAiProposalReady && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('draft')}
                          className="w-full px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer active:scale-[0.99] transition-transform duration-150 ease-out"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ListChecks
                              className="size-3.5 shrink-0"
                              style={{ color: 'var(--accent-text)' }}
                            />
                            <span
                              className="text-xs font-medium truncate"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {selectedTaskIds.length > 0
                                ? `${selectedTaskIds.length} metas seleccionadas para modificar`
                                : `${generatedTasks.length} metas base cargadas · Ver o elegir cuáles cambiar`}
                            </span>
                          </div>
                          <ChevronRight
                            className="size-4 shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          />
                        </button>
                      )}

                      {messages.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        const isLast = idx === messages.length - 1;
                        const showQuickReplies =
                          !isUser &&
                          msg.id === lastAssistantId &&
                          msg.suggestedQuickReplies &&
                          msg.suggestedQuickReplies.length > 0 &&
                          !isAiThinking;

                        return (
                          <div
                            key={msg.id}
                            ref={isLast ? lastMsgRef : undefined}
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed border ${
                                isUser ? 'rounded-br-md' : 'rounded-bl-md'
                              }`}
                              style={
                                isUser
                                  ? {
                                      backgroundColor:
                                        'color-mix(in srgb, var(--accent-fill) 16%, var(--surface-raised))',
                                      borderColor:
                                        'color-mix(in srgb, var(--accent-fill) 38%, var(--border-subtle))',
                                      color: 'var(--text-primary)',
                                    }
                                  : {
                                      backgroundColor: 'var(--surface-inset)',
                                      borderColor: 'var(--border-subtle)',
                                      color: 'var(--text-primary)',
                                    }
                              }
                            >
                              {!isUser && (
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Sparkles
                                    className="size-3"
                                    style={{ color: 'var(--accent-text)' }}
                                  />
                                  <span
                                    className="text-[11px] font-semibold"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    Asistente IA
                                  </span>
                                </div>
                              )}

                              <p className="whitespace-pre-line break-words">{msg.text}</p>

                              {isUser && msg.viaVoice && (
                                <span
                                  className="mt-1 inline-flex items-center gap-1 text-[10px]"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <Mic className="size-3" />
                                  Audio enviado
                                </span>
                              )}

                              {!isUser && msg.openQuestions && msg.openQuestions.length > 0 && (
                                <ol
                                  className="mt-2.5 pt-2.5 border-t flex flex-col gap-2 text-xs"
                                  style={{
                                    borderColor: 'var(--divider)',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {msg.openQuestions.map((question, qIdx) => (
                                    <li key={qIdx} className="flex items-start gap-2">
                                      <span
                                        className="size-4.5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums"
                                        style={{
                                          backgroundColor: 'var(--surface-raised)',
                                          color: 'var(--accent-text)',
                                        }}
                                      >
                                        {qIdx + 1}
                                      </span>
                                      <span className="leading-snug">{question}</span>
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>

                            {/* Compact Inline Proposal Card ONLY when AI delivers ready tasks */}
                            {!isUser && msg.proposalSummary && (
                              <div
                                className="mt-2 w-full max-w-[92%] rounded-2xl border p-3 flex flex-col gap-2.5"
                                style={{
                                  backgroundColor: 'var(--surface-card)',
                                  borderColor: 'var(--border-subtle)',
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <ListChecks
                                      className="size-4 shrink-0"
                                      style={{ color: 'var(--accent-text)' }}
                                    />
                                    <span
                                      className="text-xs font-bold truncate"
                                      style={{ color: 'var(--text-primary)' }}
                                    >
                                      Propuesta lista ({msg.proposalSummary.totalCount} metas)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {msg.proposalSummary.addedCount > 0 && (
                                      <span
                                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                        style={{
                                          backgroundColor:
                                            'color-mix(in srgb, var(--status-success) 16%, transparent)',
                                          color: 'var(--status-success)',
                                        }}
                                      >
                                        +{msg.proposalSummary.addedCount}
                                      </span>
                                    )}
                                    {msg.proposalSummary.modifiedCount > 0 && (
                                      <span
                                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                        style={{
                                          backgroundColor:
                                            'color-mix(in srgb, var(--status-info) 16%, transparent)',
                                          color: 'var(--status-info)',
                                        }}
                                      >
                                        {msg.proposalSummary.modifiedCount} edit.
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1">
                                  {msg.proposalSummary.previewTitles.map((title, pIdx) => (
                                    <span
                                      key={pIdx}
                                      className="pv2-chip text-[11px] max-w-full truncate"
                                    >
                                      {title}
                                    </span>
                                  ))}
                                  {msg.proposalSummary.totalCount >
                                    msg.proposalSummary.previewTitles.length && (
                                    <span className="pv2-chip text-[11px]">
                                      +
                                      {msg.proposalSummary.totalCount -
                                        msg.proposalSummary.previewTitles.length}{' '}
                                      más
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTab('draft');
                                      setHasUnreadDraftChanges(false);
                                    }}
                                    className="flex-1 min-h-[38px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out"
                                    style={{
                                      touchAction: 'manipulation',
                                      backgroundColor: 'var(--surface-inset)',
                                      borderColor: 'var(--border-control)',
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    <span>Revisar / ajustar metas</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      onApplyPlan(
                                        stripChangeTypes(generatedTasks),
                                        sessionSideQuests
                                      )
                                    }
                                    className="min-h-[38px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
                                    style={{
                                      touchAction: 'manipulation',
                                      backgroundColor: 'var(--accent-fill)',
                                      color: 'var(--on-accent)',
                                    }}
                                  >
                                    <Check className="size-3.5" />
                                    <span>Guardar</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {showQuickReplies && (
                              <QuickReplyOptionsCard
                                options={msg.suggestedQuickReplies!}
                                mode={msg.quickReplySelectionMode}
                                disabled={isBusy}
                                onSendSelected={(combined) => void sendToAi({ text: combined })}
                                onInsertIntoComposer={(combined) => {
                                  setTextInput((prev) =>
                                    prev.trim() ? `${prev.trim()}. ${combined}` : combined
                                  );
                                }}
                              />
                            )}
                          </div>
                        );
                      })}

                      {isAiThinking && (
                        <div ref={lastMsgRef} className="flex items-start">
                          <div
                            className="rounded-2xl rounded-bl-md px-3.5 py-2.5 border flex items-center gap-2"
                            style={{
                              backgroundColor: 'var(--surface-inset)',
                              borderColor: 'var(--border-subtle)',
                            }}
                          >
                            <Sparkles
                              className="size-3.5 shrink-0"
                              style={{ color: 'var(--accent-text)' }}
                            />
                            <AIThinkingStatus
                              states={
                                hasReadyTasks ? PROPOSAL_THINKING_STATES : DISCOVERY_THINKING_STATES
                              }
                            />
                          </div>
                        </div>
                      )}

                      {apiError && (
                        <div
                          role="alert"
                          className="rounded-2xl p-3 border text-xs leading-relaxed"
                          style={{
                            backgroundColor:
                              'color-mix(in srgb, var(--status-danger) 10%, transparent)',
                            borderColor:
                              'color-mix(in srgb, var(--status-danger) 35%, transparent)',
                            color: 'var(--status-danger)',
                          }}
                        >
                          {apiError}
                        </div>
                      )}

                      {/* Complementary Side Quest Offer ONLY AFTER AI actually delivers a ready proposal */}
                      {hasAiProposalReady &&
                        !dismissedSideQuestOffer &&
                        sessionSideQuests.length === 0 &&
                        !isAiThinking && (
                          <section
                            aria-label="Sugerencia de misión secundaria complementaria"
                            className="rounded-2xl border p-3.5 flex flex-col gap-2.5"
                            style={{
                              backgroundColor: 'var(--surface-inset)',
                              borderColor: 'var(--border-subtle)',
                            }}
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className="size-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: 'var(--surface-card)',
                                  borderColor: 'var(--border-subtle)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <Trophy className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p
                                  className="text-xs font-bold leading-snug"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  {sideQuestSuggestion
                                    ? `¿Sumamos misión secundaria: "${sideQuestSuggestion.title}"?`
                                    : '¿Querés sumar una misión secundaria complementaria?'}
                                </p>
                                <p
                                  className="text-[11px] mt-0.5 leading-relaxed"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {sideQuestSuggestion
                                    ? sideQuestSuggestion.reason
                                    : 'Un mini-desafío paralelo diseñado con IA para potenciar tu plan.'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenSideQuestDesigner(sideQuestSuggestion?.ideaPrompt)
                                }
                                className="min-h-[36px] px-3 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                                style={{
                                  touchAction: 'manipulation',
                                  backgroundColor: 'var(--surface-card)',
                                  borderColor: 'var(--border-control)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <Sparkles className="size-3.5" />
                                <span>Diseñar misión con IA</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDismissedSideQuestOffer(true)}
                                className="min-h-[36px] px-3 rounded-xl text-xs font-medium cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                                style={{
                                  touchAction: 'manipulation',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                Ahora no
                              </button>
                            </div>
                          </section>
                        )}

                      {micBlocked && (
                        <div
                          className="rounded-xl p-3 border text-xs flex items-center justify-between gap-2"
                          style={{
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span>
                            {recError ||
                              'Micrófono bloqueado. Podés escribir acá abajo o refrescar.'}
                          </span>
                          <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold shrink-0 cursor-pointer"
                            style={{
                              backgroundColor: 'var(--surface-card)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--accent-text)',
                            }}
                          >
                            <RefreshCw className="size-3" />
                            Refrescar
                          </button>
                        </div>
                      )}
                    </div>

                    {showScrollBottom && (
                      <button
                        type="button"
                        onClick={() => scrollToLatestMessage('smooth')}
                        aria-label="Ir al último mensaje"
                        className="absolute right-4 bottom-3 size-9 rounded-full border shadow-md flex items-center justify-center cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                        style={{
                          touchAction: 'manipulation',
                          backgroundColor: 'var(--surface-raised)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  /* Draft Tab: Clean iOS Inset Grouped List of Proposed/Current Tasks + Side Quests */
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3.5 flex flex-col gap-3.5">
                    <div className="flex items-center justify-between gap-2 px-0.5">
                      <div>
                        <h3 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          {hasAiProposalReady
                            ? `Tu plan propuesto (${generatedTasks.length} metas)`
                            : `Metas actuales en base (${generatedTasks.length})`}
                        </h3>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Tocá las que quieras modificar con IA o editá todo manualmente
                        </p>
                      </div>
                      <span
                        className="pv2-chip text-[11px] shrink-0"
                        style={{ color: 'var(--status-warning)' }}
                      >
                        Sin guardar
                      </span>
                    </div>

                    <ul
                      aria-label="Lista de metas del plan"
                      className="rounded-2xl border overflow-hidden divide-y"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      {generatedTasks.map((task, idx) => {
                        const Icon = getCustomTaskIcon(task.icon);
                        const isChecked = selectedTaskSet.has(task.id);

                        return (
                          <li key={task.id} style={{ borderColor: 'var(--divider)' }}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isChecked}
                              onClick={() => toggleTaskSelection(task.id)}
                              className="w-full text-left flex items-start gap-2.5 p-3 transition-colors duration-150 ease-out cursor-pointer"
                              style={{
                                touchAction: 'manipulation',
                                backgroundColor: isChecked
                                  ? 'color-mix(in srgb, var(--accent-fill) 10%, var(--surface-card))'
                                  : 'transparent',
                              }}
                            >
                              <span
                                className="t-check mt-0.5 size-5 rounded-md border flex items-center justify-center shrink-0"
                                aria-checked={isChecked}
                                style={{
                                  backgroundColor: isChecked ? 'var(--accent-fill)' : 'transparent',
                                  borderColor: isChecked
                                    ? 'var(--accent-fill)'
                                    : 'var(--border-control)',
                                  color: 'var(--on-accent)',
                                }}
                              >
                                <svg
                                  viewBox="0 0 10.1668 10.1668"
                                  className="size-3 fill-none stroke-current"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M1 5.52L3.92 9.17L9.17 1" />
                                </svg>
                              </span>

                              <div
                                className="size-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: 'var(--surface-card)',
                                  borderColor: 'var(--border-subtle)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <Icon className="size-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className="text-xs font-bold tabular-nums"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    {idx + 1}.
                                  </span>
                                  <span
                                    className="text-sm font-bold leading-snug"
                                    style={{ color: 'var(--text-primary)' }}
                                  >
                                    {task.title}
                                  </span>
                                  {task.changeType === 'added' && (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor:
                                          'color-mix(in srgb, var(--status-success) 16%, transparent)',
                                        color: 'var(--status-success)',
                                      }}
                                    >
                                      Nueva
                                    </span>
                                  )}
                                  {task.changeType === 'modified' && (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor:
                                          'color-mix(in srgb, var(--status-info) 16%, transparent)',
                                        color: 'var(--status-info)',
                                      }}
                                    >
                                      Editada
                                    </span>
                                  )}
                                  {isChecked && (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor:
                                          'color-mix(in srgb, var(--accent-fill) 16%, transparent)',
                                        color: 'var(--accent-text)',
                                      }}
                                    >
                                      Marcada
                                    </span>
                                  )}
                                </div>
                                <p
                                  className="text-xs mt-0.5 leading-relaxed"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {task.description}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Session Side Quests section inside Draft Tab */}
                    <section
                      aria-label="Misiones secundarias complementarias"
                      className="rounded-2xl border p-3.5 flex flex-col gap-2.5"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Trophy className="size-4" style={{ color: 'var(--accent-text)' }} />
                          <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                            Misiones secundarias ({sessionSideQuests.length})
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenSideQuestDesigner(sideQuestSuggestion?.ideaPrompt ?? '')
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                          style={{ color: 'var(--accent-text)' }}
                        >
                          <Plus className="size-3.5" />
                          <span>Sumar con IA</span>
                        </button>
                      </div>

                      {sessionSideQuests.length === 0 ? (
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Opcional: podés diseñar una misión paralela corta que complemente tu plan.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {sessionSideQuests.map((quest, idx) => {
                            const SQIcon = getSideQuestIcon(quest.icon);
                            return (
                              <li
                                key={`${quest.title}-${idx}`}
                                className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border"
                                style={{
                                  backgroundColor: 'var(--surface-card)',
                                  borderColor: 'var(--border-subtle)',
                                }}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className="size-7 rounded-lg flex items-center justify-center shrink-0"
                                    style={{
                                      backgroundColor: 'var(--surface-inset)',
                                      color: 'var(--accent-text)',
                                    }}
                                  >
                                    <SQIcon className="size-3.5" />
                                  </span>
                                  <div className="min-w-0">
                                    <p
                                      className="text-xs font-bold truncate"
                                      style={{ color: 'var(--text-primary)' }}
                                    >
                                      {quest.title}
                                    </p>
                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                      {quest.durationDays} días · {quest.tasks.length} tareas
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSessionSideQuests((prev) =>
                                      prev.filter((_, i) => i !== idx)
                                    )
                                  }
                                  aria-label={`Quitar misión ${quest.title}`}
                                  className="size-9 rounded-lg flex items-center justify-center cursor-pointer"
                                  style={{ color: 'var(--status-danger)' }}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  </div>
                )}

                {/* Contextual Footer: Slim Composer in Chat Tab | Full Actions in Draft Tab */}
                <footer
                  className="shrink-0 border-t px-4 sm:px-5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-2"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--divider)',
                  }}
                >
                  {activeTab === 'chat' ? (
                    <>
                      {selectedTaskIds.length > 0 && (
                        <div
                          className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs"
                          style={{
                            backgroundColor:
                              'color-mix(in srgb, var(--accent-fill) 10%, var(--surface-inset))',
                            borderColor: 'color-mix(in srgb, var(--accent-fill) 35%, transparent)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <span className="truncate font-medium">
                            {selectedTaskIds.length}{' '}
                            {selectedTaskIds.length === 1 ? 'meta marcada' : 'metas marcadas'} para
                            modificar
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedTaskIds([])}
                            className="text-[11px] font-semibold underline cursor-pointer shrink-0"
                            style={{ color: 'var(--accent-text)' }}
                          >
                            Desmarcar
                          </button>
                        </div>
                      )}

                      <AutoGrowComposer
                        textareaRef={textareaRef}
                        value={textInput}
                        onChange={setTextInput}
                        onSubmitText={handleTextSubmit}
                        placeholder={
                          selectedTaskIds.length > 0
                            ? 'Decime qué cambiar en las marcadas...'
                            : 'Escribí o usá el micrófono...'
                        }
                        disabled={isBusy}
                        micBlocked={micBlocked}
                        voiceStatus={recStatus}
                        isSpeaking={isSpeaking}
                        elapsedSeconds={elapsedSeconds}
                        subscribeAudioMetrics={subscribeAudioMetrics}
                        onStartVoice={() => void startRecording()}
                        onCancelVoice={cancelRecording}
                        onPauseVoice={pauseRecording}
                        onResumeVoice={resumeRecording}
                        onStopAndTranscribeVoice={() => void handleStopAndTranscribe()}
                        onSendVoiceDirect={() => void handleSendVoiceDirect()}
                      />

                      {!hasReadyTasks && history.length > 0 && recStatus === 'idle' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void sendToAi({ forceProposal: true })}
                          className="w-full min-h-[40px] px-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-control)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <Sparkles className="size-3.5" style={{ color: 'var(--accent-text)' }} />
                          <span>Armar propuesta de tareas ahora</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selectedTaskIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('chat');
                            requestAnimationFrame(() => textareaRef.current?.focus());
                          }}
                          className="w-full min-h-[42px] px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-control)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <Sparkles className="size-3.5" style={{ color: 'var(--accent-text)' }} />
                          <span>Pedir cambios a la IA ({selectedTaskIds.length})</span>
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onEditManually(stripChangeTypes(generatedTasks))}
                          className="min-h-[44px] px-3.5 rounded-xl font-semibold text-xs border inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out disabled:opacity-50"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <Pencil className="size-3.5" />
                          <span>Manual</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            onApplyPlan(stripChangeTypes(generatedTasks), sessionSideQuests)
                          }
                          className="flex-1 min-h-[44px] px-4 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--accent-fill)',
                            color: 'var(--on-accent)',
                          }}
                        >
                          <Check className="size-4" />
                          <span>{isSaving ? 'Guardando...' : saveButtonLabel}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </footer>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

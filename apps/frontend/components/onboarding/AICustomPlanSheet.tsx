'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Check,
  ChevronRight,
  ListChecks,
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
  type AiClarificationQuestion,
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
import {
  formatTaskBadge,
  getCustomTaskIcon,
  type CustomTask,
} from './CustomTaskEditorSheet';
import AISideQuestSheet, { getSideQuestIcon } from './AISideQuestSheet';
import {
  AIConversationStreamItem,
  AIStudioTabs,
  DraftChangeBadge,
  DraftSelectionIndicator,
  isAbortError,
} from './AIConversationalStudio';
import AIThinkingStatus from './AIThinkingStatus';
import AutoGrowComposer from './AutoGrowComposer';
import QuickReplyOptionsCard, { isConfirmationQuickReply } from './QuickReplyOptionsCard';

type DraftCustomTask = CustomTask & {
  changeType?: 'kept' | 'modified' | 'added';
};

type AsyncActionLock = 'ai' | 'voice' | 'save' | 'manual' | null;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  clarificationQuestions?: AiClarificationQuestion[];
  suggestedQuickReplies?: string[];
  quickReplySelectionMode?: QuickReplySelectionMode;
  proposalSummary?: PlanProposalSummary;
}

export type AICustomPlanSheetProps = {
  isOpen: boolean;
  /** Render only the studio content inside a parent-owned dialog shell. */
  embedded?: boolean;
  /** Report the title ID for the currently rendered embedded subview. */
  onTitleIdChange?: (titleId: 'ai-plan-sheet-title' | 'ai-side-quest-title') => void;
  /** Register a parent-owned back action for an active nested embedded view. */
  onBackHandlerChange?: (handler: (() => boolean) | null) => void;
  /** Report whether a synchronous terminal action is blocking parent dismissal. */
  onDismissLockChange?: (locked: boolean) => void;
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
    cadence: t.cadence ?? 'daily',
    measurementType: t.measurementType ?? 'boolean',
    targetValue: t.targetValue ?? 1,
    targetUnit: t.targetUnit ?? '',
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
      cadence: t.cadence ?? 'daily',
      measurementType: t.measurementType ?? 'boolean',
      targetValue: t.targetValue ?? 1,
      targetUnit: t.targetUnit ?? '',
    }));
}

function stripChangeTypes(tasks: DraftCustomTask[]): CustomTask[] {
  return tasks.map(
    ({ id, title, description, icon, cadence, measurementType, targetValue, targetUnit }) => ({
      id,
      title,
      description,
      icon,
      cadence,
      measurementType,
      targetValue,
      targetUnit,
    })
  );
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
  embedded = false,
  onTitleIdChange,
  onBackHandlerChange,
  onDismissLockChange,
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
  const [isApplying, setIsApplying] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const mountedRef = useRef(true);
  const openGenerationRef = useRef(0);
  const requestSequenceRef = useRef(0);
  const activeAbortRef = useRef<AbortController | null>(null);
  const actionLockRef = useRef<AsyncActionLock>(null);

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

  const invalidateActiveWork = useCallback(() => {
    requestSequenceRef.current += 1;
    activeAbortRef.current?.abort();
    activeAbortRef.current = null;
    actionLockRef.current = null;
    cancelRecording();
    resetStatus();
    setIsApplying(false);
  }, [cancelRecording, resetStatus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      openGenerationRef.current += 1;
      requestSequenceRef.current += 1;
      activeAbortRef.current?.abort();
      activeAbortRef.current = null;
      actionLockRef.current = null;
      cancelRecording();
    };
  }, [cancelRecording]);

  // Initialize only on a false → true boundary. Parent context updates must not
  // wipe an active conversation or let an older request populate a new session.
  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        openGenerationRef.current += 1;
        invalidateActiveWork();
      }
      return;
    }
    if (wasOpenRef.current) return;

    wasOpenRef.current = true;
    openGenerationRef.current += 1;
    invalidateActiveWork();
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
  }, [isOpen, initialTasks, invalidateActiveWork, sheetY, userContext]);

  const handleRequestClose = useCallback(() => {
    if (isSaving || actionLockRef.current === 'save') return;
    openGenerationRef.current += 1;
    invalidateActiveWork();
    onClose();
  }, [invalidateActiveWork, isSaving, onClose]);

  const handleLeaveSideQuest = useCallback(() => {
    if (isSaving || actionLockRef.current === 'save') return;
    invalidateActiveWork();
    setSubView('plan');
  }, [invalidateActiveWork, isSaving]);

  useEffect(() => {
    if (!isOpen || embedded) return;

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
  }, [embedded, isOpen]);

  useEffect(() => {
    if (!isOpen || embedded) return;
    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog?.contains(document.activeElement)) {
        dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
      }
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [embedded, isOpen, subView]);

  useEffect(() => {
    if (!isOpen || embedded) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (subView === 'side-quest') {
          handleLeaveSideQuest();
          return;
        }
        handleRequestClose();
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
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [embedded, handleLeaveSideQuest, handleRequestClose, isOpen, subView]);

  useEffect(() => {
    if (!isOpen || !embedded) return;
    onTitleIdChange?.(
      subView === 'side-quest' ? 'ai-side-quest-title' : 'ai-plan-sheet-title'
    );
  }, [isOpen, embedded, subView, onTitleIdChange]);

  const handleEmbeddedBack = useCallback(() => {
    if (subView !== 'side-quest') return false;
    handleLeaveSideQuest();
    return true;
  }, [handleLeaveSideQuest, subView]);

  useEffect(() => {
    if (!isOpen || !embedded || !onBackHandlerChange) return;
    onBackHandlerChange(handleEmbeddedBack);
    return () => onBackHandlerChange(null);
  }, [embedded, handleEmbeddedBack, isOpen, onBackHandlerChange]);

  useEffect(() => {
    if (!embedded || !onDismissLockChange) return;
    onDismissLockChange(isOpen && (isSaving || isApplying));
    return () => onDismissLockChange(false);
  }, [embedded, isApplying, isOpen, isSaving, onDismissLockChange]);

  const scrollToLatestMessage = useCallback(
    (behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth') => {
      const container = chatScrollRef.current;
      const target = lastMsgRef.current;
      if (!container) return;
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      if (target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const targetTopInScroll = container.scrollTop + (targetRect.top - containerRect.top) - 10;
        const nextTop =
          targetRect.height <= container.clientHeight - 8
            ? maxScroll
            : Math.max(0, Math.min(targetTopInScroll, maxScroll));
        container.scrollTo({
          top: nextTop,
          behavior,
        });
      } else {
        container.scrollTo({ top: maxScroll, behavior });
      }
    },
    [reduceMotion]
  );

  useEffect(() => {
    if (!isOpen || subView !== 'plan' || activeTab !== 'chat') return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      scrollToLatestMessage('auto');
      raf2 = requestAnimationFrame(() => scrollToLatestMessage());
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
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

  const isVoiceLifecycleActive =
    recStatus === 'requesting-permission' ||
    recStatus === 'recording' ||
    recStatus === 'paused' ||
    recStatus === 'stopping' ||
    recStatus === 'transcribing' ||
    recStatus === 'processing';
  const isBusy = isVoiceLifecycleActive || isSaving || isApplying;
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
    if (!isOpen || isSaving || actionLockRef.current !== null) return;

    const generation = openGenerationRef.current;
    const requestId = ++requestSequenceRef.current;
    const controller = new AbortController();
    activeAbortRef.current?.abort();
    activeAbortRef.current = controller;
    actionLockRef.current = 'ai';
    const isCurrent = () =>
      mountedRef.current &&
      openGenerationRef.current === generation &&
      requestSequenceRef.current === requestId &&
      !controller.signal.aborted;

    setApiError(null);
    setActiveTab('chat');
    setProcessing(true);

    const optimisticMsgId = `plan-user-${generation}-${requestId}`;
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

      const res = await aiService.generateCustomPlan(
        {
          audioBase64: opts.audioBase64,
          mimeType: opts.mimeType,
          textInput: opts.text,
          history,
          currentTasks: currentAiTasks,
          selectedTaskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
          understoodFacts: understoodFacts.length > 0 ? understoodFacts : undefined,
          userContext: contextWithSessionQuests,
          forceProposal: opts.forceProposal,
        },
        controller.signal
      );
      if (!isCurrent()) return;

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
          id: `plan-ai-${generation}-${requestId}`,
          role: 'assistant',
          text: res.assistantMessage,
          openQuestions: res.openQuestions ?? [],
          clarificationQuestions: res.clarificationQuestions ?? [],
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
    } catch (error: unknown) {
      if (!isCurrent()) return;
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMsgId));
      if (isAbortError(error)) return;
      setApiError(
        error instanceof Error && error.message
          ? error.message
          : 'No pudimos comunicarnos con la IA en este momento. Tu borrador sigue intacto.'
      );
    } finally {
      if (activeAbortRef.current === controller) activeAbortRef.current = null;
      if (
        mountedRef.current &&
        openGenerationRef.current === generation &&
        requestSequenceRef.current === requestId
      ) {
        actionLockRef.current = null;
        setProcessing(false);
      }
    }
  };

  const handleStopAndTranscribe = async () => {
    if (!isOpen || isSaving || actionLockRef.current !== null) return;
    const generation = openGenerationRef.current;
    const requestId = ++requestSequenceRef.current;
    actionLockRef.current = 'voice';
    let controller: AbortController | null = null;
    const isCurrent = () =>
      mountedRef.current &&
      openGenerationRef.current === generation &&
      requestSequenceRef.current === requestId &&
      !controller?.signal.aborted;

    try {
      const result = await stopRecording();
      if (!isCurrent()) return;
      if (result.kind !== 'success' || result.blob.size === 0) {
        if (result.kind === 'empty' || result.kind === 'success') resetStatus();
        return;
      }
      setApiError(null);
      setTranscribing(true);
      const base64 = await blobToBase64(result.blob);
      if (!isCurrent()) return;

      controller = new AbortController();
      activeAbortRef.current = controller;
      const res = await aiService.transcribeAudio(
        { audioBase64: base64, mimeType: result.mimeType },
        controller.signal
      );
      if (!isCurrent()) return;
      if (!res.hasSpeech || !res.transcript.trim()) {
        setApiError('No detectamos voz clara en el audio. Probá hablar más cerca del micrófono.');
        return;
      }
      setTextInput((prev) =>
        prev.trim() ? `${prev.trim()} ${res.transcript.trim()}` : res.transcript.trim()
      );
      requestAnimationFrame(() => {
        if (isCurrent()) textareaRef.current?.focus();
      });
    } catch (error: unknown) {
      if (!isCurrent() || isAbortError(error)) return;
      setApiError(
        error instanceof Error && error.message
          ? error.message
          : 'No pudimos transcribir el audio. Intentá de nuevo.'
      );
    } finally {
      if (controller && activeAbortRef.current === controller) activeAbortRef.current = null;
      if (
        mountedRef.current &&
        openGenerationRef.current === generation &&
        requestSequenceRef.current === requestId
      ) {
        actionLockRef.current = null;
        setTranscribing(false);
      }
    }
  };

  const handleSendVoiceDirect = async () => {
    if (!isOpen || isSaving || actionLockRef.current !== null) return;
    const generation = openGenerationRef.current;
    const requestId = ++requestSequenceRef.current;
    actionLockRef.current = 'voice';
    let handedOff = false;

    try {
      const result = await stopRecording();
      if (
        !mountedRef.current ||
        openGenerationRef.current !== generation ||
        requestSequenceRef.current !== requestId
      ) {
        return;
      }
      if (result.kind !== 'success' || result.blob.size === 0) {
        if (result.kind === 'empty' || result.kind === 'success') resetStatus();
        return;
      }
      const base64 = await blobToBase64(result.blob);
      if (
        !mountedRef.current ||
        openGenerationRef.current !== generation ||
        requestSequenceRef.current !== requestId
      ) {
        return;
      }
      actionLockRef.current = null;
      handedOff = true;
      await sendToAi({ audioBase64: base64, mimeType: result.mimeType });
    } catch (error: unknown) {
      if (
        mountedRef.current &&
        openGenerationRef.current === generation &&
        requestSequenceRef.current === requestId &&
        !isAbortError(error)
      ) {
        setApiError(
          error instanceof Error && error.message
            ? error.message
            : 'No pudimos preparar el audio. Intentá de nuevo.'
        );
      }
    } finally {
      if (
        !handedOff &&
        mountedRef.current &&
        openGenerationRef.current === generation &&
        requestSequenceRef.current === requestId
      ) {
        actionLockRef.current = null;
      }
    }
  };

  const handleStartVoice = () => {
    if (!isOpen || isBusy || actionLockRef.current !== null) return;
    void startRecording();
  };

  const handleTextSubmit = async () => {
    const trimmed = textInput.trim();
    if (!trimmed || isBusy || actionLockRef.current !== null) return;
    setTextInput('');
    await sendToAi({ text: trimmed });
  };

  const handleSelectDraftTab = () => {
    if (isSaving || actionLockRef.current === 'save') return;
    invalidateActiveWork();
    setActiveTab('draft');
    setHasUnreadDraftChanges(false);
  };

  const handleOpenSideQuestDesigner = (ideaPrompt?: string) => {
    if (isSaving || actionLockRef.current === 'save') return;
    invalidateActiveWork();
    setSideQuestInitialPrompt(ideaPrompt ?? '');
    setSubView('side-quest');
  };

  const handleAddSessionSideQuest = async (quest: AiSideQuestDraft) => {
    if (actionLockRef.current === 'save') return;
    const normalized = quest.title.trim().toLowerCase();
    setSessionSideQuests((prev) => {
      const idx = prev.findIndex((q) => q.title.trim().toLowerCase() === normalized);
      if (idx === -1) return [...prev, quest];
      return prev.map((q, i) => (i === idx ? quest : q));
    });
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

  const handleEditManually = () => {
    if (isBusy || actionLockRef.current !== null) return;
    openGenerationRef.current += 1;
    invalidateActiveWork();
    actionLockRef.current = 'manual';
    onDismissLockChange?.(true);
    onEditManually(stripChangeTypes(generatedTasks));
  };

  const handleApplyPlan = async () => {
    if (isBusy || actionLockRef.current !== null) return;
    invalidateActiveWork();
    const generation = openGenerationRef.current;
    actionLockRef.current = 'save';
    setIsApplying(true);
    onDismissLockChange?.(true);
    try {
      await onApplyPlan(stripChangeTypes(generatedTasks), sessionSideQuests);
    } catch (error: unknown) {
      if (mountedRef.current && openGenerationRef.current === generation) {
        setApiError(error instanceof Error && error.message ? error.message : 'No pudimos guardar el plan.');
      }
    } finally {
      if (mountedRef.current && openGenerationRef.current === generation) {
        actionLockRef.current = null;
        setIsApplying(false);
        onDismissLockChange?.(false);
      }
    }
  };

  const hasReadyTasks = generatedTasks.length > 0;
  const canQuickSaveFromHeader =
    hasReadyTasks && (hasAiProposalReady || sessionSideQuests.length > 0);
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const studioBody = (
    <div className="relative w-full h-full min-h-0 flex flex-col overflow-hidden">
            {/* Embedded Side Quest Designer inside the same sheet (zero modal stacking) */}
            {subView === 'side-quest' ? (
              <AISideQuestSheet
                isOpen
                embedded
                onBack={handleLeaveSideQuest}
                initialIdeaPrompt={sideQuestInitialPrompt}
                userContext={enrichedContextForSideQuest}
                saveButtonLabel="Sumar al plan"
                onApplyQuest={handleAddSessionSideQuest}
                onClose={handleLeaveSideQuest}
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
                          onClick={() => void handleApplyPlan()}
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
                        disabled={isSaving || isApplying}
                        onClick={handleRequestClose}
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
                    <AIStudioTabs
                      ariaLabel="Secciones del diseñador de plan"
                      activeTab={activeTab}
                      draftIcon={ListChecks}
                      draftLabel={
                        <>
                          Metas ({generatedTasks.length}
                          {sessionSideQuests.length > 0 ? ` + ${sessionSideQuests.length}M` : ''})
                        </>
                      }
                      hasUnreadDraftChanges={hasUnreadDraftChanges}
                      onChatSelect={() => setActiveTab('chat')}
                      onDraftSelect={handleSelectDraftTab}
                    />
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
                          onClick={handleSelectDraftTab}
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
                        const hasClarifications =
                          (msg.clarificationQuestions?.length ?? 0) > 0 ||
                          (msg.openQuestions?.length ?? 0) > 0 ||
                          (msg.suggestedQuickReplies?.length ?? 0) > 0;
                        const showQuickReplies =
                          !isUser &&
                          msg.id === lastAssistantId &&
                          hasClarifications &&
                          !isAiThinking;

                        return (
                          <AIConversationStreamItem
                            key={msg.id}
                            ref={isLast ? lastMsgRef : undefined}
                            role={msg.role}
                            text={msg.text}
                            viaVoice={msg.viaVoice}
                            openQuestions={showQuickReplies ? [] : msg.openQuestions}
                          >

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
                                    onClick={handleSelectDraftTab}
                                    className="w-full min-h-[38px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out"
                                    style={{
                                      touchAction: 'manipulation',
                                      backgroundColor: 'var(--surface-inset)',
                                      borderColor: 'var(--border-control)',
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    <span>Revisar / ajustar metas</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {showQuickReplies && (
                              <QuickReplyOptionsCard
                                options={msg.suggestedQuickReplies ?? []}
                                openQuestions={msg.openQuestions}
                                clarificationQuestions={msg.clarificationQuestions}
                                mode={msg.quickReplySelectionMode}
                                disabled={isBusy}
                                onSendSelected={(combined) => {
                                  if (hasReadyTasks && isConfirmationQuickReply(combined)) {
                                    void handleApplyPlan();
                                    return;
                                  }
                                  void sendToAi({ text: combined });
                                }}
                                onInsertIntoComposer={(combined) => {
                                  setTextInput((prev) =>
                                    prev.trim() ? `${prev.trim()}. ${combined}` : combined
                                  );
                                }}
                              />
                            )}
                          </AIConversationStreamItem>
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
                    <div className="shrink-0 flex items-center justify-between gap-2 px-0.5">
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
                      className="shrink-0 rounded-2xl border overflow-hidden divide-y"
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
                              <DraftSelectionIndicator checked={isChecked} />

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
                                  <DraftChangeBadge changeType={task.changeType} />
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
                                <span
                                  className="mt-1 inline-block text-[11px] font-medium"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  {formatTaskBadge(task)}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Session Side Quests section inside Draft Tab */}
                    <section
                      aria-label="Misiones secundarias complementarias"
                      className="shrink-0 rounded-2xl border p-3.5 flex flex-col gap-2.5"
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
                        onStartVoice={handleStartVoice}
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
                          onClick={handleEditManually}
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
                          onClick={() => void handleApplyPlan()}
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
    </div>
  );

  if (embedded) {
    return isOpen ? studioBody : null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={subView === 'side-quest' ? 'ai-side-quest-title' : 'ai-plan-sheet-title'}
          onClick={(event) => event.stopPropagation()}
        >
          <motion.button
            type="button"
            aria-label="Cerrar asistente de IA"
            onClick={subView === 'side-quest' ? handleLeaveSideQuest : handleRequestClose}
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
                if (subView === 'side-quest') {
                  handleLeaveSideQuest();
                } else {
                  handleRequestClose();
                }
              } else {
                animate(sheetY, 0, {
                  ...SHEET_SNAP_SPRING,
                  velocity: info.velocity.y,
                });
              }
            }}
            className="relative z-10 w-full max-w-xl h-[95dvh] sm:h-[88dvh] max-h-[840px] rounded-t-3xl sm:rounded-3xl border flex flex-col overflow-hidden shadow-2xl"
          >
            {!isDesktop && (
              <div
                onPointerDown={(event) => dragControls.start(event)}
                className="flex justify-center pt-2.5 pb-0.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
              >
                <span
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border-control)' }}
                />
              </div>
            )}
            {studioBody}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  ArrowDown,
  ArrowLeft,
  Book,
  Check,
  Clock,
  Droplet,
  Dumbbell,
  Footprints,
  Moon,
  Pencil,
  RefreshCw,
  Sparkles,
  Sun,
  Target,
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
  type AiSideQuestDraft,
  type AiSideQuestIcon,
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
  AIConversationStreamItem,
  AIStudioTabs,
  DraftChangeBadge,
  DraftSelectionIndicator,
  isAbortError,
} from './AIConversationalStudio';
import AIThinkingStatus from './AIThinkingStatus';
import AutoGrowComposer from './AutoGrowComposer';
import QuickReplyOptionsCard, { isConfirmationQuickReply } from './QuickReplyOptionsCard';

const SIDE_QUEST_ICON_MAP: Record<
  AiSideQuestIcon,
  React.ComponentType<{ className?: string; size?: number }>
> = {
  target: Target,
  droplet: Droplet,
  dumbbell: Dumbbell,
  book: Book,
  sun: Sun,
  moon: Moon,
  apple: Apple,
  footprints: Footprints,
  clock: Clock,
};

export function getSideQuestIcon(icon?: string | null) {
  if (icon && icon in SIDE_QUEST_ICON_MAP) {
    return SIDE_QUEST_ICON_MAP[icon as AiSideQuestIcon];
  }
  return Trophy;
}

const DIFFICULTY_LABELS: Record<'Easy' | 'Medium' | 'Hard', string> = {
  Easy: 'Fácil',
  Medium: 'Media',
  Hard: 'Difícil',
};

const FREQUENCY_LABELS: Record<'daily' | 'weekly' | 'once', string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  once: 'Única vez',
};

const DISCOVERY_THINKING_STATES = [
  'Analizando tu misión...',
  'Revisando tu plan principal...',
  'Estructurando metas y duración...',
] as const;

const REFINEMENT_THINKING_STATES = [
  'Procesando tus ajustes...',
  'Actualizando tareas de la misión...',
] as const;

type AsyncActionLock = 'ai' | 'voice' | 'save' | 'manual' | null;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface QuestProposalSummary {
  title: string;
  durationDays: number;
  taskCount: number;
  addedCount: number;
  modifiedCount: number;
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
  proposalSummary?: QuestProposalSummary;
}

export type AISideQuestSheetProps = {
  isOpen: boolean;
  /** When true, renders only the studio body inside a parent-owned dialog shell. */
  embedded?: boolean;
  /** Accessible label for the embedded back action. */
  backButtonLabel?: string;
  onBack?: () => void;
  initialQuest?: AiSideQuestDraft | null;
  initialIdeaPrompt?: string;
  userContext?: AiUserContext;
  saveButtonLabel?: string;
  isSaving?: boolean;
  onApplyQuest: (quest: AiSideQuestDraft) => void | Promise<void>;
  onEditManually?: (quest: AiSideQuestDraft) => void;
  onClose: () => void;
};

function normalizeQuestDraft(quest: AiSideQuestDraft): AiSideQuestDraft {
  const stamp = Date.now();
  return {
    ...quest,
    icon: (quest.icon in SIDE_QUEST_ICON_MAP ? quest.icon : 'target') as AiSideQuestIcon,
    tasks: quest.tasks.map((task, idx) => ({
      ...task,
      id: task.id?.trim() || `sq-task-${stamp}-${idx}`,
      description: task.description ?? '',
      icon: (task.icon in SIDE_QUEST_ICON_MAP ? task.icon : 'target') as AiSideQuestIcon,
      frequency: task.frequency || 'daily',
      targetValue:
        typeof task.targetValue === 'number' && task.targetValue > 0 ? task.targetValue : null,
      targetUnit: task.targetUnit ?? '',
    })),
  };
}

export default function AISideQuestSheet({
  isOpen,
  embedded = false,
  backButtonLabel = 'Volver al plan principal',
  onBack,
  initialQuest = null,
  initialIdeaPrompt = '',
  userContext,
  saveButtonLabel = 'Guardar misión',
  isSaving = false,
  onApplyQuest,
  onEditManually,
  onClose,
}: AISideQuestSheetProps) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const sheetY = useMotionValue(0);
  const backdropOpacity = useTransform(sheetY, [0, 340], [1, 0]);

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

  const [activeTab, setActiveTab] = useState<'chat' | 'draft'>('chat');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [history, setHistory] = useState<AiConversationTurn[]>([]);
  const [understoodFacts, setUnderstoodFacts] = useState<string[]>([]);
  const [questDraft, setQuestDraft] = useState<AiSideQuestDraft | null>(null);
  const [hasAiUpdatedDraft, setHasAiUpdatedDraft] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
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
  const hasMainPlan = Boolean(userContext?.mainPlanTasks && userContext.mainPlanTasks.length > 0);

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

  // Initialize only on a false → true boundary. Parent prop identity changes must
  // not wipe an active conversation or let work from an older opening commit here.
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
    setActiveTab('chat');
    setApiError(null);
    setHistory([]);
    setUnderstoodFacts([]);
    setSelectedTaskIds([]);
    setHasAiUpdatedDraft(false);
    setTextInput(initialIdeaPrompt.trim());

    const normalizedInitial = initialQuest ? normalizeQuestDraft(initialQuest) : null;
    setQuestDraft(normalizedInitial);

    const introText = normalizedInitial
      ? 'Ya tenés tu borrador disponible en la pestaña "Misión". Contame acá qué querés ajustar o marcá tareas puntuales para editarlas.'
      : hasMainPlan
        ? 'Contame qué misión secundaria te gustaría crear (por texto o voz). Tengo en cuenta tu plan principal para que sea 100% complementaria.'
        : 'Contame qué misión secundaria querés diseñar (ej. 21 días sin azúcar, dormir mejor o sumar pasos). Si queda algo abierto, te lo agrupo en un solo mensaje.';

    setMessages([
      {
        id: `sq-welcome-${Date.now()}`,
        role: 'assistant',
        text: introText,
      },
    ]);
  }, [hasMainPlan, initialIdeaPrompt, initialQuest, invalidateActiveWork, isOpen, sheetY]);

  const handleRequestClose = useCallback(() => {
    if (isSaving || actionLockRef.current === 'save') return;
    openGenerationRef.current += 1;
    invalidateActiveWork();
    onClose();
  }, [invalidateActiveWork, isSaving, onClose]);

  const handleEmbeddedBack = useCallback(() => {
    if (isSaving || actionLockRef.current === 'save') return;
    openGenerationRef.current += 1;
    invalidateActiveWork();
    (onBack ?? onClose)();
  }, [invalidateActiveWork, isSaving, onBack, onClose]);

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
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
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
  }, [embedded, handleRequestClose, isOpen]);

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
    if (!isOpen || activeTab !== 'chat') return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      scrollToLatestMessage('auto');
      raf2 = requestAnimationFrame(() => scrollToLatestMessage());
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [messages.length, recStatus, activeTab, isOpen, scrollToLatestMessage]);

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

    const optimisticMsgId = `sq-user-${generation}-${requestId}`;
    const isVoice = Boolean(opts.audioBase64);
    const optimisticText = opts.forceProposal
      ? 'Armá la propuesta de misión con lo que hablamos.'
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
      const res = await aiService.generateSideQuest(
        {
          audioBase64: opts.audioBase64,
          mimeType: opts.mimeType,
          textInput: opts.text,
          history,
          currentQuest: questDraft,
          selectedTaskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
          understoodFacts: understoodFacts.length > 0 ? understoodFacts : undefined,
          userContext,
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

      let summary: QuestProposalSummary | undefined;
      if (res.quest) {
        const normalized = normalizeQuestDraft(res.quest);
        setQuestDraft(normalized);
        setHasAiUpdatedDraft(true);
        setSelectedTaskIds([]);
        summary = {
          title: normalized.title,
          durationDays: normalized.durationDays,
          taskCount: normalized.tasks.length,
          addedCount: normalized.tasks.filter((t) => t.changeType === 'added').length,
          modifiedCount: normalized.tasks.filter((t) => t.changeType === 'modified').length,
        };
      }

      setMessages((prev) => [
        ...prev.map((m) => (m.id === optimisticMsgId ? { ...m, text: resolvedUserText } : m)),
        {
          id: `sq-ai-${generation}-${requestId}`,
          role: 'assistant',
          text: res.assistantMessage,
          openQuestions: res.openQuestions ?? [],
          clarificationQuestions: res.clarificationQuestions ?? [],
          suggestedQuickReplies: res.suggestedQuickReplies ?? [],
          quickReplySelectionMode: res.quickReplySelectionMode ?? 'single',
          proposalSummary: summary,
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
          : 'No pudimos comunicarnos con la IA para la misión secundaria. Tu borrador sigue intacto.'
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
      const aiRequestId = requestId + 1;
      await sendToAi({ audioBase64: base64, mimeType: result.mimeType });
      if (
        !mountedRef.current ||
        openGenerationRef.current !== generation ||
        requestSequenceRef.current !== aiRequestId
      ) {
        return;
      }
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

    const generation = openGenerationRef.current;
    const requestId = ++requestSequenceRef.current;
    actionLockRef.current = 'voice';

    void startRecording().finally(() => {
      if (
        mountedRef.current &&
        openGenerationRef.current === generation &&
        requestSequenceRef.current === requestId
      ) {
        actionLockRef.current = null;
      }
    });
  };

  const handleTextSubmit = async () => {
    const trimmed = textInput.trim();
    if (!trimmed || isBusy || actionLockRef.current !== null) return;
    const generation = openGenerationRef.current;
    const nextRequestId = requestSequenceRef.current + 1;
    setTextInput('');
    await sendToAi({ text: trimmed });
    if (
      !mountedRef.current ||
      openGenerationRef.current !== generation ||
      requestSequenceRef.current !== nextRequestId
    ) {
      return;
    }
  };

  const handleSelectDraftTab = () => {
    if (isSaving || actionLockRef.current === 'save') return;
    invalidateActiveWork();
    setActiveTab('draft');
    setHasAiUpdatedDraft(false);
  };

  const handleEditManually = () => {
    if (!questDraft || !onEditManually || isBusy || actionLockRef.current !== null) return;
    openGenerationRef.current += 1;
    invalidateActiveWork();
    actionLockRef.current = 'manual';
    onEditManually(questDraft);
  };

  const handleApplyQuest = async () => {
    if (!questDraft || isBusy || actionLockRef.current !== null) return;
    invalidateActiveWork();
    const generation = openGenerationRef.current;
    actionLockRef.current = 'save';
    setIsApplying(true);
    try {
      await onApplyQuest(questDraft);
      if (!mountedRef.current || openGenerationRef.current !== generation) return;
    } catch (error: unknown) {
      if (!mountedRef.current || openGenerationRef.current !== generation) return;
      setApiError(
        error instanceof Error && error.message ? error.message : 'No pudimos guardar la misión.'
      );
    } finally {
      if (mountedRef.current && openGenerationRef.current === generation) {
        actionLockRef.current = null;
        setIsApplying(false);
      }
    }
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const studioBody = (
    <div className="h-full flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <header
        className="px-4 sm:px-5 pt-2.5 pb-3 border-b shrink-0 flex flex-col gap-2.5"
        style={{ borderColor: 'var(--divider)' }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {embedded && onBack ? (
              <button
                type="button"
                onClick={handleEmbeddedBack}
                aria-label={backButtonLabel}
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
                className="size-9 rounded-xl border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--surface-inset)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--accent-text)',
                }}
              >
                <Trophy className="size-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2
                  id="ai-side-quest-title"
                  className="text-[15px] sm:text-base font-bold leading-tight truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {embedded ? 'Misión secundaria con IA' : 'Diseñar Misión con IA'}
                </h2>
              </div>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {embedded
                  ? 'Complementaria a tu plan · Volvés al plan al guardar'
                  : 'Conversá por texto o voz y revisá antes de guardar'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {questDraft && activeTab === 'chat' && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleApplyQuest()}
                className="min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out disabled:opacity-50"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--accent-fill)',
                  color: 'var(--on-accent)',
                }}
              >
                <Check className="size-3.5" />
                <span>Guardar</span>
              </button>
            )}

            <button
              type="button"
              onClick={embedded && onBack ? handleEmbeddedBack : handleRequestClose}
              aria-label="Cerrar diseñador de misión"
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

        {/* Segmented Control: Conversación vs Misión (only when draft exists) */}
        {questDraft && (
          <AIStudioTabs
            ariaLabel="Vista del diseñador de misión"
            activeTab={activeTab}
            draftIcon={Trophy}
            draftLabel={<>Misión ({questDraft.tasks.length})</>}
            hasUnreadDraftChanges={hasAiUpdatedDraft}
            onChatSelect={() => setActiveTab('chat')}
            onDraftSelect={handleSelectDraftTab}
          />
        )}
      </header>

      {/* Main Content Area: Either Clean Unobstructed Chat OR Inset Grouped Draft View */}
      {activeTab === 'chat' ? (
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3.5 flex flex-col gap-3"
          >
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

                  {/* Compact Inline Proposal Card when AI creates/updates the quest */}
                  {!isUser && msg.proposalSummary && (
                    <div
                      className="mt-2 w-full max-w-[92%] rounded-2xl border p-3 flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: 'var(--surface-card)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="min-w-0">
                        <p
                          className="text-xs font-bold truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {msg.proposalSummary.title}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {msg.proposalSummary.durationDays} días · {msg.proposalSummary.taskCount}{' '}
                          {msg.proposalSummary.taskCount === 1 ? 'tarea' : 'tareas'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleSelectDraftTab}
                        className="min-h-[36px] px-3 rounded-xl border text-xs font-semibold shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                        style={{
                          touchAction: 'manipulation',
                          backgroundColor: 'var(--surface-inset)',
                          borderColor: 'var(--border-control)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        Ver misión
                      </button>
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
                        if (questDraft && isConfirmationQuickReply(combined)) {
                          void handleApplyQuest();
                          return;
                        }
                        void sendToAi({ text: combined });
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
                  <Sparkles className="size-3.5 shrink-0" style={{ color: 'var(--accent-text)' }} />
                  <AIThinkingStatus
                    states={questDraft ? REFINEMENT_THINKING_STATES : DISCOVERY_THINKING_STATES}
                  />
                </div>
              </div>
            )}

            {apiError && (
              <div
                role="alert"
                className="rounded-2xl p-3 border text-xs leading-relaxed"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--status-danger) 10%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--status-danger) 35%, transparent)',
                  color: 'var(--status-danger)',
                }}
              >
                {apiError}
              </div>
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
                <span>{recError || 'Micrófono bloqueado. Podés escribir acá abajo.'}</span>
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
        /* Draft Tab: Clean iOS Inset Grouped List (zero nested cards) */
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3.5 flex flex-col gap-3">
          {questDraft && (
            <>
              <div
                className="shrink-0 rounded-2xl border p-3.5 flex flex-col gap-2"
                style={{
                  backgroundColor: 'var(--surface-inset)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="size-9 rounded-xl border flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    {React.createElement(getSideQuestIcon(questDraft.icon), {
                      className: 'size-4',
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-sm font-bold leading-snug"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {questDraft.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="pv2-chip text-[11px]">
                        {DIFFICULTY_LABELS[questDraft.difficulty]}
                      </span>
                      <span className="pv2-chip text-[11px] tabular-nums">
                        {questDraft.durationDays} días
                      </span>
                      <span
                        className="pv2-chip text-[11px]"
                        style={{ color: 'var(--status-warning)' }}
                      >
                        Sin guardar
                      </span>
                    </div>
                  </div>
                </div>
                {questDraft.description && (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {questDraft.description}
                  </p>
                )}
              </div>

              <div className="shrink-0 flex items-center justify-between px-0.5">
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Tareas ({questDraft.tasks.length})
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Tocá para marcar cambios
                </span>
              </div>

              <ul
                className="shrink-0 rounded-2xl border overflow-hidden divide-y"
                style={{
                  backgroundColor: 'var(--surface-inset)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                {questDraft.tasks.map((task, idx) => {
                  const taskId = task.id || `sq-task-${idx}`;
                  const isChecked = selectedTaskSet.has(taskId);
                  const TaskIcon = getSideQuestIcon(task.icon);

                  return (
                    <li key={taskId} style={{ borderColor: 'var(--divider)' }}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        onClick={() => toggleTaskSelection(taskId)}
                        className="w-full text-left flex items-start gap-2.5 p-3 transition-colors duration-150 ease-out cursor-pointer"
                        style={{
                          touchAction: 'manipulation',
                          backgroundColor: isChecked
                            ? 'color-mix(in srgb, var(--accent-fill) 10%, var(--surface-card))'
                            : 'transparent',
                        }}
                      >
                        <DraftSelectionIndicator checked={isChecked} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <TaskIcon className="size-3.5 shrink-0" size={14} />
                            <span
                              className="text-xs font-bold leading-snug"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {task.title}
                            </span>
                            <DraftChangeBadge changeType={task.changeType} />
                          </div>

                          {task.description && (
                            <p
                              className="text-[11px] mt-0.5 leading-relaxed"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {task.description}
                            </p>
                          )}

                          <div
                            className="mt-1 flex flex-wrap items-center gap-2 text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <span>{FREQUENCY_LABELS[task.frequency]}</span>
                            {task.targetValue ? (
                              <span className="tabular-nums font-medium">
                                · Meta: {task.targetValue.toLocaleString('es-AR')} {task.targetUnit}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Contextual Footer: Slim Composer in Chat Tab | Clean Confirmation Bar in Draft Tab */}
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
                  backgroundColor: 'color-mix(in srgb, var(--accent-fill) 10%, var(--surface-inset))',
                  borderColor: 'color-mix(in srgb, var(--accent-fill) 35%, transparent)',
                  color: 'var(--text-primary)',
                }}
              >
                <span className="truncate font-medium">
                  {selectedTaskIds.length}{' '}
                  {selectedTaskIds.length === 1 ? 'tarea marcada' : 'tareas marcadas'} para ajustar
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
                  : 'Describí tu misión o usá el micrófono...'
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

            {!questDraft && history.length > 0 && recStatus === 'idle' && (
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
                <span>Generar propuesta de misión ahora</span>
              </button>
            )}
          </>
        ) : (
          questDraft && (
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
                  <span>Pedir cambios sobre seleccionadas ({selectedTaskIds.length})</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                {onEditManually && (
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
                )}

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleApplyQuest()}
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
          )
        )}
      </footer>
    </div>
  );

  if (embedded) {
    if (!isOpen) return null;
    return studioBody;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-side-quest-title"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            type="button"
            aria-label="Cerrar asistente de misión secundaria"
            onClick={handleRequestClose}
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
                handleRequestClose();
              } else {
                animate(sheetY, 0, {
                  ...SHEET_SNAP_SPRING,
                  velocity: info.velocity.y,
                });
              }
            }}
            className="relative z-10 w-full max-w-xl h-[95dvh] sm:h-[86dvh] max-h-[820px] rounded-t-3xl sm:rounded-3xl border flex flex-col overflow-hidden shadow-2xl"
          >
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

            {studioBody}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

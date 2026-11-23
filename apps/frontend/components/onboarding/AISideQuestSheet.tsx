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
  MessageSquare,
  Mic,
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
import AIThinkingStatus from './AIThinkingStatus';
import AutoGrowComposer from './AutoGrowComposer';
import QuickReplyOptionsCard from './QuickReplyOptionsCard';

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
  suggestedQuickReplies?: string[];
  quickReplySelectionMode?: QuickReplySelectionMode;
  proposalSummary?: QuestProposalSummary;
}

export type AISideQuestSheetProps = {
  isOpen: boolean;
  /** When true, renders inline inside a parent sheet (zero stacked modals) with a Back button */
  embedded?: boolean;
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

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedTaskSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const hasMainPlan = Boolean(userContext?.mainPlanTasks && userContext.mainPlanTasks.length > 0);

  useEffect(() => {
    if (!isOpen) return;
    sheetY.set(0);
    setActiveTab('chat');
    setApiError(null);
    setHistory([]);
    setUnderstoodFacts([]);
    setSelectedTaskIds([]);
    setHasAiUpdatedDraft(false);
    setTextInput(initialIdeaPrompt.trim());
    resetStatus();

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
  }, [isOpen, initialQuest, initialIdeaPrompt, hasMainPlan, resetStatus, sheetY]);

  useEffect(() => {
    if (!isOpen || embedded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, embedded, onClose]);

  const scrollToLatestMessage = useCallback(
    (behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth') => {
      const container = chatScrollRef.current;
      const target = lastMsgRef.current;
      if (!container) return;
      if (target) {
        // Anchor to the top of the latest message when tall so open questions never clip off-screen
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
    if (!isOpen || activeTab !== 'chat') return;
    const raf = requestAnimationFrame(() => scrollToLatestMessage());
    return () => cancelAnimationFrame(raf);
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

    const optimisticMsgId = `sq-user-${Date.now()}`;
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
      const res = await aiService.generateSideQuest({
        audioBase64: opts.audioBase64,
        mimeType: opts.mimeType,
        textInput: opts.text,
        history,
        currentQuest: questDraft,
        selectedTaskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
        understoodFacts: understoodFacts.length > 0 ? understoodFacts : undefined,
        userContext,
        forceProposal: opts.forceProposal,
      });

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
          id: `sq-ai-${Date.now()}`,
          role: 'assistant',
          text: res.assistantMessage,
          openQuestions: res.openQuestions ?? [],
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
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsgId));
      setApiError(
        err?.message ||
          'No pudimos comunicarnos con la IA para la misión secundaria. Tu borrador sigue intacto.'
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

  const QuestIcon = questDraft ? getSideQuestIcon(questDraft.icon) : Trophy;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const studioBody = (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
                onClick={onBack}
                aria-label="Volver al plan principal"
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
                onClick={() => onApplyQuest(questDraft)}
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
              onClick={embedded && onBack ? onBack : onClose}
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
          <div
            role="tablist"
            aria-label="Vista del diseñador de misión"
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
                backgroundColor: activeTab === 'chat' ? 'var(--surface-card)' : 'transparent',
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
                setHasAiUpdatedDraft(false);
              }}
              className="min-h-[34px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-150 ease-out"
              style={{
                touchAction: 'manipulation',
                backgroundColor: activeTab === 'draft' ? 'var(--surface-card)' : 'transparent',
                color: activeTab === 'draft' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              <Trophy className="size-3.5" />
              <span>Misión ({questDraft.tasks.length})</span>
              {hasAiUpdatedDraft && activeTab !== 'draft' && (
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: 'var(--accent-fill)' }}
                />
              )}
            </button>
          </div>
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
                        <Sparkles className="size-3" style={{ color: 'var(--accent-text)' }} />
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
                        style={{ borderColor: 'var(--divider)', color: 'var(--text-secondary)' }}
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
                        onClick={() => {
                          setActiveTab('draft');
                          setHasAiUpdatedDraft(false);
                        }}
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
                className="rounded-2xl border p-3.5 flex flex-col gap-2"
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
                    <QuestIcon className="size-4" />
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

              <div className="flex items-center justify-between px-0.5">
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
                className="rounded-2xl border overflow-hidden divide-y"
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
                        <span
                          className="t-check mt-0.5 size-5 rounded-md border flex items-center justify-center shrink-0"
                          aria-checked={isChecked}
                          style={{
                            backgroundColor: isChecked ? 'var(--accent-fill)' : 'transparent',
                            borderColor: isChecked ? 'var(--accent-fill)' : 'var(--border-control)',
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

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <TaskIcon className="size-3.5 shrink-0" size={14} />
                            <span
                              className="text-xs font-bold leading-snug"
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
              onStartVoice={() => void startRecording()}
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
                    onClick={() => onEditManually(questDraft)}
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
                  onClick={() => onApplyQuest(questDraft)}
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
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-side-quest-title"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            type="button"
            aria-label="Cerrar asistente de misión secundaria"
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

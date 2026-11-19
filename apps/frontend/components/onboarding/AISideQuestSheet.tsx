'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  Book,
  Check,
  Clock,
  Droplet,
  Dumbbell,
  Footprints,
  Mic,
  Moon,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Sun,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import {
  aiService,
  blobToBase64,
  type AiConversationTurn,
  type AiSideQuestDraft,
  type AiSideQuestIcon,
  type AiUserContext,
} from '@/lib/api/ai';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';
import AIThinkingStatus from './AIThinkingStatus';

const SIDE_QUEST_ICON_MAP: Record<AiSideQuestIcon, React.ComponentType<{ className?: string; size?: number }>> = {
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
  daily: 'Cada día',
  weekly: 'Cada semana',
  once: 'Una vez',
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

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  viaVoice?: boolean;
  openQuestions?: string[];
  suggestedQuickReplies?: string[];
}

export type AISideQuestSheetProps = {
  isOpen: boolean;
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
      targetValue: typeof task.targetValue === 'number' && task.targetValue > 0 ? task.targetValue : null,
      targetUnit: task.targetUnit ?? '',
    })),
  };
}

export default function AISideQuestSheet({
  isOpen,
  initialQuest = null,
  initialIdeaPrompt = '',
  userContext,
  saveButtonLabel = 'Guardar misión secundaria',
  isSaving = false,
  onApplyQuest,
  onEditManually,
  onClose,
}: AISideQuestSheetProps) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const {
    status: recStatus,
    audioLevel,
    errorMessage: recError,
    startRecording,
    stopRecording,
    setProcessing,
    resetStatus,
  } = useVoiceRecorder();

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [history, setHistory] = useState<AiConversationTurn[]>([]);
  const [understoodFacts, setUnderstoodFacts] = useState<string[]>([]);
  const [questDraft, setQuestDraft] = useState<AiSideQuestDraft | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTaskSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const hasMainPlan = Boolean(userContext?.mainPlanTasks && userContext.mainPlanTasks.length > 0);

  useEffect(() => {
    if (!isOpen) return;
    setApiError(null);
    setHistory([]);
    setUnderstoodFacts([]);
    setSelectedTaskIds([]);
    setTextInput(initialIdeaPrompt.trim());
    resetStatus();

    const normalizedInitial = initialQuest ? normalizeQuestDraft(initialQuest) : null;
    setQuestDraft(normalizedInitial);

    const introText = normalizedInitial
      ? 'Cargué tu borrador de misión secundaria. Marcá las tareas que quieras ajustar o decime si querés cambiar la duración, dificultad o sumar nuevas metas.'
      : hasMainPlan
      ? 'Contame qué misión secundaria te gustaría crear. Ya tengo en cuenta tu plan principal para que sea 100% complementaria y te preguntaré en un solo mensaje lo que falte definir.'
      : 'Contame qué misión secundaria querés diseñar (por ejemplo: 21 días sin azúcar, dormir mejor o caminar más). Te voy a preguntar lo que falte aclarar y armaremos sus tareas juntos.';

    setMessages([
      {
        id: `sq-welcome-${Date.now()}`,
        role: 'assistant',
        text: introText,
      },
    ]);
  }, [isOpen, initialQuest, initialIdeaPrompt, hasMainPlan, resetStatus]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    chatEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
  }, [messages, questDraft, recStatus, isOpen, reduceMotion]);

  const micBlocked =
    recStatus === 'permission-denied' ||
    recStatus === 'unsupported' ||
    recStatus === 'error';

  const isProcessing = recStatus === 'processing';
  const isRecording = recStatus === 'recording';

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
    setProcessing(true);

    const optimisticMsgId = `sq-user-${Date.now()}`;
    const isVoice = Boolean(opts.audioBase64);
    const optimisticText = opts.forceProposal
      ? 'Armá la propuesta de misión con lo que hablamos.'
      : opts.text?.trim() || 'Transcribiendo audio...';

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
          ? `${res.assistantMessage}\nPreguntas:\n${res.openQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
          : res.assistantMessage;

      setMessages((prev) => [
        ...prev.map((m) => (m.id === optimisticMsgId ? { ...m, text: resolvedUserText } : m)),
        {
          id: `sq-ai-${Date.now()}`,
          role: 'assistant',
          text: res.assistantMessage,
          openQuestions: res.openQuestions ?? [],
          suggestedQuickReplies: res.suggestedQuickReplies ?? [],
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

      if (res.quest) {
        setQuestDraft(normalizeQuestDraft(res.quest));
        setSelectedTaskIds([]);
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsgId));
      setApiError(
        err?.message || 'No pudimos comunicarnos con la IA para la misión secundaria. Intentá de nuevo.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleMicToggle = async () => {
    if (isProcessing) return;
    if (isRecording) {
      const result = await stopRecording();
      if (!result || result.blob.size === 0) return;
      const base64 = await blobToBase64(result.blob);
      await sendToAi({ audioBase64: base64, mimeType: result.mimeType });
      return;
    }
    await startRecording();
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = textInput.trim();
    if (!trimmed || isProcessing) return;
    setTextInput('');
    await sendToAi({ text: trimmed });
  };

  const handleQuickReply = (reply: string) => {
    setTextInput((prev) => (prev.trim() ? `${prev.trim()}. ${reply}` : reply));
    inputRef.current?.focus();
  };

  const QuestIcon = questDraft ? getSideQuestIcon(questDraft.icon) : Trophy;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

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
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
          />

          <motion.div
            initial={
              reduceMotion ? { opacity: 0 } : isDesktop ? { opacity: 0, scale: 0.96, y: 8 } : { y: '100%' }
            }
            animate={
              reduceMotion ? { opacity: 1 } : isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }
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
                ? { duration: 0.25, ease: [0.22, 1, 0.36, 1] }
                : SHEET_ENTER_SPRING
            }
            drag={!isDesktop && !reduceMotion ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (shouldDismissSheet(info.offset.y, info.velocity.y)) {
                onClose();
              }
            }}
            className="relative z-10 w-full max-w-xl h-[90dvh] sm:h-[84dvh] max-h-[760px] rounded-t-3xl sm:rounded-3xl border flex flex-col overflow-hidden shadow-2xl"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {!isDesktop && (
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
              >
                <span
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border-control)' }}
                />
              </div>
            )}

            {/* Header */}
            <header
              className="flex items-center justify-between gap-3 px-5 py-3.5 border-b shrink-0"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2
                      id="ai-side-quest-title"
                      className="text-base font-bold leading-tight truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Diseñar Misión Secundaria
                    </h2>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 border"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      <Sparkles className="w-3 h-3" />
                      IA
                    </span>
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    Misión complementaria a tu reto · Sin guardar hasta confirmar
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar diseñador de misión"
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--surface-inset)',
                  color: 'var(--text-secondary)',
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Chat Stream + Inline Visual Quest Draft */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-3.5">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const showChips =
                  !isUser &&
                  msg.id === lastAssistantId &&
                  msg.suggestedQuickReplies &&
                  msg.suggestedQuickReplies.length > 0 &&
                  !isProcessing;

                return (
                  <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed border ${
                        isUser ? 'rounded-br-md' : 'rounded-bl-md'
                      }`}
                      style={
                        isUser
                          ? {
                              backgroundColor: 'var(--accent-fill)',
                              borderColor: 'var(--accent-fill)',
                              color: 'var(--on-accent)',
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
                          <Sparkles className="w-3 h-3" style={{ color: 'var(--accent-text)' }} />
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                            Asistente IA
                          </span>
                        </div>
                      )}

                      <p className="whitespace-pre-line">{msg.text}</p>

                      {isUser && msg.viaVoice && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] opacity-80">
                          <Mic className="w-3 h-3" />
                          Audio transcrito
                        </span>
                      )}

                      {!isUser && msg.openQuestions && msg.openQuestions.length > 0 && (
                        <ol
                          className="mt-2.5 pt-2.5 border-t space-y-1.5 text-xs"
                          style={{ borderColor: 'var(--divider)', color: 'var(--text-secondary)' }}
                        >
                          {msg.openQuestions.map((question, qIdx) => (
                            <li key={qIdx} className="flex items-start gap-2">
                              <span
                                className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums"
                                style={{
                                  backgroundColor: 'var(--surface-raised)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                {qIdx + 1}
                              </span>
                              <span>{question}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>

                    {showChips && (
                      <div className="mt-2 flex flex-wrap gap-1.5 max-w-[92%]">
                        {msg.suggestedQuickReplies!.map((reply, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleQuickReply(reply)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer active:scale-95"
                            style={{
                              backgroundColor: 'var(--surface-card)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex items-start">
                  <div
                    className="rounded-2xl rounded-bl-md px-3.5 py-2.5 border flex items-center gap-2"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-text)' }} />
                    <AIThinkingStatus
                      states={questDraft ? REFINEMENT_THINKING_STATES : DISCOVERY_THINKING_STATES}
                    />
                  </div>
                </div>
              )}

              {apiError && (
                <div
                  role="alert"
                  className="rounded-2xl p-3 border text-xs"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--status-danger) 10%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--status-danger) 35%, transparent)',
                    color: 'var(--status-danger)',
                  }}
                >
                  {apiError}
                </div>
              )}

              {/* Integrated Interactive Side Quest Preview Card */}
              {questDraft && (
                <section
                  aria-label="Vista previa de la misión secundaria"
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="p-4 border-b space-y-2"
                    style={{ borderColor: 'var(--divider)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: 'var(--surface-card)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--accent-text)',
                          }}
                        >
                          <QuestIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
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
                            <span className="pv2-chip text-[11px]" style={{ color: 'var(--status-warning)' }}>
                              Vista previa · Sin guardar
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {questDraft.description && (
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {questDraft.description}
                      </p>
                    )}
                  </div>

                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Tareas de la misión ({questDraft.tasks.length})
                      </p>
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Marcá las que quieras modificar
                      </span>
                    </div>

                    <ul className="space-y-2">
                      {questDraft.tasks.map((task, idx) => {
                        const taskId = task.id || `sq-task-${idx}`;
                        const isChecked = selectedTaskSet.has(taskId);
                        const TaskIcon = getSideQuestIcon(task.icon);

                        return (
                          <li key={taskId}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isChecked}
                              onClick={() => toggleTaskSelection(taskId)}
                              className="w-full text-left flex items-start gap-2.5 p-3 rounded-xl border transition-colors cursor-pointer"
                              style={{
                                touchAction: 'manipulation',
                                backgroundColor: isChecked
                                  ? 'color-mix(in srgb, var(--accent-fill) 10%, var(--surface-card))'
                                  : 'var(--surface-card)',
                                borderColor: isChecked
                                  ? 'var(--accent-fill)'
                                  : 'var(--border-subtle)',
                              }}
                            >
                              <span
                                className="t-check mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
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
                                  className="w-3 h-3 fill-none stroke-current"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M1 5.52L3.92 9.17L9.17 1" />
                                </svg>
                              </span>

                              <span
                                className="mt-0.5 w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums"
                                style={{
                                  backgroundColor: 'var(--surface-inset)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {idx + 1}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <TaskIcon
                                    className="w-3.5 h-3.5 shrink-0"
                                    size={14}
                                  />
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
                                        backgroundColor: 'color-mix(in srgb, var(--status-success) 16%, transparent)',
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
                                        backgroundColor: 'color-mix(in srgb, var(--status-info) 16%, transparent)',
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
                                  className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <span>{FREQUENCY_LABELS[task.frequency]}</span>
                                  {task.targetValue ? (
                                    <span className="tabular-nums font-medium">
                                      Meta: {task.targetValue.toLocaleString('es-AR')} {task.targetUnit}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
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
                  <span>{recError || 'Micrófono bloqueado. Podés escribir acá abajo o refrescar.'}</span>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refrescar
                  </button>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Sticky Composer + Actions */}
            <footer
              className="shrink-0 border-t px-4 sm:px-5 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))] space-y-2.5"
              style={{
                backgroundColor: 'var(--surface-card)',
                borderColor: 'var(--divider)',
              }}
            >
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
                    {selectedTaskIds.length === 1 ? 'tarea marcada' : 'tareas marcadas'} para cambiar
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

              {isRecording ? (
                <div
                  className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-2xl border"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--accent-fill)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 transition-transform"
                      style={{
                        backgroundColor: 'var(--accent-fill)',
                        transform: `scale(${1 + audioLevel * 0.6})`,
                      }}
                    />
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      Escuchando... tocá detener para enviar
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleMicToggle}
                    aria-label="Detener y enviar audio"
                    className="min-h-[38px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                    style={{
                      backgroundColor: 'var(--accent-fill)',
                      color: 'var(--on-accent)',
                    }}
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Enviar voz
                  </button>
                </div>
              ) : (
                <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={
                      selectedTaskIds.length > 0
                        ? 'Decime qué editar, eliminar, agregar o reordenar...'
                        : questDraft
                        ? 'Pedí cambios en tareas, duración o dificultad...'
                        : 'Describí la misión secundaria que querés armar...'
                    }
                    disabled={isProcessing || isSaving}
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  />

                  <button
                    type="button"
                    onClick={handleMicToggle}
                    disabled={micBlocked || isProcessing || isSaving}
                    aria-label="Grabar mensaje de voz"
                    className="h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform active:scale-95 disabled:opacity-40 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={!textInput.trim() || isProcessing || isSaving}
                    aria-label="Enviar mensaje"
                    className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 disabled:opacity-40 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent-fill)',
                      color: 'var(--on-accent)',
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Action bar */}
              {questDraft ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {onEditManually && (
                    <button
                      type="button"
                      disabled={isProcessing || isSaving}
                      onClick={() => onEditManually(questDraft)}
                      className="min-h-[44px] px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      Editar manualmente
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isProcessing || isSaving}
                    onClick={() => onApplyQuest(questDraft)}
                    className="flex-1 min-h-[44px] px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent-fill)',
                      color: 'var(--on-accent)',
                    }}
                  >
                    <Check className="w-4 h-4" />
                    {isSaving ? 'Guardando...' : saveButtonLabel}
                  </button>
                </div>
              ) : history.length > 0 ? (
                <button
                  type="button"
                  disabled={isProcessing || isSaving}
                  onClick={() => sendToAi({ forceProposal: true })}
                  className="w-full min-h-[42px] px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--border-control)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
                  Armar misión con lo hablado hasta ahora
                </button>
              ) : null}
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

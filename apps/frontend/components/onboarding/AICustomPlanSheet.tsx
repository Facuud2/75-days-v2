'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Trash2,
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
  type AiCustomTask,
  type AiSideQuestDraft,
  type AiSideQuestSuggestion,
  type AiUserContext,
} from '@/lib/api/ai';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';
import { formatTaskBadge, getCustomTaskIcon, type CustomTask } from './CustomTaskEditorSheet';
import AISideQuestSheet, { getSideQuestIcon } from './AISideQuestSheet';
import AIThinkingStatus from './AIThinkingStatus';

type DraftCustomTask = CustomTask & {
  changeType?: 'kept' | 'modified' | 'added';
};

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  viaVoice?: boolean;
  openQuestions?: string[];
  suggestedQuickReplies?: string[];
}

export type AICustomPlanSheetProps = {
  isOpen: boolean;
  initialTasks?: CustomTask[];
  userContext?: AiUserContext;
  saveButtonLabel?: string;
  isSaving?: boolean;
  onApplyPlan: (tasks: CustomTask[], createdSideQuests?: AiSideQuestDraft[]) => void | Promise<void>;
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
    cadence: t.cadence || 'daily',
    measurementType: t.measurementType || 'boolean',
    targetValue: t.targetValue ?? 1,
    targetUnit: t.targetUnit || '',
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
      cadence: t.cadence || 'daily',
      measurementType: t.measurementType || 'boolean',
      targetValue: t.targetValue ?? 1,
      targetUnit: t.targetUnit || '',
    }));
}

function stripChangeTypes(tasks: DraftCustomTask[]): CustomTask[] {
  return tasks.map(({ id, title, description, icon, cadence, measurementType, targetValue, targetUnit }) => ({
    id,
    title,
    description,
    icon,
    cadence: cadence || 'daily',
    measurementType: measurementType || 'boolean',
    targetValue: targetValue ?? 1,
    targetUnit: targetUnit || '',
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
  saveButtonLabel = 'Guardar todo y comenzar plan',
  isSaving = false,
  onApplyPlan,
  onEditManually,
  onClose,
}: AICustomPlanSheetProps) {
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
  const [generatedTasks, setGeneratedTasks] = useState<DraftCustomTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sideQuestSuggestion, setSideQuestSuggestion] = useState<AiSideQuestSuggestion | null>(null);
  const [dismissedSideQuestOffer, setDismissedSideQuestOffer] = useState(false);
  const [sessionSideQuests, setSessionSideQuests] = useState<AiSideQuestDraft[]>([]);
  const [isSideQuestSheetOpen, setIsSideQuestSheetOpen] = useState(false);
  const [sideQuestInitialPrompt, setSideQuestInitialPrompt] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setApiError(null);
    setHistory([]);
    setUnderstoodFacts([]);
    setSelectedTaskIds([]);
    setSideQuestSuggestion(null);
    setDismissedSideQuestOffer(false);
    setSessionSideQuests([]);
    setIsSideQuestSheetOpen(false);
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
        ? 'Ya cargué tus metas actuales acá abajo. Marcá las tareas que quieras ajustar y contame en un solo mensaje qué querés editar, eliminar, sumar o cambiar de orden.'
        : hasContext
        ? 'Contame tu idea para el reto de 75 días (por texto o voz). Ya tengo en cuenta tus datos y misiones secundarias para no preguntarte lo obvio: si queda algo abierto, te agrupo todas las dudas en un solo mensaje.'
        : 'Contame tu idea para tu plan de 75 días, con mucho o poco detalle (por texto o voz). Voy a evaluar lo que me digas y te voy a agrupar en un solo mensaje las dudas que queden abiertas antes de sugerirte las tareas.';

    setMessages([
      {
        id: `plan-welcome-${Date.now()}`,
        role: 'assistant',
        text: welcomeMessage,
      },
    ]);
  }, [isOpen, initialTasks, userContext, resetStatus]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSideQuestSheetOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isSideQuestSheetOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    chatEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [messages, generatedTasks, sessionSideQuests, recStatus, isOpen, reduceMotion]);

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

    const optimisticMsgId = `plan-user-${Date.now()}`;
    const isVoice = Boolean(opts.audioBase64);
    const optimisticText = opts.forceProposal
      ? 'Armá la propuesta de tareas con lo que hablamos.'
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

      if (res.tasks && res.tasks.length > 0) {
        setGeneratedTasks(toDraftCustomTasks(res.tasks));
        setSelectedTaskIds([]);
      }

      if (res.status === 'ready' && res.sideQuestSuggestion) {
        setSideQuestSuggestion(res.sideQuestSuggestion);
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsgId));
      setApiError(
        err?.message || 'No pudimos comunicarnos con la IA. Intentá de nuevo.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleMicToggle = async () => {
    if (isProcessing || isSaving) return;
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
    if (!trimmed || isProcessing || isSaving) return;
    setTextInput('');
    await sendToAi({ text: trimmed });
  };

  const handleQuickReply = (reply: string) => {
    setTextInput((prev) => (prev.trim() ? `${prev.trim()}. ${reply}` : reply));
    inputRef.current?.focus();
  };

  const handleOpenSideQuestDesigner = (ideaPrompt?: string) => {
    setSideQuestInitialPrompt(ideaPrompt ?? '');
    setIsSideQuestSheetOpen(true);
  };

  const handleAddSessionSideQuest = (quest: AiSideQuestDraft) => {
    setSessionSideQuests((prev) => [...prev, quest]);
    setIsSideQuestSheetOpen(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `plan-sq-added-${Date.now()}`,
        role: 'assistant',
        text: `Sumé la misión secundaria "${quest.title}" (${quest.durationDays} días) a tu borrador visual. Se guardará junto con tu plan cuando pulses "${saveButtonLabel}".`,
      },
    ]);
  };

  const hasReadyTasks = generatedTasks.length > 0;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-plan-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.button
              type="button"
              aria-label="Cerrar asistente de IA"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
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
              className="relative z-10 w-full max-w-xl h-[92dvh] sm:h-[86dvh] max-h-[800px] rounded-t-3xl sm:rounded-3xl border flex flex-col overflow-hidden shadow-2xl"
              style={{
                backgroundColor: 'var(--surface-card)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {/* Drag handle mobile */}
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
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2
                        id="ai-plan-sheet-title"
                        className="text-base font-bold leading-tight truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        Diseñar plan con IA
                      </h2>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 border"
                        style={{
                          backgroundColor: 'var(--surface-inset)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        Asistente IA
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      Charlá, revisá tus tareas y guardá recién cuando esté perfecto
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              {/* Context strip when onboarding profile / quests are known */}
              {contextChips.length > 0 && (
                <div
                  className="px-5 py-2 border-b flex items-center gap-1.5 overflow-x-auto shrink-0"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--divider)',
                  }}
                >
                  <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>
                    Contexto activo:
                  </span>
                  {contextChips.map((chip, idx) => (
                    <span key={idx} className="pv2-chip text-[11px] shrink-0">
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              {/* Unified Chat Stream + Integrated Interactive Task Draft */}
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
                        states={hasReadyTasks ? PROPOSAL_THINKING_STATES : DISCOVERY_THINKING_STATES}
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

                {/* Integrated Interactive Visual Plan Card (Purely in memory, no DB write yet) */}
                {hasReadyTasks && (
                  <section
                    aria-label="Propuesta visual de tareas del plan"
                    className="rounded-2xl border overflow-hidden"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div
                      className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2"
                      style={{ borderColor: 'var(--divider)' }}
                    >
                      <div>
                        <h3 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          Tu plan propuesto ({generatedTasks.length} metas)
                        </h3>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Marcá las que quieras modificar y pedime editar, eliminar, agregar o reordenar
                        </p>
                      </div>
                      <span
                        className="pv2-chip text-[11px]"
                        style={{ color: 'var(--status-warning)' }}
                      >
                        Sin guardar
                      </span>
                    </div>

                    <ul className="p-3 space-y-2">
                      {generatedTasks.map((task, idx) => {
                        const Icon = getCustomTaskIcon(task.icon);
                        const isChecked = selectedTaskSet.has(task.id);

                        return (
                          <li key={task.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isChecked}
                              onClick={() => toggleTaskSelection(task.id)}
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

                              <div
                                className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: 'var(--surface-inset)',
                                  borderColor: 'var(--border-subtle)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <Icon className="w-4 h-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className="text-sm font-bold leading-snug"
                                    style={{ color: 'var(--text-primary)' }}
                                  >
                                    {task.title}
                                  </span>
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                    style={{
                                      backgroundColor: 'var(--surface-card)',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    {formatTaskBadge(task)}
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
                                  {isChecked && (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor: 'color-mix(in srgb, var(--accent-fill) 16%, transparent)',
                                        color: 'var(--accent-text)',
                                      }}
                                    >
                                      A cambiar
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
                  </section>
                )}

                {/* Pending Side Quests designed in this session */}
                {sessionSideQuests.length > 0 && (
                  <section
                    aria-label="Misiones secundarias listas para guardar"
                    className="rounded-2xl border p-3.5 space-y-2.5"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
                        <h3 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          Misiones secundarias a crear ({sessionSideQuests.length})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenSideQuestDesigner('')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                        style={{ color: 'var(--accent-text)' }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Crear otra
                      </button>
                    </div>
                    <ul className="space-y-1.5">
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
                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: 'var(--surface-inset)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <SQIcon className="w-3.5 h-3.5" />
                              </span>
                              <div className="min-w-0">
                                <p
                                  className="text-xs font-bold truncate"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  {quest.title}
                                </p>
                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                  {quest.durationDays} días · {quest.tasks.length} tareas · Sin guardar
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSessionSideQuests((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label={`Quitar misión ${quest.title}`}
                              className="p-1.5 rounded-lg cursor-pointer"
                              style={{ color: 'var(--status-danger)' }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* Complementary Side Quest Offer from AI */}
                {hasReadyTasks && !dismissedSideQuestOffer && sessionSideQuests.length === 0 && (
                  <section
                    aria-label="Sugerencia de misión secundaria complementaria"
                    className="rounded-2xl border p-4 space-y-3"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: 'var(--surface-card)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          {sideQuestSuggestion
                            ? `¿Sumamos una misión secundaria: "${sideQuestSuggestion.title}"?`
                            : '¿Querés diseñar una misión secundaria complementaria?'}
                        </p>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {sideQuestSuggestion
                            ? sideQuestSuggestion.reason
                            : 'Podés armar un mini-desafío paralelo con IA que potencie tu plan principal, o dejarlo para más tarde.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenSideQuestDesigner(sideQuestSuggestion?.ideaPrompt)
                        }
                        className="min-h-[38px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                        style={{
                          backgroundColor: 'var(--accent-fill)',
                          color: 'var(--on-accent)',
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Crear misión con IA
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedSideQuestOffer(true)}
                        className="min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border cursor-pointer transition-transform active:scale-95"
                        style={{
                          backgroundColor: 'var(--surface-card)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Dejar para más tarde
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
                      {recError || 'Micrófono bloqueado. Podés escribir acá abajo o refrescar la página.'}
                    </span>
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

              {/* Sticky Composer + Save/Finalize Footer */}
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
                          : hasReadyTasks
                          ? 'Pedí cambios, agregá metas o cambiá el orden...'
                          : 'Describí tu plan o respondé las preguntas acá...'
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

                {/* Action bar — always available to finalize after any turn */}
                {hasReadyTasks ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessing || isSaving}
                      onClick={() => onEditManually(stripChangeTypes(generatedTasks))}
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

                    <button
                      type="button"
                      disabled={isProcessing || isSaving}
                      onClick={() =>
                        onApplyPlan(stripChangeTypes(generatedTasks), sessionSideQuests)
                      }
                      className="flex-1 min-h-[44px] px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--accent-fill)',
                        color: 'var(--on-accent)',
                      }}
                    >
                      <Check className="w-4 h-4" />
                      {isSaving ? 'Guardando plan...' : saveButtonLabel}
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
                    Finalizar charla y armar propuesta ahora
                  </button>
                ) : null}
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Nested AI Side Quest Designer (purely visual until parent saves) */}
      <AISideQuestSheet
        isOpen={isSideQuestSheetOpen}
        initialIdeaPrompt={sideQuestInitialPrompt}
        userContext={enrichedContextForSideQuest}
        saveButtonLabel="Sumar misión al borrador"
        onApplyQuest={handleAddSessionSideQuest}
        onClose={() => setIsSideQuestSheetOpen(false)}
      />
    </>
  );
}

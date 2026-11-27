'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Check,
  Clock,
  Coffee,
  Dumbbell,
  Footprints,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  aiService,
  blobToBase64,
  type AiClarificationQuestion,
  type AiConversationTurn,
  type AiWorkoutPlanDraft,
  type QuickReplySelectionMode,
} from '@/lib/api/ai';
import {
  healthService,
  type TrainingPlanPayload,
  type TrainingPlanRecord,
} from '@/lib/api/health';
import { formatMuscleLabel } from '@/lib/constants/fitness';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import {
  AIConversationStreamItem,
  AIStudioTabs,
  isAbortError,
  type AIStudioView,
} from '@/components/onboarding/AIConversationalStudio';
import AIThinkingStatus from '@/components/onboarding/AIThinkingStatus';
import AutoGrowComposer from '@/components/onboarding/AutoGrowComposer';
import QuickReplyOptionsCard, {
  isConfirmationQuickReply,
} from '@/components/onboarding/QuickReplyOptionsCard';

const DAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const DAY_FULL = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

const THINKING_STATES = [
  'Analizando tu objetivo...',
  'Emparejando ejercicios del catálogo...',
  'Organizando días y turnos...',
  'Alineando con tu reto activo...',
] as const;

const STARTER_PROMPTS = [
  {
    label: 'Semanal 4 días en gym',
    text: 'Armame un plan semanal de 4 días en gimnasio (empuje, tracción, piernas y tren superior)',
  },
  {
    label: 'Diaria en casa 45 min',
    text: 'Quiero una rutina diaria en casa de 45 minutos sin máquinas para hacer todos los días',
  },
  {
    label: 'Caminata + fuerza',
    text: 'Lunes y miércoles caminata por la mañana y fuerza de brazos/pecho a la tarde; martes y jueves piernas y abdominales',
  },
  {
    label: 'Solo grupos musculares',
    text: 'Quiero entrenar brazos, piernas, pecho y abdominales en ese orden',
  },
];

interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  viaVoice?: boolean;
  openQuestions?: string[];
  clarificationQuestions?: AiClarificationQuestion[];
  suggestedQuickReplies?: string[];
  quickReplySelectionMode?: QuickReplySelectionMode;
}

interface AiRoutinePlannerSheetProps {
  isOpen: boolean;
  initialPrompt?: string;
  editingPlan?: TrainingPlanRecord | null;
  onClose: () => void;
  onPlanSaved: (plan: TrainingPlanRecord) => void;
  onEditDraftManually: (draft: TrainingPlanPayload, existingPlanId?: string) => void;
}

function planRecordToDraft(plan: TrainingPlanRecord): AiWorkoutPlanDraft {
  return {
    name: plan.name,
    goalSummary: plan.goalSummary ?? '',
    scheduleType: plan.scheduleType,
    environment: plan.environment,
    slots: plan.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      timeOfDay: s.timeOfDay,
      order: s.order,
      slotType: s.slotType,
      title: s.title,
      focusMuscles: s.focusMuscles ?? [],
      environment: s.environment ?? null,
      sport: s.sport,
      targetDurationMin: s.targetDurationMin ?? null,
      targetSteps: s.targetSteps ?? null,
      notes: s.notes ?? '',
      exercises: (s.exercises ?? []).map((ex) => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        primaryMuscle: ex.primaryMuscle ?? null,
        equipment: ex.equipment ?? null,
        targetSets: ex.targetSets ?? 3,
        targetReps: ex.targetReps ?? '8-12',
        defaultRestSec: ex.defaultRestSec ?? 90,
      })),
    })),
  };
}

function draftToPayload(draft: AiWorkoutPlanDraft): TrainingPlanPayload {
  return {
    name: draft.name,
    goalSummary: draft.goalSummary || null,
    scheduleType: draft.scheduleType,
    environment: draft.environment,
    isActive: true,
    slots: draft.slots.map((slot, idx) => ({
      dayOfWeek: draft.scheduleType === 'weekly' ? (slot.dayOfWeek ?? 0) : null,
      timeOfDay: slot.timeOfDay,
      order: Number.isFinite(slot.order) ? slot.order : idx,
      slotType: slot.slotType,
      title: slot.title,
      focusMuscles: slot.focusMuscles ?? [],
      environment: slot.environment ?? null,
      sport: slot.sport,
      targetDurationMin: slot.targetDurationMin ?? null,
      targetSteps: slot.targetSteps ?? null,
      notes: slot.notes || null,
      exercises: slot.exercises ?? [],
    })),
  };
}

export default function AiRoutinePlannerSheet(props: AiRoutinePlannerSheetProps) {
  if (!props.isOpen) return null;
  return (
    <AiRoutinePlannerContent
      key={`${props.editingPlan?.id ?? 'new'}-${props.initialPrompt ?? ''}`}
      {...props}
    />
  );
}

function AiRoutinePlannerContent({
  initialPrompt,
  editingPlan,
  onClose,
  onPlanSaved,
  onEditDraftManually,
}: AiRoutinePlannerSheetProps) {
  const [activeTab, setActiveTab] = useState<AIStudioView>('chat');
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<AiWorkoutPlanDraft | null>(() =>
    editingPlan ? planRecordToDraft(editingPlan) : null
  );
  const [hasUnreadDraft, setHasUnreadDraft] = useState(false);
  const [understoodFacts, setUnderstoodFacts] = useState<string[]>([]);
  const [selectedPreviewDay, setSelectedPreviewDay] = useState<number>(0);

  const [messages, setMessages] = useState<ChatItem[]>(() =>
    editingPlan
      ? [
          {
            id: 'welcome-edit',
            role: 'assistant',
            text: `Tengo cargado tu plan "${editingPlan.name}". Decime qué días, ejercicios o horarios querés cambiar y lo ajustamos al instante.`,
            suggestedQuickReplies: [
              'Agregar 1 día más de fuerza',
              'Adaptarlo para hacer en casa',
              'Sumar caminata diaria',
            ],
            quickReplySelectionMode: 'single',
          },
        ]
      : [
          {
            id: 'welcome-new',
            role: 'assistant',
            text: 'Contame cómo querés entrenar: si preferís rutina diaria o semanal, en casa o gimnasio, y si tenés horarios o grupos musculares preferidos. Podés escribir o hablar por micrófono.',
          },
        ]
  );

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoSentRef = useRef(false);

  const voice = useVoiceRecorder();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sendTurn = useCallback(
    async (opts: {
      textInput?: string;
      audioBase64?: string;
      mimeType?: string;
      viaVoice?: boolean;
      forceProposal?: boolean;
    }) => {
      if (isSending) return;
      const trimmedText = opts.textInput?.trim();
      if (!trimmedText && !opts.audioBase64 && !opts.forceProposal) return;

      const userTurnId = `u-${Date.now()}`;
      if (trimmedText) {
        setMessages((prev) => [
          ...prev,
          { id: userTurnId, role: 'user', text: trimmedText, viaVoice: opts.viaVoice },
        ]);
      } else if (opts.viaVoice) {
        setMessages((prev) => [
          ...prev,
          { id: userTurnId, role: 'user', text: 'Audio enviado...', viaVoice: true },
        ]);
      }

      setInputValue('');
      setIsSending(true);

      const history: AiConversationTurn[] = messages
        .filter((m) => m.id !== 'welcome-new' && m.id !== 'welcome-edit')
        .map((m) => ({ role: m.role, text: m.text }));

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await aiService.planWorkout(
          {
            textInput: trimmedText,
            audioBase64: opts.audioBase64,
            mimeType: opts.mimeType,
            history,
            currentDraft: draft,
            understoodFacts,
            forceProposal: opts.forceProposal,
          },
          controller.signal
        );

        if (opts.viaVoice && res.userTranscript) {
          setMessages((prev) =>
            prev.map((m) => (m.id === userTurnId ? { ...m, text: res.userTranscript } : m))
          );
        }

        if (res.understoodFacts?.length) {
          setUnderstoodFacts(res.understoodFacts);
        }

        if (res.plan) {
          setDraft(res.plan);
          if (res.plan.scheduleType === 'weekly') {
            const firstTrainingDay = res.plan.slots.find(
              (s) => s.dayOfWeek !== null && s.slotType !== 'rest'
            )?.dayOfWeek;
            if (typeof firstTrainingDay === 'number') {
              setSelectedPreviewDay(firstTrainingDay);
            }
          }
          setHasUnreadDraft(true);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: res.assistantMessage,
            openQuestions: res.openQuestions,
            clarificationQuestions: res.clarificationQuestions,
            suggestedQuickReplies: res.suggestedQuickReplies,
            quickReplySelectionMode: res.quickReplySelectionMode,
          },
        ]);
      } catch (err) {
        if (isAbortError(err)) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'No pudimos conectar con el entrenador IA. Intentá de nuevo.';
        toast.error(msg);
      } finally {
        setIsSending(false);
        voice.setProcessing(false);
      }
    },
    [draft, isSending, messages, understoodFacts, voice]
  );

  // Auto-send initialPrompt if opened from a quick chip on TodayPlanHeroCard
  useEffect(() => {
    if (initialPrompt && !autoSentRef.current) {
      autoSentRef.current = true;
      void sendTurn({ textInput: initialPrompt });
    }
  }, [initialPrompt, sendTurn]);

  const handleSavePlan = useCallback(async () => {
    if (!draft || isSaving) return;
    setIsSaving(true);
    try {
      const payload = draftToPayload(draft);
      const saved = editingPlan
        ? await healthService.updateTrainingPlan(editingPlan.id, payload)
        : await healthService.createTrainingPlan(payload);
      toast.success(editingPlan ? 'Plan actualizado y activo' : 'Plan de entrenamiento activado');
      onPlanSaved(saved);
      onClose();
    } catch {
      toast.error('No se pudo guardar el plan de entrenamiento.');
    } finally {
      setIsSaving(false);
    }
  }, [draft, editingPlan, isSaving, onClose, onPlanSaved]);

  const handleQuickReply = useCallback(
    (selectedText: string) => {
      if (draft && isConfirmationQuickReply(selectedText)) {
        void handleSavePlan();
        return;
      }
      void sendTurn({ textInput: selectedText });
    },
    [draft, handleSavePlan, sendTurn]
  );

  const handleStopAndTranscribe = useCallback(async () => {
    const result = await voice.stopRecording();
    if (result.kind !== 'success') return;
    voice.setTranscribing(true);
    try {
      const audioBase64 = await blobToBase64(result.blob);
      const { transcript } = await aiService.transcribeAudio({
        audioBase64,
        mimeType: result.mimeType,
      });
      if (transcript?.trim()) {
        setInputValue((prev) => (prev.trim() ? `${prev.trim()} ${transcript.trim()}` : transcript.trim()));
      }
    } catch {
      toast.error('No se pudo transcribir el audio.');
    } finally {
      voice.setTranscribing(false);
    }
  }, [voice]);

  const handleSendVoiceDirect = useCallback(async () => {
    const result = await voice.stopRecording();
    if (result.kind !== 'success') return;
    voice.setProcessing(true);
    try {
      const audioBase64 = await blobToBase64(result.blob);
      await sendTurn({ audioBase64, mimeType: result.mimeType, viaVoice: true });
    } catch {
      toast.error('No se pudo enviar el audio.');
      voice.setProcessing(false);
    }
  }, [sendTurn, voice]);

  const previewSlots = useMemo(() => {
    if (!draft) return [];
    const sorted = [...draft.slots].sort((a, b) => a.order - b.order);
    if (draft.scheduleType === 'weekly') {
      return sorted.filter((s) => s.dayOfWeek === selectedPreviewDay);
    }
    return sorted;
  }, [draft, selectedPreviewDay]);

  const latestAssistantMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  const showStarterChips = messages.length <= 1 && !editingPlan && !isSending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Planificador de rutinas con IA"
    >
      <div className="flex h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xl sm:h-[84dvh] sm:rounded-[28px]">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-[var(--divider)] px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-fill)]/15 text-[var(--accent-text)]">
              <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-bold text-[var(--text-primary)]">
                Entrenador IA
              </h2>
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                {editingPlan ? 'Ajustando tu plan activo' : 'Creá tu rutina diaria o semanal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const manualDraft = draft
                  ? draftToPayload(draft)
                  : {
                      name: '',
                      goalSummary: null,
                      scheduleType: 'weekly' as const,
                      environment: 'gym' as const,
                      isActive: true,
                      slots: [],
                    };
                onEditDraftManually(manualDraft, editingPlan?.id);
              }}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
              A mano
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar planificador IA"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Tabs: Chat vs Draft */}
        {draft ? (
          <div className="border-b border-[var(--divider)] px-4 py-2">
            <AIStudioTabs
              ariaLabel="Vistas del planificador de rutinas"
              activeTab={activeTab}
              draftIcon={CalendarDays}
              draftLabel={`Borrador (${draft.slots.filter((s) => s.slotType !== 'rest').length})`}
              hasUnreadDraftChanges={hasUnreadDraft}
              onChatSelect={() => setActiveTab('chat')}
              onDraftSelect={() => {
                setActiveTab('draft');
                setHasUnreadDraft(false);
              }}
            />
          </div>
        ) : null}

        {/* BODY */}
        {activeTab === 'chat' ? (
          <>
            <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
              {messages.map((msg, idx) => {
                const isLatestAssistant =
                  msg.role === 'assistant' && latestAssistantMsg?.id === msg.id;
                const hasQuickReplies =
                  isLatestAssistant &&
                  !isSending &&
                  ((msg.clarificationQuestions && msg.clarificationQuestions.length > 0) ||
                    (msg.suggestedQuickReplies && msg.suggestedQuickReplies.length > 0));

                return (
                  <AIConversationStreamItem
                    key={msg.id}
                    role={msg.role}
                    text={msg.text}
                    viaVoice={msg.viaVoice}
                    openQuestions={
                      msg.clarificationQuestions && msg.clarificationQuestions.length > 0
                        ? []
                        : msg.openQuestions
                    }
                  >
                    {hasQuickReplies ? (
                      <div className="mt-2 w-full">
                        <QuickReplyOptionsCard
                          options={msg.suggestedQuickReplies}
                          mode={msg.quickReplySelectionMode}
                          openQuestions={msg.openQuestions}
                          clarificationQuestions={msg.clarificationQuestions}
                          disabled={isSending}
                          onSendSelected={handleQuickReply}
                        />
                      </div>
                    ) : null}

                    {/* Compact inline draft summary card right under the latest assistant message when a draft is ready */}
                    {isLatestAssistant && draft && idx === messages.length - 1 ? (
                      <div className="mt-2.5 w-full rounded-2xl border border-[var(--accent-fill)]/35 bg-[var(--surface-inset)] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                              Plan listo ·{' '}
                              {draft.scheduleType === 'weekly'
                                ? 'Semanal'
                                : draft.scheduleType === 'daily'
                                  ? 'Diario'
                                  : 'Secuencial'}
                            </p>
                            <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                              {draft.name}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('draft');
                              setHasUnreadDraft(false);
                            }}
                            className="shrink-0 cursor-pointer rounded-xl bg-[var(--surface-card)] px-2.5 py-1.5 text-xs font-bold text-[var(--accent-text)] border border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] active:scale-95"
                          >
                            Ver plan
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </AIConversationStreamItem>
                );
              })}

              {showStarterChips ? (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                    Ideas rápidas para empezar:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STARTER_PROMPTS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => void sendTurn({ textInput: chip.text })}
                        className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-fill)]/50 hover:text-[var(--text-primary)] active:scale-95"
                      >
                        <Wand2 className="h-3 w-3 text-[var(--accent-text)]" aria-hidden="true" />
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {isSending ? (
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3.5 py-2.5 w-fit">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-[var(--accent-text)]" />
                  <AIThinkingStatus states={THINKING_STATES} />
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer + Quick Activate CTA if draft is ready */}
            <div className="border-t border-[var(--divider)] bg-[var(--surface-card)] px-3.5 py-3 space-y-2.5">
              {draft ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleSavePlan()}
                    className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-3 text-xs font-bold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-fill-hover)] active:scale-[0.98] disabled:opacity-60"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Activar este plan
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditDraftManually(draftToPayload(draft), editingPlan?.id)}
                    className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-raised)] active:scale-95"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Ajustar a mano
                  </button>
                </div>
              ) : null}

              <AutoGrowComposer
                value={inputValue}
                onChange={setInputValue}
                onSubmitText={() => void sendTurn({ textInput: inputValue })}
                placeholder="Ej: Lunes y miércoles gym, martes caminata..."
                disabled={isSending}
                voiceStatus={voice.status}
                isSpeaking={voice.isSpeaking}
                elapsedSeconds={voice.elapsedSeconds}
                subscribeAudioMetrics={voice.subscribeAudioMetrics}
                onStartVoice={() => void voice.startRecording()}
                onCancelVoice={voice.cancelRecording}
                onPauseVoice={voice.pauseRecording}
                onResumeVoice={voice.resumeRecording}
                onStopAndTranscribeVoice={() => void handleStopAndTranscribe()}
                onSendVoiceDirect={() => void handleSendVoiceDirect()}
              />
            </div>
          </>
        ) : draft ? (
          <>
            {/* DRAFT PREVIEW TAB */}
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[var(--accent-fill)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-text)]">
                    {draft.scheduleType === 'weekly'
                      ? 'Plan semanal'
                      : draft.scheduleType === 'daily'
                        ? 'Rutina diaria'
                        : 'Secuencia'}
                  </span>
                  <span className="rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                    {draft.environment === 'gym'
                      ? 'Gimnasio'
                      : draft.environment === 'home'
                        ? 'En casa'
                        : draft.environment === 'outdoor'
                          ? 'Aire libre'
                          : 'Mixto'}
                  </span>
                </div>
                <h3 className="mt-1.5 text-base font-bold text-[var(--text-primary)]">
                  {draft.name}
                </h3>
                {draft.goalSummary ? (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{draft.goalSummary}</p>
                ) : null}
              </div>

              {draft.scheduleType === 'weekly' ? (
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_SHORT.map((letter, idx) => {
                    const isSelected = selectedPreviewDay === idx;
                    const hasWork = draft.slots.some(
                      (s) => s.dayOfWeek === idx && s.slotType !== 'rest'
                    );
                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => setSelectedPreviewDay(idx)}
                        className={`flex min-h-10 cursor-pointer flex-col items-center justify-center rounded-xl border text-xs font-bold transition-colors ${
                          isSelected
                            ? 'border-[var(--accent-fill)] bg-[var(--accent-fill)] text-[var(--on-accent)]'
                            : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span>{letter}</span>
                        <span
                          className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                            hasWork
                              ? isSelected
                                ? 'bg-[var(--on-accent)]'
                                : 'bg-[var(--accent-fill)]'
                              : 'bg-transparent'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="space-y-2.5">
                {draft.scheduleType === 'weekly' ? (
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {DAY_FULL[selectedPreviewDay]}
                  </p>
                ) : null}

                {previewSlots.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)]/50 p-4 text-center text-xs text-[var(--text-muted)]">
                    Día de descanso
                  </div>
                ) : (
                  previewSlots.map((slot, idx) => (
                    <div
                      key={`${slot.title}-${idx}`}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-card)] text-[var(--accent-text)]">
                          {slot.slotType === 'rest' ? (
                            <Coffee className="h-4 w-4 text-[var(--text-muted)]" />
                          ) : slot.slotType === 'cardio' ? (
                            slot.sport === 'walking' || slot.sport === 'running' ? (
                              <Footprints className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Activity className="h-4 w-4 text-emerald-500" />
                            )
                          ) : (
                            <Dumbbell className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="text-sm font-bold text-[var(--text-primary)]">
                              {slot.title}
                            </h4>
                            {slot.timeOfDay !== 'any' ? (
                              <span className="rounded-md bg-[var(--surface-card)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                                {slot.timeOfDay === 'morning'
                                  ? 'Mañana'
                                  : slot.timeOfDay === 'afternoon'
                                    ? 'Tarde'
                                    : 'Noche'}
                              </span>
                            ) : null}
                            {slot.targetDurationMin ? (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
                                <Clock className="h-3 w-3" />
                                {slot.targetDurationMin} min
                              </span>
                            ) : null}
                          </div>

                          {slot.focusMuscles.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {slot.focusMuscles.map((m) => (
                                <span
                                  key={m}
                                  className="rounded-md bg-[var(--surface-card)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
                                >
                                  {formatMuscleLabel(m)}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {slot.exercises.length > 0 ? (
                            <ul className="mt-2 space-y-1 border-t border-[var(--divider)] pt-2">
                              {slot.exercises.map((ex) => (
                                <li
                                  key={ex.exerciseId}
                                  className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]"
                                >
                                  <span className="truncate">· {ex.exerciseName}</span>
                                  <span className="shrink-0 font-semibold text-[var(--text-muted)] tabular-nums">
                                    {ex.targetSets}×{ex.targetReps}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : slot.notes ? (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{slot.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Draft Footer */}
            <div className="flex items-center gap-2 border-t border-[var(--divider)] bg-[var(--surface-card)] px-4 py-3">
              <button
                type="button"
                onClick={() => onEditDraftManually(draftToPayload(draft), editingPlan?.id)}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-raised)] active:scale-95"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Ajustar a mano
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSavePlan()}
                className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill)] px-4 text-sm font-bold text-[var(--on-accent)] hover:bg-[var(--accent-fill-hover)] active:scale-[0.98] disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Activar plan
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

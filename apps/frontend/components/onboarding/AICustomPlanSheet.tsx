'use client';

import React, { useEffect, useState } from 'react';
import {
  Check,
  MessageSquare,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
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
} from '@/lib/api/ai';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';
import { getCustomTaskIcon, type CustomTask } from './CustomTaskEditorSheet';
import VoiceOrb from './VoiceOrb';

type AICustomPlanSheetProps = {
  isOpen: boolean;
  initialTasks?: CustomTask[];
  onApplyPlan: (tasks: CustomTask[]) => void;
  onEditManually: (tasks: CustomTask[]) => void;
  onClose: () => void;
};

function toCustomTasks(aiTasks: AiCustomTask[]): CustomTask[] {
  const stamp = Date.now();
  return aiTasks.map((t, idx) => ({
    id: `ai-task-${stamp}-${idx}`,
    title: t.title,
    description: t.description,
    icon: t.icon,
  }));
}

function toAiTasks(tasks: CustomTask[]): AiCustomTask[] {
  const allowed = new Set([
    'utensils',
    'dumbbell',
    'droplet',
    'book',
    'camera',
    'sun',
    'brain',
    'heart',
  ]);
  return tasks
    .filter((t) => t.title.trim() !== '')
    .map((t) => ({
      title: t.title.trim(),
      description: t.description.trim() || t.title.trim(),
      icon: (allowed.has(t.icon) ? t.icon : 'dumbbell') as AiCustomTask['icon'],
    }));
}

export default function AICustomPlanSheet({
  isOpen,
  initialTasks = [],
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

  const [history, setHistory] = useState<AiConversationTurn[]>([]);
  const [askedQuestionsCount, setAskedQuestionsCount] = useState(0);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<CustomTask[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [textInput, setTextInput] = useState('');

  // Sincronizar tareas iniciales cuando se abre el sheet
  useEffect(() => {
    if (!isOpen) return;
    setApiError(null);
    setAssistantMessage(null);
    setHistory([]);
    setAskedQuestionsCount(0);
    setTextInput('');
    setShowTextFallback(false);
    setGeneratedTasks(initialTasks.filter((t) => t.title.trim() !== ''));
    resetStatus();
  }, [isOpen, initialTasks, resetStatus]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const micBlocked =
    recStatus === 'permission-denied' ||
    recStatus === 'unsupported' ||
    recStatus === 'error';

  const sendToAi = async (opts: {
    audioBase64?: string;
    mimeType?: string;
    text?: string;
  }) => {
    setApiError(null);
    setProcessing(true);
    try {
      const currentAiTasks =
        generatedTasks.length > 0 ? toAiTasks(generatedTasks) : undefined;

      const res = await aiService.generateCustomPlan({
        audioBase64: opts.audioBase64,
        mimeType: opts.mimeType,
        textInput: opts.text,
        history,
        currentTasks: currentAiTasks,
        askedQuestionsCount,
      });

      const userTurnText = opts.text?.trim() || '[Mensaje de voz]';
      setHistory((prev) => [
        ...prev,
        { role: 'user', text: userTurnText },
        { role: 'assistant', text: res.assistantMessage },
      ]);
      setAssistantMessage(res.assistantMessage);

      if (res.status === 'needs_clarification') {
        setAskedQuestionsCount((c) => c + 1);
      } else {
        setGeneratedTasks(toCustomTasks(res.tasks));
      }
    } catch (err: any) {
      setApiError(
        err?.message || 'No pudimos comunicarnos con la IA. Intentá de nuevo.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleOrbToggle = async () => {
    if (recStatus === 'recording') {
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
    if (!trimmed || recStatus === 'processing') return;
    setTextInput('');
    await sendToAi({ text: trimmed });
  };

  const hasReadyTasks = generatedTasks.length > 0;

  return (
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
            transition={{ duration: 0.18, ease: 'easeOut' }}
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
                ? { opacity: 0, scale: 0.97, y: 6 }
                : { y: '100%' }
            }
            transition={
              reduceMotion
                ? REDUCED_MOTION_TRANSITION
                : isDesktop
                ? { duration: 0.22, ease: [0.23, 1, 0.32, 1] }
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
            className="relative z-10 w-full max-w-lg max-h-[90dvh] rounded-t-3xl sm:rounded-3xl border flex flex-col overflow-hidden shadow-2xl"
            style={{
              backgroundColor: 'var(--surface-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {/* Drag handle mobile */}
            {!isDesktop && (
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
              >
                <span
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border-strong)' }}
                />
              </div>
            )}

            {/* Header */}
            <header
              className="flex items-center justify-between px-5 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="ai-plan-sheet-title"
                    className="text-base font-bold leading-tight"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Diseñar plan con IA
                  </h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Contá tu idea por voz y armamos tus metas atómicas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="p-2 rounded-xl transition-colors hover:bg-white/10 cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Orbe de Voz */}
              <VoiceOrb
                isRecording={recStatus === 'recording'}
                isProcessing={recStatus === 'processing'}
                disabled={micBlocked}
                audioLevel={audioLevel}
                onToggle={handleOrbToggle}
              />

              {/* Banner si el micrófono fue denegado o no está disponible */}
              {micBlocked && (
                <div
                  className="rounded-2xl p-3.5 border text-xs space-y-2.5"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {recError || 'No pudimos acceder al micrófono.'}
                  </p>
                  <p>
                    Si cerraste el permiso sin querer, podés refrescar la página para volver a habilitarlo sin perder tu progreso, o escribir tu idea acá abajo.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-transform active:scale-95"
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refrescar página
                  </button>
                </div>
              )}

              {/* Mensaje / Pregunta natural de la IA */}
              {assistantMessage && (
                <div
                  className="rounded-2xl p-3.5 border text-sm leading-relaxed"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {assistantMessage}
                </div>
              )}

              {apiError && (
                <div className="rounded-2xl p-3 border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                  {apiError}
                </div>
              )}

              {/* Input de texto fallback (automático si mic bloqueado o togglable) */}
              {(micBlocked || showTextFallback) ? (
                <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Describí tu plan o qué querés cambiar..."
                    disabled={recStatus === 'processing'}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:border-emerald-400"
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim() || recStatus === 'processing'}
                    aria-label="Enviar mensaje"
                    className="p-2.5 rounded-xl font-semibold transition-transform active:scale-95 disabled:opacity-40 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent-fill)',
                      color: 'var(--on-accent)',
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowTextFallback(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium opacity-75 hover:opacity-100 cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    ¿Preferís escribir?
                  </button>
                </div>
              )}

              {/* Tareas atómicas generadas */}
              {hasReadyTasks && (
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between">
                    <p
                      className="text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Plan generado ({generatedTasks.length} metas)
                    </p>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Podés hablar de nuevo para ajustarlo
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {generatedTasks.map((task) => {
                      const Icon = getCustomTaskIcon(task.icon);
                      return (
                        <li
                          key={task.id}
                          className="flex items-start gap-3 p-3 rounded-2xl border"
                          style={{
                            backgroundColor: 'var(--surface-card)',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-sm font-bold leading-snug"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {task.title}
                            </p>
                            <p
                              className="text-xs mt-0.5 leading-relaxed"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {task.description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer de acciones cuando hay tareas listas */}
            {hasReadyTasks && (
              <footer
                className="px-5 py-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <button
                  type="button"
                  onClick={() => onEditManually(generatedTasks)}
                  className="min-h-[44px] px-4 rounded-2xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition-transform active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Pencil className="w-4 h-4" />
                  Editar manualmente
                </button>

                <button
                  type="button"
                  onClick={() => onApplyPlan(generatedTasks)}
                  className="flex-1 min-h-[44px] px-5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent-fill)',
                    color: 'var(--on-accent)',
                  }}
                >
                  <Check className="w-4 h-4" />
                  Usar este plan
                </button>
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

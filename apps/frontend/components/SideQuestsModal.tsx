'use client';

import React, { useMemo, useState } from 'react';
import {
  Apple,
  Book,
  ChevronLeft,
  Clock,
  Droplet,
  Dumbbell,
  Footprints,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { useQuestStore, SideQuestTemplate, CreateQuestInput } from '@/store/useQuestStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import type { AiSideQuestDraft, AiUserContext } from '@/lib/api/ai';
import AISideQuestSheet from '@/components/onboarding/AISideQuestSheet';

interface SideQuestsModalProps {
  onClose: () => void;
}

const iconMap: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  droplet: Droplet,
  dumbbell: Dumbbell,
  book: Book,
  sun: Sun,
  moon: Moon,
  target: Target,
  apple: Apple,
  footprints: Footprints,
  clock: Clock,
};

export default function SideQuestsModal({ onClose }: SideQuestsModalProps) {
  const { subscribeToQuest, createCustomQuest, quests, availableQuests, isLoading, error } =
    useQuestStore();
  const { user } = useAuthStore();
  const { customGoalsTemplate } = useChallengeStore();

  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isAiSideQuestOpen, setIsAiSideQuestOpen] = useState(false);
  const [isSavingAiQuest, setIsSavingAiQuest] = useState(false);
  const [customQuest, setCustomQuest] = useState<CreateQuestInput>({
    title: '',
    description: '',
    icon: 'target',
    difficulty: 'Medium',
    durationDays: 14,
    tasks: [
      {
        title: '',
        description: '',
        icon: 'target',
        frequency: 'daily',
        targetValue: null,
        targetUnit: '',
      },
    ],
  });

  const aiUserContext = useMemo<AiUserContext>(
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
      mainPlanTasks: (customGoalsTemplate || []).map((g) => ({
        title: g.title,
        description: g.description,
      })),
    }),
    [user?.age, user?.height, user?.weight, user?.targetWeight, quests, customGoalsTemplate]
  );

  const activeQuestTitles = (quests || []).filter((q) => !q.completed).map((q) => q.title);
  const availableToSubscribe = (availableQuests || []).filter(
    (q) => !activeQuestTitles.includes(q.title)
  );

  const handleSubscribe = (quest: SideQuestTemplate) => {
    if (subscribingTo !== null) return;
    setSubscribingTo(quest.title);
    void subscribeToQuest(quest.title, quest.difficulty, quest.durationDays);
    onClose();
  };

  const updateTask = (index: number, patch: Partial<CreateQuestInput['tasks'][number]>) =>
    setCustomQuest((current) => ({
      ...current,
      tasks: current.tasks.map((task, taskIndex) =>
        taskIndex === index ? { ...task, ...patch } : task
      ),
    }));

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    void createCustomQuest(customQuest);
    onClose();
  };

  const toCreateQuestInput = (draft: AiSideQuestDraft): CreateQuestInput => ({
    title: draft.title,
    description: draft.description,
    icon: draft.icon || 'target',
    difficulty: draft.difficulty,
    durationDays: draft.durationDays,
    tasks: draft.tasks.map((t) => ({
      title: t.title,
      description: t.description || null,
      icon: t.icon || 'target',
      frequency: t.frequency,
      targetValue: t.targetValue ?? null,
      targetUnit: t.targetUnit || null,
    })),
  });

  const handleApplyAiQuest = async (draft: AiSideQuestDraft) => {
    setIsSavingAiQuest(true);
    try {
      const ok = await createCustomQuest(toCreateQuestInput(draft));
      if (ok) {
        setIsAiSideQuestOpen(false);
        onClose();
      }
    } finally {
      setIsSavingAiQuest(false);
    }
  };

  const handleEditAiQuestManually = (draft: AiSideQuestDraft) => {
    setCustomQuest(toCreateQuestInput(draft));
    setIsAiSideQuestOpen(false);
    setCreating(true);
  };

  return (
    <>
      {!isAiSideQuestOpen && (
        <div
          className="mobile-sheet-root fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="side-quests-modal-title"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[3px]" onClick={onClose} />

          <div
            className="mobile-sheet-panel relative border rounded-3xl w-full max-w-2xl max-h-[92dvh] sm:max-h-[86dvh] overflow-hidden flex flex-col shadow-2xl"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Header */}
            <div
              className="px-4 py-3.5 sm:px-6 sm:py-4 border-b flex justify-between items-center gap-3 shrink-0"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {creating ? (
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    aria-label="Volver al catálogo de misiones"
                    className="size-9 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                    style={{
                      touchAction: 'manipulation',
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <ChevronLeft size={18} />
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
                    <Trophy size={18} />
                  </div>
                )}

                <div className="min-w-0">
                  <h2
                    id="side-quests-modal-title"
                    className="text-base sm:text-lg font-bold leading-tight truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {creating ? 'Crear misión manual' : 'Misiones Secundarias'}
                  </h2>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {creating
                      ? 'Definí condiciones y frecuencia a medida'
                      : 'Mini-desafíos paralelos para potenciar tu reto'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {creating && (
                  <button
                    type="button"
                    onClick={() => setIsAiSideQuestOpen(true)}
                    className="min-h-[36px] px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                    style={{
                      touchAction: 'manipulation',
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-control)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    <Sparkles size={13} />
                    <span>Con IA</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar misiones secundarias"
                  className="size-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                  style={{
                    touchAction: 'manipulation',
                    backgroundColor: 'var(--surface-inset)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            {creating ? (
              <form onSubmit={handleCreate} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <label
                      className="sm:col-span-2 text-xs font-semibold flex flex-col gap-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Nombre de la misión
                      <input
                        required
                        maxLength={100}
                        value={customQuest.title}
                        onChange={(e) => setCustomQuest({ ...customQuest, title: e.target.value })}
                        placeholder="Ej. 21 días sin azúcar"
                        className="w-full min-h-[44px] rounded-xl border px-3 py-2.5 text-base sm:text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--surface-inset)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </label>

                    <label
                      className="sm:col-span-2 text-xs font-semibold flex flex-col gap-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Descripción
                      <textarea
                        maxLength={2000}
                        value={customQuest.description}
                        onChange={(e) =>
                          setCustomQuest({ ...customQuest, description: e.target.value })
                        }
                        placeholder="Propósito y reglas clave de la misión"
                        rows={2}
                        className="w-full rounded-xl border px-3 py-2.5 text-base sm:text-sm outline-none resize-none"
                        style={{
                          backgroundColor: 'var(--surface-inset)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </label>

                    <label
                      className="text-xs font-semibold flex flex-col gap-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Dificultad
                      <select
                        value={customQuest.difficulty}
                        onChange={(e) =>
                          setCustomQuest({ ...customQuest, difficulty: e.target.value })
                        }
                        className="w-full min-h-[44px] rounded-xl border px-3 py-2.5 text-base sm:text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--surface-inset)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <option value="Easy">Fácil</option>
                        <option value="Medium">Media</option>
                        <option value="Hard">Difícil</option>
                      </select>
                    </label>

                    <label
                      className="text-xs font-semibold flex flex-col gap-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Duración (días)
                      <input
                        required
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={365}
                        value={customQuest.durationDays}
                        onChange={(e) =>
                          setCustomQuest({
                            ...customQuest,
                            durationDays: Number(e.target.value),
                          })
                        }
                        className="w-full min-h-[44px] rounded-xl border px-3 py-2.5 text-base sm:text-sm outline-none tabular-nums"
                        style={{
                          backgroundColor: 'var(--surface-inset)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Tareas ({customQuest.tasks.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomQuest({
                            ...customQuest,
                            tasks: [
                              ...customQuest.tasks,
                              {
                                title: '',
                                description: '',
                                icon: 'target',
                                frequency: 'daily',
                                targetValue: null,
                                targetUnit: '',
                              },
                            ],
                          })
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                        style={{ color: 'var(--accent-text)' }}
                      >
                        <Plus size={14} /> Añadir tarea
                      </button>
                    </div>

                    {customQuest.tasks.map((task, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border p-3.5 flex flex-col gap-2.5"
                        style={{
                          backgroundColor: 'var(--surface-inset)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[11px] font-bold uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Tarea {index + 1}
                          </span>
                          {customQuest.tasks.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setCustomQuest({
                                  ...customQuest,
                                  tasks: customQuest.tasks.filter(
                                    (_, taskIndex) => taskIndex !== index
                                  ),
                                })
                              }
                              aria-label="Eliminar tarea"
                              className="size-8 rounded-lg flex items-center justify-center cursor-pointer"
                              style={{ color: 'var(--status-danger)' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <input
                          required
                          maxLength={200}
                          value={task.title}
                          onChange={(e) => updateTask(index, { title: e.target.value })}
                          placeholder="Qué debés hacer"
                          className="w-full min-h-[42px] rounded-xl border px-3 py-2 text-base sm:text-sm outline-none"
                          style={{
                            backgroundColor: 'var(--surface-card)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-primary)',
                          }}
                        />

                        <input
                          maxLength={1000}
                          value={task.description ?? ''}
                          onChange={(e) => updateTask(index, { description: e.target.value })}
                          placeholder="Detalle o criterio (opcional)"
                          className="w-full min-h-[42px] rounded-xl border px-3 py-2 text-base sm:text-sm outline-none"
                          style={{
                            backgroundColor: 'var(--surface-card)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-primary)',
                          }}
                        />

                        <div className="grid grid-cols-2 gap-2.5">
                          <select
                            value={task.frequency}
                            onChange={(e) =>
                              updateTask(index, {
                                frequency: e.target.value as 'daily' | 'weekly' | 'once',
                              })
                            }
                            className="min-h-[42px] rounded-xl border px-3 py-2 text-base sm:text-sm outline-none"
                            style={{
                              backgroundColor: 'var(--surface-card)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <option value="daily">Cada día</option>
                            <option value="weekly">Cada semana</option>
                            <option value="once">Una vez</option>
                          </select>

                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={task.targetValue ?? ''}
                            onChange={(e) =>
                              updateTask(index, {
                                targetValue: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            placeholder="Meta numérica"
                            className="min-h-[42px] rounded-xl border px-3 py-2 text-base sm:text-sm outline-none tabular-nums"
                            style={{
                              backgroundColor: 'var(--surface-card)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>

                        <input
                          maxLength={40}
                          value={task.targetUnit ?? ''}
                          onChange={(e) => updateTask(index, { targetUnit: e.target.value })}
                          placeholder="Unidad (ej. pasos, páginas, minutos)"
                          className="w-full min-h-[42px] rounded-xl border px-3 py-2 text-base sm:text-sm outline-none"
                          style={{
                            backgroundColor: 'var(--surface-card)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {error && (
                    <p role="alert" className="text-xs font-medium" style={{ color: 'var(--status-danger)' }}>
                      {error}
                    </p>
                  )}
                </div>

                {/* Sticky Thumb-Zone Footer for Manual Form */}
                <div
                  className="shrink-0 border-t px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--divider)',
                  }}
                >
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full min-h-[46px] rounded-xl font-semibold text-sm cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
                    style={{
                      touchAction: 'manipulation',
                      backgroundColor: 'var(--accent-fill)',
                      color: 'var(--on-accent)',
                    }}
                  >
                    {isLoading ? 'Creando misión...' : 'Crear y empezar misión'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-4">
                {/* Compact Custom/AI Creation Banner at Top */}
                <div
                  className="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 shrink-0" style={{ color: 'var(--accent-text)' }} />
                      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        Misión a tu medida
                      </h3>
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      Diseñala por voz o chat con IA (100% complementaria a tu plan) o cargala manual.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsAiSideQuestOpen(true)}
                      className="flex-1 sm:flex-none min-h-[42px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                      style={{
                        touchAction: 'manipulation',
                        backgroundColor: 'var(--accent-fill)',
                        color: 'var(--on-accent)',
                      }}
                    >
                      <Sparkles size={14} />
                      <span>Diseñar con IA</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                      style={{
                        touchAction: 'manipulation',
                        backgroundColor: 'var(--surface-card)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Plus size={14} />
                      <span>Manual</span>
                    </button>
                  </div>
                </div>

                {availableToSubscribe.length === 0 ? (
                  <div className="text-center py-8 flex flex-col items-center gap-2.5">
                    <Trophy className="size-11" style={{ color: 'var(--text-muted)' }} />
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                      ¡Catálogo completo!
                    </h3>
                    <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                      Ya estás suscrito a todas las misiones predefinidas. Podés crear una nueva arriba con IA o manualmente.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableToSubscribe.map((quest) => {
                      const IconComponent =
                        quest.icon && iconMap[quest.icon] ? iconMap[quest.icon] : Trophy;
                      const diffColor =
                        quest.difficulty === 'Easy'
                          ? 'var(--status-success)'
                          : quest.difficulty === 'Medium'
                          ? 'var(--status-warning)'
                          : 'var(--status-danger)';

                      return (
                        <div
                          key={quest.title}
                          className="rounded-2xl border p-4 flex flex-col justify-between gap-3.5"
                          style={{
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div
                                className="size-10 rounded-xl border flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: 'var(--surface-card)',
                                  borderColor: 'var(--border-subtle)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <IconComponent size={20} strokeWidth={1.75} />
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                                  style={{
                                    backgroundColor: `color-mix(in srgb, ${diffColor} 15%, transparent)`,
                                    color: diffColor,
                                  }}
                                >
                                  {quest.difficulty === 'Easy'
                                    ? 'Fácil'
                                    : quest.difficulty === 'Medium'
                                    ? 'Media'
                                    : 'Difícil'}
                                </span>
                                <span className="pv2-chip text-[11px] tabular-nums">
                                  {quest.durationDays} días
                                </span>
                              </div>
                            </div>

                            <h4
                              className="text-sm font-bold leading-snug mb-1"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {quest.title}
                            </h4>
                            <p
                              className="text-xs leading-relaxed"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {quest.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSubscribe(quest)}
                            disabled={subscribingTo !== null}
                            className="w-full min-h-[42px] rounded-xl font-semibold text-xs border cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
                            style={{
                              touchAction: 'manipulation',
                              backgroundColor: 'var(--surface-card)',
                              borderColor: 'var(--border-control)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {subscribingTo === quest.title ? 'Suscribiendo...' : 'Suscribirse'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <AISideQuestSheet
        isOpen={isAiSideQuestOpen}
        userContext={aiUserContext}
        saveButtonLabel="Crear y empezar misión"
        isSaving={isSavingAiQuest}
        onApplyQuest={handleApplyAiQuest}
        onEditManually={handleEditAiQuestManually}
        onClose={() => setIsAiSideQuestOpen(false)}
      />
    </>
  );
}

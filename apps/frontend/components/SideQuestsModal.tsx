import React, { useMemo, useState } from 'react';
import {
  X,
  Trophy,
  Target,
  Droplet,
  Dumbbell,
  Book,
  Sun,
  Moon,
  Apple,
  Footprints,
  Clock,
  Plus,
  Trash2,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { useQuestStore, SideQuestTemplate, CreateQuestInput } from '@/store/useQuestStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import type { AiSideQuestDraft, AiUserContext } from '@/lib/api/ai';
import AISideQuestSheet from '@/components/onboarding/AISideQuestSheet';

interface SideQuestsModalProps {
  onClose: () => void;
}

const iconMap: Record<string, any> = {
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
    durationDays: 7,
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

  // Filter out quests the user is already subscribed to (and not completed)
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
      <div className="mobile-sheet-root fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="side-quests-modal mobile-sheet-panel relative bg-[#1a0b12] border border-rose-950/50 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-6 border-b border-rose-950/50 flex justify-between items-center bg-rose-950/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                <Trophy className="text-rose-500" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Misiones Secundarias</h2>
                <p className="text-sm text-white/50">
                  Actividades dinámicas para potenciar tu progreso
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar misiones secundarias"
              className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto custom-scrollbar">
            {creating ? (
              <form onSubmit={handleCreate} className="space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="flex items-center gap-1 text-sm text-white/50 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft size={16} /> Volver a misiones disponibles
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAiSideQuestOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300 hover:text-rose-200 cursor-pointer"
                  >
                    <Sparkles size={14} /> Diseñar con IA
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Crear misión personalizada</h3>
                  <p className="mt-1 text-sm text-white/50">
                    Define una misión solo para ti y sus condiciones exactas.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="md:col-span-2 text-sm text-white/70">
                    Nombre
                    <input
                      required
                      maxLength={100}
                      value={customQuest.title}
                      onChange={(e) => setCustomQuest({ ...customQuest, title: e.target.value })}
                      placeholder="Ej. Leer 20 páginas"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-rose-400"
                    />
                  </label>
                  <label className="md:col-span-2 text-sm text-white/70">
                    Descripción
                    <textarea
                      maxLength={2000}
                      value={customQuest.description}
                      onChange={(e) =>
                        setCustomQuest({ ...customQuest, description: e.target.value })
                      }
                      placeholder="Qué quieres conseguir y cuáles son las reglas"
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-rose-400"
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    Dificultad
                    <select
                      value={customQuest.difficulty}
                      onChange={(e) =>
                        setCustomQuest({ ...customQuest, difficulty: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none"
                    >
                      <option value="Easy">Fácil</option>
                      <option value="Medium">Media</option>
                      <option value="Hard">Difícil</option>
                    </select>
                  </label>
                  <label className="text-sm text-white/70">
                    Duración (días)
                    <input
                      required
                      type="number"
                      min={1}
                      max={3650}
                      value={customQuest.durationDays}
                      onChange={(e) =>
                        setCustomQuest({ ...customQuest, durationDays: Number(e.target.value) })
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-rose-400"
                    />
                  </label>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white">Tareas de la misión</h4>
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
                      className="flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Plus size={16} /> Añadir tarea
                    </button>
                  </div>
                  {customQuest.tasks.map((task, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-white/10 bg-white/[.03] p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-white/40">
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
                            className="text-white/40 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <input
                        required
                        maxLength={200}
                        value={task.title}
                        onChange={(e) => updateTask(index, { title: e.target.value })}
                        placeholder="Qué debes hacer"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-rose-400"
                      />
                      <input
                        maxLength={1000}
                        value={task.description ?? ''}
                        onChange={(e) => updateTask(index, { description: e.target.value })}
                        placeholder="Detalle o criterio de cumplimiento (opcional)"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-rose-400"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={task.frequency}
                          onChange={(e) =>
                            updateTask(index, {
                              frequency: e.target.value as 'daily' | 'weekly' | 'once',
                            })
                          }
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none"
                        >
                          <option value="daily">Cada día</option>
                          <option value="weekly">Cada semana</option>
                          <option value="once">Una vez</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={task.targetValue ?? ''}
                          onChange={(e) =>
                            updateTask(index, {
                              targetValue: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="Objetivo numérico"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-rose-400"
                        />
                      </div>
                      <input
                        maxLength={40}
                        value={task.targetUnit ?? ''}
                        onChange={(e) => updateTask(index, { targetUnit: e.target.value })}
                        placeholder="Unidad del objetivo (páginas, minutos...)"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-rose-400"
                      />
                    </div>
                  ))}
                </div>
                {error && (
                  <p role="alert" className="text-sm text-red-400">
                    {error}
                  </p>
                )}
                <button
                  disabled={isLoading}
                  className="w-full rounded-xl bg-rose-400 py-3 font-bold text-zinc-950 hover:bg-rose-300 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Creando…' : 'Crear y empezar misión'}
                </button>
              </form>
            ) : availableToSubscribe.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <Trophy className="w-14 h-14 text-rose-500/25 mx-auto" />
                <h3 className="text-lg font-bold text-white">¡Increíble!</h3>
                <p className="text-white/50 text-sm max-w-sm mx-auto">
                  Ya estás suscrito a todas las misiones del catálogo. Creá una propia con IA o de
                  forma manual.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2 max-w-md mx-auto">
                  <button
                    type="button"
                    onClick={() => setIsAiSideQuestOpen(true)}
                    className="flex-1 px-5 py-3 bg-rose-400 text-zinc-950 rounded-xl hover:bg-rose-300 transition-colors font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles size={17} /> Crear con IA
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="flex-1 px-5 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors font-semibold border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus size={17} /> Crear manual
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition-colors text-sm font-medium border border-rose-500/20 cursor-pointer"
                >
                  Volver al Dashboard
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="min-h-[240px] rounded-2xl border border-dashed border-rose-400/40 bg-rose-500/5 p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="w-11 h-11 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center mb-3">
                      <Sparkles size={22} />
                    </div>
                    <h3 className="text-lg font-bold text-white">Crear misión personalizada</h3>
                    <p className="mt-1.5 text-sm text-white/55 leading-relaxed">
                      Diseñala conversando con la IA (complementaria a tu plan) o cargala a mano.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAiSideQuestOpen(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-rose-400 text-zinc-950 hover:bg-rose-300 transition-colors text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={15} /> Diseñar con IA
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-white/15 text-white hover:bg-white/5 transition-colors text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={15} /> Crear manualmente
                    </button>
                  </div>
                </div>

                {availableToSubscribe.map((quest) => {
                  const IconComponent =
                    quest.icon && iconMap[quest.icon] ? iconMap[quest.icon] : Trophy;
                  return (
                    <div
                      key={quest.title}
                      className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:border-rose-500/30 hover:bg-rose-950/20 transition-all group flex flex-col"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-rose-950/40 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                          <IconComponent size={24} strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                              quest.difficulty === 'Easy'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : quest.difficulty === 'Medium'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-red-500/10 text-red-500'
                            }`}
                          >
                            {quest.difficulty === 'Easy'
                              ? 'Fácil'
                              : quest.difficulty === 'Medium'
                              ? 'Media'
                              : 'Difícil'}
                          </span>
                          <span className="text-xs font-semibold text-white/50 bg-white/5 px-2 py-1 rounded-md">
                            {quest.durationDays} Días
                          </span>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-white mb-2">{quest.title}</h3>
                      <p className="text-sm text-white/50 mb-6 flex-1">{quest.description}</p>

                      <button
                        onClick={() => handleSubscribe(quest)}
                        disabled={subscribingTo !== null}
                        className="w-full py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-rose-400 bg-rose-400 text-zinc-950 hover:bg-rose-300 hover:border-rose-300 shadow-[0_0_20px_-5px_var(--color-rose-500)] flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {subscribingTo === quest.title ? (
                          <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        ) : (
                          'Suscribirse'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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

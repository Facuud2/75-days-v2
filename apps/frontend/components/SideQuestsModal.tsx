import React, { useState } from 'react';
import { X, Trophy, Target, Droplet, Dumbbell, Book, Sun, Moon, Apple, Footprints, Clock, Plus, Trash2, ChevronLeft } from 'lucide-react';
import { useQuestStore, SideQuestTemplate, CreateQuestInput } from '@/store/useQuestStore';

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
    const { subscribeToQuest, createCustomQuest, quests, availableQuests, isLoading, error } = useQuestStore();
    const [subscribingTo, setSubscribingTo] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [customQuest, setCustomQuest] = useState<CreateQuestInput>({
        title: '', description: '', icon: 'target', difficulty: 'Medium', durationDays: 7,
        tasks: [{ title: '', description: '', icon: 'target', frequency: 'daily', targetValue: null, targetUnit: '' }],
    });

    // Filter out quests the user is already subscribed to (and not completed)
    const activeQuestTitles = quests.filter(q => !q.completed).map(q => q.title);

    const availableToSubscribe = availableQuests.filter(q => !activeQuestTitles.includes(q.title));

    const handleSubscribe = async (quest: SideQuestTemplate) => {
        setSubscribingTo(quest.title);
        await subscribeToQuest(quest.title, quest.difficulty, quest.durationDays);
        setSubscribingTo(null);
        onClose();
    };

    const updateTask = (index: number, patch: Partial<CreateQuestInput['tasks'][number]>) => setCustomQuest((current) => ({
        ...current, tasks: current.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task),
    }));

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        const created = await createCustomQuest(customQuest);
        if (created) onClose();
    };

    return (
        <div className="mobile-sheet-root fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="side-quests-modal mobile-sheet-panel relative bg-[#1a0b12] border border-rose-950/50 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-rose-950/50 flex justify-between items-center bg-rose-950/10 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                            <Trophy className="text-rose-500" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Misiones Secundarias</h2>
                            <p className="text-sm text-white/50">Actividades dinámicas para potenciar tu progreso</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {creating ? (
                        <form onSubmit={handleCreate} className="space-y-5">
                            <button type="button" onClick={() => setCreating(false)} className="flex items-center gap-1 text-sm text-white/50 hover:text-white">
                                <ChevronLeft size={16} /> Volver a misiones disponibles
                            </button>
                            <div>
                                <h3 className="text-xl font-bold text-white">Crear misión personalizada</h3>
                                <p className="mt-1 text-sm text-white/50">Define una misión solo para ti y sus condiciones exactas.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="md:col-span-2 text-sm text-white/70">Nombre
                                    <input required maxLength={100} value={customQuest.title} onChange={(e) => setCustomQuest({ ...customQuest, title: e.target.value })} placeholder="Ej. Leer 20 páginas" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-rose-400" />
                                </label>
                                <label className="md:col-span-2 text-sm text-white/70">Descripción
                                    <textarea maxLength={2000} value={customQuest.description} onChange={(e) => setCustomQuest({ ...customQuest, description: e.target.value })} placeholder="Qué quieres conseguir y cuáles son las reglas" rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-rose-400" />
                                </label>
                                <label className="text-sm text-white/70">Dificultad
                                    <select value={customQuest.difficulty} onChange={(e) => setCustomQuest({ ...customQuest, difficulty: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none"><option value="Easy">Fácil</option><option value="Medium">Media</option><option value="Hard">Difícil</option></select>
                                </label>
                                <label className="text-sm text-white/70">Duración (días)
                                    <input required type="number" min={1} max={3650} value={customQuest.durationDays} onChange={(e) => setCustomQuest({ ...customQuest, durationDays: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-rose-400" />
                                </label>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between"><h4 className="font-bold text-white">Tareas de la misión</h4><button type="button" onClick={() => setCustomQuest({ ...customQuest, tasks: [...customQuest.tasks, { title: '', description: '', icon: 'target', frequency: 'daily', targetValue: null, targetUnit: '' }] })} className="flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300"><Plus size={16} /> Añadir tarea</button></div>
                                {customQuest.tasks.map((task, index) => <div key={index} className="rounded-2xl border border-white/10 bg-white/[.03] p-4 space-y-3">
                                    <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-white/40">Tarea {index + 1}</span>{customQuest.tasks.length > 1 && <button type="button" onClick={() => setCustomQuest({ ...customQuest, tasks: customQuest.tasks.filter((_, taskIndex) => taskIndex !== index) })} aria-label="Eliminar tarea" className="text-white/40 hover:text-red-400"><Trash2 size={16} /></button>}</div>
                                    <input required maxLength={200} value={task.title} onChange={(e) => updateTask(index, { title: e.target.value })} placeholder="Qué debes hacer" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-rose-400" />
                                    <input maxLength={1000} value={task.description ?? ''} onChange={(e) => updateTask(index, { description: e.target.value })} placeholder="Detalle o criterio de cumplimiento (opcional)" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-rose-400" />
                                    <div className="grid grid-cols-2 gap-3"><select value={task.frequency} onChange={(e) => updateTask(index, { frequency: e.target.value as 'daily' | 'weekly' | 'once' })} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none"><option value="daily">Cada día</option><option value="weekly">Cada semana</option><option value="once">Una vez</option></select><input type="number" min={1} value={task.targetValue ?? ''} onChange={(e) => updateTask(index, { targetValue: e.target.value ? Number(e.target.value) : null })} placeholder="Objetivo numérico" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-rose-400" /></div>
                                    <input maxLength={40} value={task.targetUnit ?? ''} onChange={(e) => updateTask(index, { targetUnit: e.target.value })} placeholder="Unidad del objetivo (páginas, minutos...)" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-rose-400" />
                                </div>)}
                            </div>
                            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                            <button disabled={isLoading} className="w-full rounded-xl bg-rose-400 py-3 font-bold text-zinc-950 hover:bg-rose-300 disabled:opacity-50">{isLoading ? 'Creando…' : 'Crear y empezar misión'}</button>
                        </form>
                    ) : availableToSubscribe.length === 0 ? (
                        <div className="text-center py-12">
                            <Trophy className="w-16 h-16 text-rose-500/20 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">¡Increíble!</h3>
                            <p className="text-white/50 mb-6 max-w-sm mx-auto">
                                Ya estás suscrito a todas las misiones disponibles. Completa algunas para desbloquear más.
                            </p>
                            <button
                                onClick={() => setCreating(true)}
                                className="mb-3 w-full px-6 py-3 bg-rose-400 text-zinc-950 rounded-xl hover:bg-rose-300 transition-colors font-bold"
                            >
                                <Plus size={17} className="inline mr-2" /> Crear misión personalizada
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20 transition-colors font-medium border border-rose-500/20"
                            >
                                Volver al Dashboard
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button onClick={() => setCreating(true)} className="min-h-[240px] rounded-2xl border border-dashed border-rose-400/40 bg-rose-500/5 p-5 text-left hover:bg-rose-500/10 transition-colors"><Plus className="mb-4 text-rose-400" size={28} /><h3 className="text-lg font-bold text-white">Crear misión personalizada</h3><p className="mt-2 text-sm text-white/50">Configura tus propias tareas, duración y objetivos.</p></button>
                            {availableToSubscribe.map((quest) => {
                                const IconComponent = quest.icon && iconMap[quest.icon] ? iconMap[quest.icon] : Trophy;
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
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${quest.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    quest.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                                                        'bg-red-500/10 text-red-500'
                                                    }`}>
                                                    {quest.difficulty === 'Easy' ? 'Fácil' : quest.difficulty === 'Medium' ? 'Media' : 'Difícil'}
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
                                            className="w-full py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-rose-400 bg-rose-400 text-zinc-950 hover:bg-rose-300 hover:border-rose-300 shadow-[0_0_20px_-5px_var(--color-rose-500)] flex items-center justify-center gap-2"
                                        >
                                            {subscribingTo === quest.title ? (
                                                <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                            ) : (
                                                'Suscribirse'
                                            )}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

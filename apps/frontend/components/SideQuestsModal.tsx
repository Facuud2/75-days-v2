import React, { useState } from 'react';
import { X, Trophy, Target, Droplet, Dumbbell, Book, Sun, Moon, Apple, Footprints, Clock } from 'lucide-react';
import { useQuestStore, SideQuestTemplate } from '@/store/useQuestStore';
import { motion, AnimatePresence } from 'framer-motion';

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
    const { subscribeToQuest, quests, availableQuests, isLoading } = useQuestStore();
    const [subscribingTo, setSubscribingTo] = useState<string | null>(null);

    // Filter out quests the user is already subscribed to (and not completed)
    const activeQuestTitles = quests.filter(q => !q.completed).map(q => q.title);

    const availableToSubscribe = availableQuests.filter(q => !activeQuestTitles.includes(q.title));

    const handleSubscribe = async (quest: SideQuestTemplate) => {
        setSubscribingTo(quest.title);
        await subscribeToQuest(quest.title, quest.difficulty, quest.durationDays);
        setSubscribingTo(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative bg-[#1a0b12] border border-rose-950/50 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">

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
                    {availableToSubscribe.length === 0 ? (
                        <div className="text-center py-12">
                            <Trophy className="w-16 h-16 text-rose-500/20 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">¡Increíble!</h3>
                            <p className="text-white/50 mb-6 max-w-sm mx-auto">
                                Ya estás suscrito a todas las misiones disponibles. Completa algunas para desbloquear más.
                            </p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20 transition-colors font-medium border border-rose-500/20"
                            >
                                Volver al Dashboard
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                            className="w-full py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-rose-500 bg-rose-500 text-white hover:bg-rose-600 hover:border-rose-600 shadow-[0_0_20px_-5px_var(--color-rose-500)] flex items-center justify-center gap-2"
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

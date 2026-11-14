import { X, CheckCircle2 } from 'lucide-react';

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    color: string;
    unlocked: boolean;
    unlockedAt: string | null;
    progress: number;
    total: number;
}

interface AchievementsModalProps {
    isOpen: boolean;
    onClose: () => void;
    achievements: Achievement[];
}

export default function AchievementsModal({ isOpen, onClose, achievements }: AchievementsModalProps) {
    if (!isOpen) return null;

    const list = achievements || [];
    const unlockedCount = list.filter(a => a.unlocked).length;
    const percentage = list.length > 0 ? Math.round((unlockedCount / list.length) * 100) : 0;

    return (
        <div className="mobile-sheet-root fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="mobile-sheet-panel bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-md">
                    <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent flex items-center gap-2">
                            <span className="text-2xl">🏆</span> Tus Logros
                        </h2>
                        <p className="text-zinc-400 text-sm mt-1">
                            Has desbloqueado {unlockedCount} de {achievements.length} logros ({percentage}%)
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-4 bg-zinc-950/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {achievements.map((ach) => (
                            <div
                                key={ach.id}
                                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-3 ${ach.unlocked
                                        ? 'bg-zinc-900/80 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                                        : 'bg-zinc-950/50 border-zinc-800/60 opacity-75 grayscale-[50%]'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner ${ach.color}`}>
                                        {ach.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h4 className={`font-bold truncate ${ach.unlocked ? 'text-zinc-100' : 'text-zinc-300'}`}>
                                                {ach.title}
                                            </h4>
                                            {ach.unlocked && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]" />}
                                        </div>
                                        <p className="text-xs text-zinc-400 leading-relaxed min-h-[40px]">{ach.description}</p>
                                    </div>
                                </div>

                                <div className="mt-auto pt-3 border-t border-zinc-800/50">
                                    {ach.unlocked ? (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-yellow-500/90 font-medium">¡Completado!</span>
                                            <span className="text-zinc-500">
                                                {ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : ''}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-medium">Progreso</span>
                                                <span className="text-zinc-400 font-bold">{ach.progress} <span className="text-zinc-600">/ {ach.total}</span></span>
                                            </div>
                                            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
                                                <div
                                                    className="h-full bg-gradient-to-r from-zinc-700 to-zinc-500 rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${Math.min(100, (ach.progress / ach.total) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

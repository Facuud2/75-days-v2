import { useState } from 'react';
import { Check, Clock, RotateCcw, Target, Trophy, X } from 'lucide-react';
import { SideQuest, useQuestStore } from '@/store/useQuestStore';

interface Props {
  quest: SideQuest;
  onClose: () => void;
}

export default function SideQuestDetailModal({ quest, onClose }: Props) {
  const { toggleTask, restartQuest } = useQuestStore();
  const liveQuest = useQuestStore(state => state.quests.find(item => item.id === quest.id) ?? quest);
  const inFlightTasksRef = useState(() => new Set<string>())[0];
  const tasks = liveQuest.currentRun?.tasks ?? [];
  const done = tasks.filter(task => task.completed).length;

  const handleTask = (taskId: string) => {
    if (inFlightTasksRef.has(taskId)) return;
    inFlightTasksRef.add(taskId);
    void toggleTask(liveQuest.id, taskId).finally(() => {
      inFlightTasksRef.delete(taskId);
    });
  };

  const handleRestart = () => {
    void restartQuest(liveQuest.id);
    onClose();
  };

  return (
    <div className="mobile-sheet-root fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="side-quest-detail-title">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default" aria-label="Cerrar detalle" onClick={onClose} />
      <div className="mobile-sheet-panel relative w-full max-w-xl max-h-[88vh] overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#171016] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-emerald-950/20 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400"><Trophy size={21} /></div>
            <div>
              <h2 id="side-quest-detail-title" className="text-xl font-bold text-white">{liveQuest.title}</h2>
              <p className="mt-1 text-sm text-white/55">Ejecución {liveQuest.currentRun?.runNumber ?? 1} · {done} de {tasks.length} tareas</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white" aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="max-h-[calc(88vh-170px)] overflow-y-auto p-6">
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100/70">Esta misión todavía no tiene tareas configuradas.</div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <button key={task.id} onClick={() => handleTask(task.id)} disabled={liveQuest.completed} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${task.completed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/[.03] hover:border-emerald-500/40 hover:bg-emerald-950/20'}`}>
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${task.completed ? 'border-emerald-400 bg-emerald-400 text-zinc-950' : 'border-white/25 text-white/0'}`}>
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold ${task.completed ? 'text-emerald-100 line-through' : 'text-white'}`}>{task.title}</span>
                    {task.description && <span className="mt-1 block text-xs leading-relaxed text-white/50">{task.description}</span>}
                    <span className="mt-2 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-white/35">
                      <span className="flex items-center gap-1"><Clock size={12} /> {task.frequency === 'daily' ? 'Diaria' : task.frequency}</span>
                      {task.targetValue && <span className="flex items-center gap-1"><Target size={12} /> {task.targetValue} {task.targetUnit}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} /></div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 p-5">
          <span className="text-xs text-white/45">Completada {liveQuest.completionCount} {liveQuest.completionCount === 1 ? 'vez' : 'veces'}</span>
          <button onClick={handleRestart} className="flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/30 px-4 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/10"><RotateCcw size={15} /> Reiniciar misión</button>
        </footer>
      </div>
    </div>
  );
}

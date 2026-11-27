import { useState } from 'react';
import { Check, Clock, RotateCcw, Trophy, X } from 'lucide-react';
import { SideQuest, SideQuestTask, useQuestStore } from '@/store/useQuestStore';
import InlineMetricEditor from './InlineMetricEditor';

interface Props {
  quest: SideQuest;
  onClose: () => void;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  monthly: 'Mensual',
  once: 'Única',
};

function getPeriodTarget(task: SideQuestTask): number {
  if (typeof task.periodTarget === 'number' && task.periodTarget > 0) {
    return task.periodTarget;
  }
  if (
    task.measurementType &&
    task.measurementType !== 'boolean' &&
    typeof task.targetValue === 'number' &&
    task.targetValue > 0
  ) {
    return task.targetValue;
  }
  if (typeof task.targetValue === 'number' && task.targetValue > 1) {
    return task.targetValue;
  }
  return 1;
}

function isDynamicTask(task: SideQuestTask): boolean {
  if (task.measurementType === 'count' || task.measurementType === 'numeric') {
    return true;
  }
  return getPeriodTarget(task) > 1;
}

export default function SideQuestDetailModal({ quest, onClose }: Props) {
  const { toggleTask, restartQuest } = useQuestStore();
  const liveQuest = useQuestStore(state => state.quests.find(item => item.id === quest.id) ?? quest);
  const inFlightTasksRef = useState(() => new Set<string>())[0];
  const tasks = liveQuest.currentRun?.tasks ?? [];
  const done = tasks.filter(task => task.completed).length;
  const currentDay = liveQuest.currentRun?.currentDay ?? Math.max(1, liveQuest.progress || 1);

  const handleTask = (
    taskId: string,
    action: 'toggle' | 'increment' | 'decrement' | 'set' = 'toggle',
    options?: { delta?: number; value?: number }
  ) => {
    if (inFlightTasksRef.has(taskId)) return;
    inFlightTasksRef.add(taskId);
    void toggleTask(liveQuest.id, taskId, action, options).finally(() => {
      inFlightTasksRef.delete(taskId);
    });
  };

  const handleRestart = () => {
    void restartQuest(liveQuest.id);
    onClose();
  };

  return (
    <div
      className="mobile-sheet-root fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="side-quest-detail-title"
    >
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
        aria-label="Cerrar detalle"
        onClick={onClose}
      />
      <div className="side-quest-detail-modal mobile-sheet-panel relative w-full max-w-xl max-h-[88vh] overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--divider)] bg-[var(--surface-inset)] p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-[var(--status-success)]">
              <Trophy size={21} />
            </div>
            <div>
              <h2
                id="side-quest-detail-title"
                className="text-xl font-bold text-[var(--text-primary)]"
              >
                {liveQuest.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Ejecución {liveQuest.currentRun?.runNumber ?? 1} · Día {currentDay} de{' '}
                {liveQuest.durationDays} · {done} de {tasks.length} tareas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="max-h-[calc(88vh-170px)] overflow-y-auto p-6">
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm text-[var(--status-warning)]">
              Esta misión todavía no tiene tareas configuradas.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => {
                const periodTarget = getPeriodTarget(task);
                const dynamic = isDynamicTask(task);
                const currentValue =
                  typeof task.currentValue === 'number'
                    ? task.currentValue
                    : task.completed
                      ? periodTarget
                      : 0;

                return (
                  <div
                    key={task.id}
                    className={`w-full rounded-2xl border p-4 transition-colors ${
                      task.completed
                        ? 'border-emerald-500/35 bg-emerald-500/10'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:border-emerald-500/40 hover:bg-[var(--surface-raised)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleTask(task.id, 'toggle')}
                      disabled={liveQuest.completed}
                      className="flex w-full min-w-0 items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          task.completed
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-[var(--border-control)] bg-transparent'
                        }`}
                        style={task.completed ? { color: '#ffffff' } : undefined}
                      >
                        {task.completed ? (
                          <Check size={14} strokeWidth={3} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block font-semibold break-words ${
                            task.completed
                              ? 'text-[var(--status-success)] line-through'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.description && (
                          <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)] break-words">
                            {task.description}
                          </span>
                        )}
                        <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Clock size={12} className="shrink-0" />{' '}
                            {FREQUENCY_LABELS[task.frequency] ?? task.frequency}
                          </span>
                        </span>
                      </span>
                    </button>

                    {dynamic && (
                      <InlineMetricEditor
                        currentValue={currentValue}
                        targetValue={periodTarget}
                        targetUnit={task.targetUnit || (task.measurementType === 'count' ? 'veces' : '')}
                        measurementType={task.measurementType || 'numeric'}
                        disabled={liveQuest.completed}
                        isCompleted={task.completed}
                        compact
                        onDelta={(delta) =>
                          handleTask(task.id, delta > 0 ? 'increment' : 'decrement', {
                            delta: Math.abs(delta),
                          })
                        }
                        onSetValue={(val) =>
                          handleTask(task.id, 'set', { value: val })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Progreso de misión</span>
              <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                {liveQuest.progress} / {liveQuest.durationDays}{' '}
                {liveQuest.durationDays === 1 ? 'día' : 'días'}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--progress-track)]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{
                  width: `${
                    liveQuest.durationDays
                      ? Math.min(100, (liveQuest.progress / liveQuest.durationDays) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--divider)] bg-[var(--surface-inset)] p-5">
          <span className="text-xs text-[var(--text-muted)]">
            Completada {liveQuest.completionCount}{' '}
            {liveQuest.completionCount === 1 ? 'vez' : 'veces'}
          </span>
          <button
            onClick={handleRestart}
            className="flex min-h-10 items-center gap-2 rounded-xl border border-rose-500/30 px-4 text-sm font-semibold text-[var(--accent-text)] transition-colors hover:bg-rose-500/10"
          >
            <RotateCcw size={15} /> Reiniciar misión
          </button>
        </footer>
      </div>
    </div>
  );
}

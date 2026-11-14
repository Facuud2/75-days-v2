'use client';

import { CheckCircle2, ChevronRight, Clock3, Plus, Sparkles } from 'lucide-react';
import BottomSheet from './BottomSheet';
import ProgressBar from './ProgressBar';
import { getQuestIcon } from './icons';
import type { AvailableQuestSummary, QuestSummary } from './types';
import { difficultyLabel, formatInteger, pluralize } from '@/lib/utils/display';

interface ActivitiesSheetProps {
  open: boolean;
  onClose: () => void;
  activeQuests: QuestSummary[];
  completedQuests: QuestSummary[];
  availableQuests: AvailableQuestSummary[];
  onSubscribe: (quest: AvailableQuestSummary) => void;
  subscribingTo: string | null;
  onOpenQuest: (quest: QuestSummary) => void;
  onCreateCustom: () => void;
}

export default function ActivitiesSheet({
  open,
  onClose,
  activeQuests,
  completedQuests,
  availableQuests,
  onSubscribe,
  subscribingTo,
  onOpenQuest,
  onCreateCustom,
}: ActivitiesSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Actividades"
      description="Misiones secundarias para potenciar tu progreso."
      footer={
        <button type="button" onClick={onCreateCustom} className="pv2-ghost w-full">
          <Sparkles size={16} strokeWidth={1.5} aria-hidden="true" />
          Crear actividad propia
        </button>
      }
    >
      {activeQuests.length > 0 ? (
        <section aria-labelledby="active-activities-heading">
          <h3 id="active-activities-heading" className="pv2-label">
            Tus actividades
          </h3>
          <ul className="mt-2 space-y-1">
            {activeQuests.map((quest) => {
              const Icon = getQuestIcon(quest.icon);
              return (
                <li key={quest.id}>
                  <button type="button" onClick={() => onOpenQuest(quest)} className="pv2-row pv2-row--interactive -mx-2">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: 'var(--surface-inset)', color: 'var(--accent-text)' }}
                      aria-hidden="true"
                    >
                      <Icon size={20} strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }} title={quest.title}>
                          {quest.title}
                        </span>
                        <span className="pv2-mono shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatInteger(quest.progress)}/{formatInteger(quest.durationDays)}
                        </span>
                      </span>
                      <span className="mt-1.5 block">
                        <ProgressBar
                          value={quest.progress}
                          max={quest.durationDays}
                          label={`Progreso de ${quest.title}`}
                          valueText={`${formatInteger(quest.progress)} de ${formatInteger(quest.durationDays)} días`}
                        />
                      </span>
                    </span>
                    <ChevronRight size={16} strokeWidth={1.5} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {completedQuests.length > 0 ? (
        <section className="mt-6" aria-labelledby="completed-activities-heading">
          <h3 id="completed-activities-heading" className="pv2-label">
            Completadas
          </h3>
          <ul className="mt-2 space-y-1">
            {completedQuests.map((quest) => {
              const Icon = getQuestIcon(quest.icon);
              return (
                <li key={quest.id}>
                  <button type="button" onClick={() => onOpenQuest(quest)} className="pv2-row pv2-row--interactive -mx-2">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: 'var(--surface-inset)', color: 'var(--status-success)' }}
                      aria-hidden="true"
                    >
                      <Icon size={20} strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-secondary)' }} title={quest.title}>
                        {quest.title}
                      </span>
                      <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-muted)' }}>
                        {pluralize(quest.completionCount, 'vez completada', 'veces completada')}
                      </span>
                    </span>
                    <CheckCircle2 size={16} strokeWidth={1.5} className="shrink-0" style={{ color: 'var(--status-success)' }} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className={activeQuests.length > 0 || completedQuests.length > 0 ? 'mt-6' : ''} aria-labelledby="available-activities-heading">
        <h3 id="available-activities-heading" className="pv2-label">
          Descubrir
        </h3>

        {availableQuests.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay actividades nuevas disponibles. Crea una propia o vuelve más tarde.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {availableQuests.map((quest) => {
              const Icon = getQuestIcon(quest.icon);
              const isSubscribing = subscribingTo === quest.title;
              return (
                <li key={quest.id || quest.title} className="pv2-inset p-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: 'var(--surface-card)', color: 'var(--accent-text)' }}
                      aria-hidden="true"
                    >
                      <Icon size={20} strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--text-primary)' }}>
                          {quest.title}
                        </h4>
                        <span className="pv2-chip shrink-0">{difficultyLabel(quest.difficulty)}</span>
                      </div>

                      {quest.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed [overflow-wrap:anywhere]" style={{ color: 'var(--text-muted)' }}>
                          {quest.description}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="pv2-chip">
                          <Clock3 size={12} strokeWidth={1.5} aria-hidden="true" />
                          {pluralize(quest.durationDays, 'día', 'días')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSubscribe(quest)}
                    disabled={subscribingTo !== null}
                    className="pv2-ghost mt-3 w-full disabled:opacity-55"
                  >
                    {isSubscribing ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                        Suscribiendo…
                      </>
                    ) : (
                      <>
                        <Plus size={16} strokeWidth={2} aria-hidden="true" />
                        Suscribirse
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </BottomSheet>
  );
}

'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Flame,
  Plus,
  Share2,
  Target,
  Trophy,
} from 'lucide-react';
import ProgressBar from './ProgressBar';
import { goalIconMap, getQuestIcon } from './icons';
import type { ChallengeSummary, QuestSummary } from './types';
import { difficultyLabel, formatInteger, formatNumber, pluralize } from '@/lib/utils/display';

const ShareProgressModal = dynamic(() => import('@/components/ShareProgressModal'), { ssr: false });

interface ProfileChallengesProps {
  data: ChallengeSummary;
  onContinue: () => void;
  onStartChallenge: () => void;
  onDiscoverActivities: () => void;
  onOpenQuest: (quest: QuestSummary) => void;
  loading?: boolean;
}

export default function ProfileChallenges({
  data,
  onContinue,
  onStartChallenge,
  onDiscoverActivities,
  onOpenQuest,
  loading = false,
}: ProfileChallengesProps) {
  const [shareOpen, setShareOpen] = useState(false);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando retos">
        <div className="pv2-skeleton h-4 w-28" />
        <div className="pv2-skeleton h-9 w-44" />
        <div className="pv2-skeleton h-1 w-full" />
        <div className="pv2-skeleton h-11 w-full" />
        <div className="pv2-skeleton h-14 w-full" />
      </div>
    );
  }

  if (!data.isActive) {
    return (
      <div className="pv2-inset p-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--surface-card)', color: 'var(--accent-text)' }}
            aria-hidden="true"
          >
            <Target size={20} strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Sin reto activo
            </h3>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Elige un plan de 75 días para empezar a registrar tu progreso diario.
            </p>
          </div>
        </div>
        <button type="button" onClick={onStartChallenge} className="pv2-button mt-4 w-full">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Empezar un reto
        </button>
      </div>
    );
  }

  const completedToday = (data.todayGoals || []).filter((goal) => goal.completed).length;
  const totalGoals = (data.todayGoals || []).length;
  const activeQuests = (data.activeQuests || []).slice(0, 3);
  const hiddenQuests = Math.max(0, (data.activeQuests || []).length - activeQuests.length);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="pv2-label">Reto actual</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Compartir progreso del reto"
            className="pv2-chip inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
          >
            <Share2 size={12} aria-hidden="true" />
            <span>Compartir</span>
          </button>
          <span className="pv2-chip">{difficultyLabel(data.difficulty)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Desafío 75
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {totalGoals > 0
              ? `${formatInteger(completedToday)} de ${formatInteger(totalGoals)} ${
                  totalGoals === 1 ? 'tarea' : 'tareas'
                } de hoy`
              : 'Sin tareas configuradas para hoy'}
          </p>
        </div>

        <p className="pv2-num shrink-0 text-[34px] font-medium leading-none" style={{ color: 'var(--text-primary)' }}>
          {formatInteger(data.currentDay)}
          <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>
            /75
          </span>
        </p>
      </div>

      <ProgressBar
        className="mt-4"
        value={data.currentDay}
        max={75}
        label="Progreso del reto actual"
        valueText={`Día ${formatInteger(data.currentDay)} de 75`}
      />

      {totalGoals > 0 ? (
        <ul className="mt-4 space-y-2" aria-label="Tareas de hoy">
          {data.todayGoals.slice(0, 3).map((goal) => {
            const Icon = goalIconMap[goal.icon || 'target'] || Target;
            return (
              <li key={goal.id} className="flex min-w-0 items-center gap-2 text-sm">
                {goal.completed ? (
                  <CheckCircle2
                    size={16}
                    strokeWidth={1.5}
                    className="shrink-0"
                    style={{ color: 'var(--status-success)' }}
                    aria-hidden="true"
                  />
                ) : (
                  <Icon
                    size={16}
                    strokeWidth={1.5}
                    className="shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`min-w-0 truncate ${goal.completed ? 'line-through' : ''}`}
                  style={{ color: goal.completed ? 'var(--text-muted)' : 'var(--text-secondary)' }}
                  title={goal.title}
                >
                  {goal.title}
                </span>
              </li>
            );
          })}
          {totalGoals > 3 ? (
            <li className="pl-6 text-xs" style={{ color: 'var(--text-muted)' }}>
              +{formatInteger(totalGoals - 3)} {totalGoals - 3 === 1 ? 'tarea más' : 'tareas más'}
            </li>
          ) : null}
        </ul>
      ) : null}

      <button type="button" onClick={onContinue} className="pv2-button mt-4 w-full">
        Continuar el día {formatInteger(data.currentDay)}
        <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="pv2-inset px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Flame size={14} strokeWidth={1.5} aria-hidden="true" />
            Racha
          </dt>
          <dd className="pv2-num mt-1 text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
            {pluralize(data.streak, 'día', 'días')}
          </dd>
        </div>
        <div className="pv2-inset px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Trophy size={14} strokeWidth={1.5} aria-hidden="true" />
            Completados
          </dt>
          <dd className="pv2-num mt-1 text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
            {pluralize(data.challengesCompleted, 'reto', 'retos')}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Actividades
          </h4>
          <button type="button" onClick={onDiscoverActivities} className="pv2-link min-h-9 text-xs">
            Descubrir
            <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {activeQuests.length === 0 ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sin actividades activas.
            </p>
            {data.completedQuestsCount > 0 ? (
              <span className="pv2-chip">{pluralize(data.completedQuestsCount, 'completada', 'completadas')}</span>
            ) : null}
          </div>
        ) : (
          <ul className="mt-1 space-y-1">
            {activeQuests.map((quest) => {
              const Icon = getQuestIcon(quest.icon);
              return (
                <li key={quest.id}>
                  <button
                    type="button"
                    onClick={() => onOpenQuest(quest)}
                    className="pv2-row pv2-row--interactive -mx-2"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: 'var(--surface-inset)', color: 'var(--accent-text)' }}
                      aria-hidden="true"
                    >
                      <Icon size={18} strokeWidth={1.5} />
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
                          valueText={`${formatNumber(quest.progress)} de ${formatNumber(quest.durationDays)} días`}
                        />
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      strokeWidth={1.5}
                      className="shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hiddenQuests > 0 ? (
          <button type="button" onClick={onDiscoverActivities} className="pv2-link mt-1 text-xs">
            +{formatInteger(hiddenQuests)} {hiddenQuests === 1 ? 'actividad más' : 'actividades más'}
          </button>
        ) : null}
      </div>
      {shareOpen && (
        <ShareProgressModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          initialKind="challenge"
          dailySource={{
            date: format(new Date(), 'yyyy-MM-dd'),
            dayNumber: Math.max(1, data.currentDay),
            goals: (data.todayGoals || []).map((g) => ({
              id: g.id,
              title: g.title,
              icon: g.icon,
              completed: g.completed,
            })),
          }}
        />
      )}
    </div>
  );
}

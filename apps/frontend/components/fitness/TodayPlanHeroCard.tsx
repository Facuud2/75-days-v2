'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Clock,
  Coffee,
  Dumbbell,
  Footprints,
  Home,
  Layers,
  Moon,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunrise,
  Trees,
  Wand2,
} from 'lucide-react';
import type {
  TrainingPlanRecord,
  TrainingPlanSlotRecord,
  TrainingSlotTimeOfDay,
} from '@/lib/api/health';
import { formatMuscleLabel, SPORT_LABELS_ES } from '@/lib/constants/fitness';

const DAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const DAY_FULL = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

const ENV_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  gym: { label: 'Gimnasio', icon: Dumbbell },
  home: { label: 'En casa', icon: Home },
  outdoor: { label: 'Aire libre', icon: Trees },
  mixed: { label: 'Mixto', icon: Layers },
};

const TIME_META: Record<
  Exclude<TrainingSlotTimeOfDay, 'any'>,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  morning: { label: 'Mañana', icon: Sunrise },
  afternoon: { label: 'Tarde', icon: Sun },
  evening: { label: 'Noche', icon: Moon },
};

const AI_QUICK_PROMPTS = [
  {
    label: 'Semanal 4 días en gym',
    prompt: 'Armame un plan semanal de 4 días en gimnasio equilibrado (empuje, tracción, piernas y tren superior)',
  },
  {
    label: 'Diaria en casa 45 min',
    prompt: 'Quiero una rutina diaria en casa de 45 minutos sin máquinas para hacer todos los días',
  },
  {
    label: 'Caminata + Fuerza',
    prompt: 'Organizame la semana con caminata por la mañana y fuerza por la tarde (brazos, piernas, pecho y core)',
  },
];

interface TodayPlanHeroCardProps {
  plans: TrainingPlanRecord[];
  activePlan: TrainingPlanRecord | null;
  onOpenAiPlanner: (options?: { initialPrompt?: string; editActivePlan?: boolean }) => void;
  onOpenManualBuilder: (plan?: TrainingPlanRecord | null) => void;
  onSelectActivePlan: (planId: string) => void;
  onStartSlot: (slot: TrainingPlanSlotRecord) => void;
}

function getTodayIsoIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

export default function TodayPlanHeroCard({
  plans,
  activePlan,
  onOpenAiPlanner,
  onOpenManualBuilder,
  onSelectActivePlan,
  onStartSlot,
}: TodayPlanHeroCardProps) {
  const todayIdx = useMemo(() => getTodayIsoIndex(), []);
  const [selectedDay, setSelectedDay] = useState<number>(todayIdx);

  const visibleSlots = useMemo(() => {
    if (!activePlan) return [];
    const sorted = [...activePlan.slots].sort((a, b) => a.order - b.order);
    if (activePlan.scheduleType === 'weekly') {
      return sorted.filter((slot) => slot.dayOfWeek === selectedDay);
    }
    return sorted;
  }, [activePlan, selectedDay]);

  const activeDaysSet = useMemo(() => {
    const set = new Set<number>();
    if (!activePlan || activePlan.scheduleType !== 'weekly') return set;
    for (const slot of activePlan.slots) {
      if (slot.dayOfWeek !== null && slot.slotType !== 'rest') {
        set.add(slot.dayOfWeek);
      }
    }
    return set;
  }, [activePlan]);

  // EMPTY STATE — Warm, inviting AI-first hero + clear manual creation option
  if (!activePlan) {
    return (
      <section
        aria-label="Planificador de rutinas con IA"
        className="relative overflow-hidden rounded-[22px] border border-[var(--border-subtle)] p-5"
        style={{
          background:
            'radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--accent-fill) 16%, transparent), transparent 60%), var(--surface-card)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-fill)]/30 bg-[var(--accent-fill)]/12 px-2.5 py-1 text-[11px] font-bold text-[var(--accent-text)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Entrenador IA
          </div>
          <span className="rounded-full bg-[var(--surface-inset)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
            Diario o Semanal
          </span>
        </div>

        <h2 className="mt-3 text-[19px] font-bold leading-snug tracking-[-0.015em] text-[var(--text-primary)]">
          Diseñá tu rutina inteligente en segundos
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Contale por voz o texto tus días, horarios y si entrenás en casa o gimnasio. La IA arma tu
          plan con ejercicios reales y adaptado a las metas de tu reto.
        </p>

        {/* Quick-start AI prompt chips */}
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {AI_QUICK_PROMPTS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onOpenAiPlanner({ initialPrompt: chip.prompt })}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-fill)]/50 hover:text-[var(--text-primary)] active:scale-[0.98]"
            >
              <Wand2 className="h-3 w-3 text-[var(--accent-text)]" aria-hidden="true" />
              {chip.label}
            </button>
          ))}
        </div>

        {/* Primary AI CTA + Always-visible Manual CTA */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onOpenAiPlanner()}
            className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill)] px-4 py-2.5 text-[13px] font-bold text-[var(--on-accent)] shadow-sm transition-all hover:bg-[var(--accent-fill-hover)] active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Crear rutina con IA
          </button>

          <button
            type="button"
            onClick={() => onOpenManualBuilder(null)}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] active:scale-[0.98]"
          >
            <SlidersHorizontal className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            Armar a mano
          </button>
        </div>
      </section>
    );
  }

  const envInfo = ENV_META[activePlan.environment] ?? ENV_META.mixed;
  const EnvIcon = envInfo.icon;
  const scheduleLabel =
    activePlan.scheduleType === 'weekly'
      ? 'Plan semanal'
      : activePlan.scheduleType === 'daily'
        ? 'Rutina diaria'
        : 'Secuencia';

  return (
    <section
      aria-label="Plan de entrenamiento activo"
      className="overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-card)]"
    >
      {/* Top Plan Header */}
      <div
        className="border-b border-[var(--divider)] px-4 py-4"
        style={{
          background:
            'radial-gradient(100% 120% at 100% 0%, color-mix(in srgb, var(--accent-fill) 11%, transparent), transparent 65%)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-fill)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-text)]">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                {scheduleLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                <EnvIcon className="h-3 w-3 text-[var(--text-muted)]" aria-hidden="true" />
                {envInfo.label}
              </span>
            </div>
            <h2 className="mt-1.5 truncate text-[17px] font-bold text-[var(--text-primary)]">
              {activePlan.name}
            </h2>
            {activePlan.goalSummary ? (
              <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--text-muted)]">
                {activePlan.goalSummary}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenAiPlanner({ editActivePlan: true })}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--accent-fill)]/15 px-3 text-xs font-bold text-[var(--accent-text)] transition-colors hover:bg-[var(--accent-fill)]/25 active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Ajustar IA
            </button>
            <button
              type="button"
              onClick={() => onOpenManualBuilder(activePlan)}
              aria-label="Editar plan manualmente"
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] active:scale-95"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Editar
            </button>
          </div>
        </div>

        {/* Plan Switcher if user has multiple plans */}
        {plans.length > 1 ? (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {plans.map((p) => {
              const isCurrent = p.id === activePlan.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => !isCurrent && onSelectActivePlan(p.id)}
                  className={`shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-[var(--text-primary)] text-[var(--surface-page)]'
                      : 'border border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Weekly L–D Strip */}
        {activePlan.scheduleType === 'weekly' ? (
          <div
            role="tablist"
            aria-label="Días de la semana"
            className="mt-3.5 grid grid-cols-7 gap-1.5"
          >
            {DAY_SHORT.map((letter, idx) => {
              const isSelected = selectedDay === idx;
              const isToday = todayIdx === idx;
              const hasTraining = activeDaysSet.has(idx);
              return (
                <button
                  key={letter}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={DAY_FULL[idx]}
                  onClick={() => setSelectedDay(idx)}
                  className={`relative flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    isSelected
                      ? 'border-[var(--accent-fill)] bg-[var(--accent-fill)] text-[var(--on-accent)] shadow-sm'
                      : isToday
                        ? 'border-[var(--accent-fill)]/45 bg-[var(--surface-inset)] text-[var(--accent-text)]'
                        : 'border-transparent bg-[var(--surface-inset)]/70 text-[var(--text-secondary)] hover:bg-[var(--surface-inset)]'
                  }`}
                >
                  <span>{letter}</span>
                  <span
                    className={`mt-1 h-1.5 w-1.5 rounded-full ${
                      hasTraining
                        ? isSelected
                          ? 'bg-[var(--on-accent)]'
                          : 'bg-[var(--accent-fill)]'
                        : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Day Slots Stack */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {activePlan.scheduleType === 'weekly'
              ? `${DAY_FULL[selectedDay]}${selectedDay === todayIdx ? ' · Hoy' : ''}`
              : 'Bloques de tu rutina'}
          </p>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">
            {visibleSlots.filter((s) => s.slotType !== 'rest').length}{' '}
            {visibleSlots.filter((s) => s.slotType !== 'rest').length === 1
              ? 'bloque'
              : 'bloques'}
          </span>
        </div>

        {visibleSlots.length === 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)]/50 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-card)] text-[var(--text-muted)]">
                <Coffee className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Día libre / Descanso
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Recuperá energía o sumá una caminata ligera si tu reto lo pide.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleSlots.map((slot, idx) => {
              const isRest = slot.slotType === 'rest';
              const isCardio = slot.slotType === 'cardio';
              const timeInfo =
                slot.timeOfDay !== 'any' ? TIME_META[slot.timeOfDay] : null;
              const TimeIcon = timeInfo?.icon;
              const exercisesCount = slot.exercises?.length ?? 0;

              return (
                <article
                  key={slot.id ?? `${slot.title}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]/70 p-3.5 transition-colors hover:border-[var(--border-control)]/50"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isRest
                          ? 'bg-[var(--surface-card)] text-[var(--text-muted)]'
                          : isCardio
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-[var(--accent-fill)]/15 text-[var(--accent-text)]'
                      }`}
                    >
                      {isRest ? (
                        <Coffee className="h-5 w-5" aria-hidden="true" />
                      ) : isCardio ? (
                        slot.sport === 'walking' || slot.sport === 'running' ? (
                          <Footprints className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Activity className="h-5 w-5" aria-hidden="true" />
                        )
                      ) : (
                        <Dumbbell className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {timeInfo && TimeIcon ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-card)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                            <TimeIcon className="h-3 w-3 text-[var(--accent-text)]" aria-hidden="true" />
                            {timeInfo.label}
                          </span>
                        ) : null}
                        {slot.targetDurationMin ? (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {slot.targetDurationMin} min
                          </span>
                        ) : null}
                        {slot.targetSteps ? (
                          <span className="text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">
                            · {slot.targetSteps.toLocaleString('es-AR')} pasos
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-0.5 truncate text-[14px] font-bold text-[var(--text-primary)]">
                        {slot.title}
                      </h3>

                      {slot.focusMuscles.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {slot.focusMuscles.slice(0, 4).map((m) => (
                            <span
                              key={m}
                              className="rounded-md bg-[var(--surface-card)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]"
                            >
                              {formatMuscleLabel(m)}
                            </span>
                          ))}
                        </div>
                      ) : isCardio ? (
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {SPORT_LABELS_ES[slot.sport] ?? slot.sport}
                          {slot.notes ? ` · ${slot.notes}` : ''}
                        </p>
                      ) : slot.notes ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
                          {slot.notes}
                        </p>
                      ) : null}

                      {exercisesCount > 0 ? (
                        <p className="mt-1 line-clamp-1 text-[11px] text-[var(--text-muted)]">
                          {exercisesCount}{' '}
                          {exercisesCount === 1 ? 'ejercicio' : 'ejercicios'}:{' '}
                          {slot.exercises!.map((e) => e.exerciseName).join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {!isRest ? (
                    <button
                      type="button"
                      onClick={() => onStartSlot(slot)}
                      aria-label={`Empezar ${slot.title}`}
                      className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-3.5 text-xs font-bold text-[var(--on-accent)] shadow-sm transition-transform hover:bg-[var(--accent-fill-hover)] active:scale-95"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      <span>Empezar</span>
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {/* Footer quick links: always offer AI new plan & Manual plan */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--divider)] pt-2.5">
          <button
            type="button"
            onClick={() => onOpenAiPlanner({ editActivePlan: false })}
            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--accent-text)] transition-colors hover:bg-[var(--accent-fill)]/10"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Nuevo plan con IA
          </button>
          <button
            type="button"
            onClick={() => onOpenManualBuilder(null)}
            className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-inset)] hover:text-[var(--text-primary)]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Crear plan manual
          </button>
        </div>
      </div>
    </section>
  );
}

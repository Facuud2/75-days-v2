'use client';

import React, { useEffect } from 'react';
import {
  Apple,
  BookOpen,
  Check,
  Clock,
  Droplet,
  Footprints,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import type { SideQuestTemplate, SideQuestTask } from '@/store/useQuestStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

type QuestFallback = {
  summary: string;
  rules: string[];
  milestones: string[];
  tasks: Array<
    Pick<
      SideQuestTask,
      'id' | 'title' | 'description' | 'icon' | 'frequency' | 'targetValue' | 'targetUnit'
    >
  >;
};

const QUEST_FALLBACKS: Record<string, QuestFallback> = {
  'Detox de Azúcar (Sugar-Free)': {
    summary:
      'Rompe la dependencia de los alimentos ultraprocesados, estabiliza tus niveles de energía y reduce la inflamación eliminando el azúcar añadido de tu dieta.',
    rules: [
      'Cero consumo de golosinas, repostería, helados o gaseosas azucaradas.',
      'Prohibido añadir azúcar blanca, rubia o endulzantes artificiales a las infusiones (café, té, mate).',
      'El azúcar naturalmente presente en alimentos enteros (como las frutas) sí está permitido.',
    ],
    milestones: [
      'Día 7: Superando el pico de abstinencia.',
      'Día 14: Energía estabilizada.',
      'Día 21: Paladar reiniciado (¡Completado!).',
    ],
    tasks: [
      {
        id: 'sugar-1',
        title: 'Evitar golosinas, repostería, helados y gaseosas azucaradas',
        description: 'No consumir azúcar añadido durante el día.',
        icon: 'apple',
        frequency: 'daily',
        targetValue: null,
        targetUnit: null,
      },
      {
        id: 'sugar-2',
        title: 'No añadir azúcar ni endulzantes a las infusiones',
        description: 'Café, té y mate sin azúcar agregada.',
        icon: 'droplet',
        frequency: 'daily',
        targetValue: null,
        targetUnit: null,
      },
      {
        id: 'sugar-3',
        title: 'Registrar cómo te sentiste sin azúcar',
        description: 'Anota brevemente tu energía o antojos.',
        icon: 'book',
        frequency: 'daily',
        targetValue: null,
        targetUnit: null,
      },
    ],
  },
  'Caminante Constante (8K Steps)': {
    summary:
      'Combate el sedentarismo e incorpora el movimiento natural a tu rutina diaria para fortalecer tu sistema cardiovascular sin necesidad de ir a un gimnasio.',
    rules: [
      'Acumular un mínimo de 8.000 pasos todos los días antes de la medianoche.',
      'Validar el conteo con Google Fit, Apple Health o smartwatch.',
      'Son válidos los pasos por caminata, trote o movimiento general en casa/trabajo.',
    ],
    milestones: [
      'Día 15: Hábito en formación (120.000 pasos acumulados).',
      'Día 30: Resistencia mejorada.',
      'Día 45: Caminante incansable (¡Completado!).',
    ],
    tasks: [
      {
        id: 'steps-1',
        title: 'Alcanzar 8.000 pasos',
        description: 'Completa el objetivo antes de la medianoche.',
        icon: 'footprints',
        frequency: 'daily',
        targetValue: 8000,
        targetUnit: 'pasos',
      },
      {
        id: 'steps-2',
        title: 'Registrar el total de pasos',
        description: 'Usa tu teléfono, reloj o aplicación de actividad.',
        icon: 'clock',
        frequency: 'daily',
        targetValue: null,
        targetUnit: 'pasos',
      },
    ],
  },
  'Maestría Metabólica (Ayuno 12/12)': {
    summary:
      'Dale a tu sistema digestivo el descanso que necesita, promueve la regeneración celular y optimiza tu reloj biológico regulando tus horarios de comida.',
    rules: [
      'Mantener una ventana de ayuno estricto e ininterrumpido de al menos 12 horas diarias.',
      'Durante las horas de ayuno, la ingesta calórica debe ser estrictamente cero.',
      'Solo se permite agua, té, mate o café negro (sin leche ni endulzantes).',
    ],
    milestones: [
      'Día 20: Adaptación digestiva superada.',
      'Día 40: Control total de la saciedad.',
      'Día 60: Maestro del tiempo (¡Completado!).',
    ],
    tasks: [
      {
        id: 'fast-1',
        title: 'Cumplir 12 horas de ayuno',
        description: 'Mantén una ventana diaria de ayuno ininterrumpido.',
        icon: 'clock',
        frequency: 'daily',
        targetValue: 12,
        targetUnit: 'horas',
      },
      {
        id: 'fast-2',
        title: 'Consumir solo bebidas permitidas durante el ayuno',
        description: 'Agua, té, mate o café negro sin endulzantes.',
        icon: 'droplet',
        frequency: 'daily',
        targetValue: null,
        targetUnit: null,
      },
      {
        id: 'fast-3',
        title: 'Registrar horario de inicio y finalización',
        description: 'Deja constancia de tu ventana de ayuno.',
        icon: 'book',
        frequency: 'daily',
        targetValue: null,
        targetUnit: null,
      },
    ],
  },
};

function parseDescription(description: string | null, title: string) {
  const fallback = QUEST_FALLBACKS[title];
  if (!description || !description.trim()) {
    return {
      summary: fallback?.summary ?? '',
      rules: fallback?.rules ?? [],
      milestones: fallback?.milestones ?? [],
    };
  }

  const lines = description.split('\n').map((l) => l.trim());
  const summaryLines: string[] = [];
  const rules: string[] = [];
  const milestones: string[] = [];
  let section: 'summary' | 'rules' | 'milestones' = 'summary';

  for (const line of lines) {
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower.startsWith('reglas clave')) {
      section = 'rules';
      continue;
    }
    if (lower.startsWith('mini-logros') || lower.startsWith('milestones')) {
      section = 'milestones';
      continue;
    }

    const cleaned = line.replace(/^[-•*]\s*/, '');
    if (section === 'summary') summaryLines.push(cleaned);
    else if (section === 'rules') rules.push(cleaned);
    else milestones.push(cleaned);
  }

  return {
    summary: summaryLines.join(' ') || fallback?.summary || '',
    rules: rules.length > 0 ? rules : fallback?.rules ?? [],
    milestones: milestones.length > 0 ? milestones : fallback?.milestones ?? [],
  };
}

function renderQuestIcon(iconName: string | null, size = 18) {
  switch (iconName) {
    case 'apple':
      return <Apple size={size} />;
    case 'footprints':
      return <Footprints size={size} />;
    case 'clock':
      return <Clock size={size} />;
    case 'droplet':
      return <Droplet size={size} />;
    case 'book':
      return <BookOpen size={size} />;
    default:
      return <Trophy size={size} />;
  }
}

type QuestPreviewSheetProps = {
  quest: SideQuestTemplate | null;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClose: () => void;
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function QuestPreviewSheet({
  quest,
  isSelected,
  onToggleSelect,
  onClose,
}: QuestPreviewSheetProps) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const isDesktop = useMediaQuery('(min-width: 640px)');

  useEffect(() => {
    if (!quest) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [quest, onClose]);

  const parsed = quest ? parseDescription(quest.description, quest.title) : null;
  const tasks =
    quest && quest.tasks && quest.tasks.length > 0
      ? quest.tasks
      : quest
        ? QUEST_FALLBACKS[quest.title]?.tasks ?? []
        : [];

  return (
    <AnimatePresence>
      {quest && parsed && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quest-preview-title"
        >
          <motion.button
            type="button"
            aria-label="Cerrar detalle de actividad"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          <motion.div
            initial={
              reduceMotion ? { opacity: 0 } : isDesktop ? { opacity: 0, y: 20, scale: 0.96 } : { y: '100%' }
            }
            animate={
              reduceMotion
                ? { opacity: 1 }
                : isDesktop
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { y: 0 }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : isDesktop
                  ? { opacity: 0, y: 12, scale: 0.96, transition: SHEET_EXIT_TRANSITION }
                  : { y: '100%', transition: SHEET_EXIT_TRANSITION }
            }
            transition={
              reduceMotion
                ? REDUCED_MOTION_TRANSITION
                : SHEET_ENTER_SPRING
            }
            drag={isDesktop ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.42 }}
            dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
            onDragEnd={(_, info) => {
              if (shouldDismissSheet(info.offset.y, info.velocity.y)) onClose();
            }}
            className="relative w-full max-w-lg max-h-[86dvh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border shadow-2xl"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div
              className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 cursor-grab touch-none rounded-full bg-[var(--border-control)]/50 active:cursor-grabbing sm:hidden"
              aria-hidden="true"
              onPointerDown={(event) => dragControls.start(event)}
            />
            {/* Header */}
            <header
              className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: 'var(--surface-inset)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--accent-text)',
                  }}
                >
                  {renderQuestIcon(quest.icon, 20)}
                </div>
                <div className="min-w-0">
                  <h2
                    id="quest-preview-title"
                    className="text-lg font-bold leading-snug"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {quest.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {quest.difficulty}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {quest.durationDays} días de desafío
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--surface-inset)',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </header>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
              {parsed.summary && (
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {parsed.summary}
                </p>
              )}

              {/* Daily Tasks */}
              <section className="space-y-2.5">
                <h3
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Tareas diarias ({tasks.length})
                </h3>
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border p-3.5 flex items-start gap-3"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <span
                        className="mt-0.5 h-7 w-7 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'var(--surface-card)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        {renderQuestIcon(task.icon, 14)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-semibold leading-snug"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p
                            className="text-xs mt-1 leading-relaxed"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {task.description}
                          </p>
                        )}
                        <div
                          className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-medium"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} />
                            {task.frequency === 'daily' ? 'Diaria' : task.frequency}
                          </span>
                          {task.targetValue && (
                            <span className="inline-flex items-center gap-1">
                              <Target size={12} />
                              {task.targetValue.toLocaleString('es-AR')} {task.targetUnit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Conditions / Key Rules */}
              {parsed.rules.length > 0 && (
                <section className="space-y-2">
                  <h3
                    className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ShieldCheck size={13} />
                    Condiciones y reglas clave
                  </h3>
                  <ul
                    className="rounded-2xl border p-3.5 space-y-2"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {parsed.rules.map((rule, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-xs leading-relaxed"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: 'var(--accent-fill)' }}
                        />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Milestones */}
              {parsed.milestones.length > 0 && (
                <section className="space-y-2">
                  <h3
                    className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Sparkles size={13} />
                    Mini-logros
                  </h3>
                  <ul
                    className="rounded-2xl border p-3.5 space-y-1.5"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {parsed.milestones.map((m, idx) => (
                      <li
                        key={idx}
                        className="text-xs leading-relaxed"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {m}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Footer Action */}
            <footer
              className="shrink-0 flex items-center gap-3 px-5 py-4 border-t pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
              style={{ borderColor: 'var(--divider)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="min-h-[46px] px-4 rounded-2xl text-sm font-semibold border transition-transform active:scale-95 cursor-pointer"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--surface-inset)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleSelect(quest.id);
                  onClose();
                }}
                className="flex-1 min-h-[46px] px-5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: isSelected
                    ? 'var(--surface-raised)'
                    : 'var(--accent-fill)',
                  color: isSelected ? 'var(--text-primary)' : 'var(--on-accent)',
                  border: isSelected ? '1px solid var(--border-control)' : 'none',
                }}
              >
                <Check size={17} strokeWidth={2.5} />
                {isSelected ? 'Quitar actividad' : 'Sumar actividad'}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

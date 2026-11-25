'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AiMealProposalItem,
  AiMealRecommendationResponse,
  healthService,
  MealRoutineItem,
  MealRoutineMode,
} from '@/lib/api/health';
import { useHealthStore } from '@/store/useHealthStore';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda / Snack',
  dinner: 'Cena',
};

const QUICK_CHIPS: Array<{
  label: string;
  scope: 'single_meal' | 'full_day' | 'weekly';
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
  prompt: string;
}> = [
  {
    label: 'Proteínas para la tarde',
    scope: 'single_meal',
    slot: 'snack',
    prompt: 'Dame opciones prácticas de meriendas o snacks altos en proteína para la tarde',
  },
  {
    label: 'Completar macros de hoy',
    scope: 'single_meal',
    slot: 'any',
    prompt: 'Sugerime comidas para cubrir las calorías y macros que me faltan hoy',
  },
  {
    label: 'Cena liviana',
    scope: 'single_meal',
    slot: 'dinner',
    prompt: 'Quiero ideas de cena liviana, baja en carbohidratos y alta en proteína',
  },
  {
    label: 'Armar día completo',
    scope: 'full_day',
    slot: 'any',
    prompt: 'Armame una rutina diaria completa ajustada a mis calorías y macros objetivo',
  },
  {
    label: 'Armar semana completa',
    scope: 'weekly',
    slot: 'any',
    prompt: 'Armame un plan semanal variado de lunes a domingo adaptado a mis metas nutricionales',
  },
];

interface MealRecommendationsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  consumedToday: {
    calories: number;
    proteinG: number;
    carbG: number;
    fatG: number;
  };
  goals: {
    dailyCalorieGoal: number;
    proteinGoalG: number;
    carbGoalG: number;
    fatGoalG: number;
  };
  onEditDraftInBuilder: (draft: {
    name: string;
    description: string;
    mode: MealRoutineMode;
    items: MealRoutineItem[];
  }) => void;
}

export default function MealRecommendationsSheet({
  isOpen,
  onClose,
  selectedDate,
  consumedToday,
  goals,
  onEditDraftInBuilder,
}: MealRecommendationsSheetProps) {
  const mealRoutines = useHealthStore((s) => s.mealRoutines);
  const logMealOptimistic = useHealthStore((s) => s.logMealOptimistic);
  const createMealRoutine = useHealthStore((s) => s.createMealRoutine);
  const updateMealRoutine = useHealthStore((s) => s.updateMealRoutine);

  const [scope, setScope] = useState<'single_meal' | 'full_day' | 'weekly'>('single_meal');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [proposal, setProposal] = useState<AiMealRecommendationResponse | null>(null);
  const [selectedDayTab, setSelectedDayTab] = useState<number>(0);

  const remaining = useMemo(
    () => ({
      calories: Math.max(0, Math.round(goals.dailyCalorieGoal - consumedToday.calories)),
      proteinG: Math.max(0, Math.round(goals.proteinGoalG - consumedToday.proteinG)),
    }),
    [goals, consumedToday]
  );

  const visibleItems = useMemo(() => {
    if (!proposal) return [];
    if (proposal.mode !== 'weekly') return proposal.items;
    return proposal.items.filter((it) => (it.dayOfWeek ?? 0) === selectedDayTab);
  }, [proposal, selectedDayTab]);

  if (!isOpen) return null;

  const sendPrompt = async (
    textToSend: string,
    overrideScope?: 'single_meal' | 'full_day' | 'weekly',
    targetSlot?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any'
  ) => {
    const clean = textToSend.trim();
    if (!clean || loading) return;

    const effectiveScope =
      overrideScope ??
      (proposal?.mode === 'weekly'
        ? 'weekly'
        : proposal?.mode === 'daily'
          ? 'full_day'
          : scope);

    setLoading(true);
    try {
      const res = await healthService.getAiMealRecommendations({
        textInput: clean,
        scope: effectiveScope,
        targetSlot: targetSlot ?? 'any',
        history,
        currentDraft: proposal
          ? {
              routineName: proposal.routineName,
              routineDescription: proposal.routineDescription,
              mode: proposal.mode,
              items: proposal.items,
            }
          : null,
        consumedToday,
      });

      setHistory((prev) => [
        ...prev,
        { role: 'user', text: clean },
        { role: 'assistant', text: res.assistantMessage },
      ]);
      setProposal(res);
      setPrompt('');
      if (res.mode === 'weekly') {
        setSelectedDayTab(0);
      }
    } catch {
      toast.error('No pudimos generar recomendaciones. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogSingleMeal = async (item: AiMealProposalItem) => {
    try {
      await logMealOptimistic({
        date: selectedDate,
        mealType: item.mealType,
        name: item.name,
        calories: Math.max(1, Math.round(item.calories)),
        proteinG: Math.round(item.proteinG * 10) / 10,
        carbG: Math.round(item.carbG * 10) / 10,
        fatG: Math.round(item.fatG * 10) / 10,
      });
      toast.success(`"${item.name}" registrada hoy`);
    } catch {
      toast.error('No se pudo registrar la comida');
    }
  };

  const handleAddSingleToActiveRoutine = async (item: AiMealProposalItem) => {
    const active = mealRoutines.find((r) => r.isActive) ?? mealRoutines[0];
    const newItem: MealRoutineItem = {
      dayOfWeek: active?.mode === 'weekly' ? 0 : null,
      mealType: item.mealType,
      name: item.name,
      calories: Math.round(item.calories),
      proteinG: Math.round(item.proteinG * 10) / 10,
      carbG: Math.round(item.carbG * 10) / 10,
      fatG: Math.round(item.fatG * 10) / 10,
      prepTimeMin: item.prepTimeMin,
      notes: item.reason,
    };

    try {
      if (!active) {
        await createMealRoutine({
          name: 'Mi Rutina',
          mode: 'daily',
          isActive: true,
          items: [newItem],
        });
        toast.success('Rutina creada con esta comida');
      } else {
        await updateMealRoutine(active.id, {
          items: [...active.items, { ...newItem, order: active.items.length }],
        });
        toast.success(`Sumada a "${active.name}"`);
      }
    } catch {
      toast.error('No se pudo sumar a la rutina');
    }
  };

  const handleSaveProposalAsRoutine = async () => {
    if (!proposal) return;
    setSavingRoutine(true);
    try {
      const mode: MealRoutineMode = proposal.mode === 'weekly' ? 'weekly' : 'daily';
      await createMealRoutine({
        name: proposal.routineName,
        description: proposal.routineDescription,
        mode,
        isActive: true,
        items: proposal.items.map((it, idx) => ({
          dayOfWeek: mode === 'daily' ? null : (it.dayOfWeek ?? 0),
          mealType: it.mealType,
          name: it.name,
          calories: Math.round(it.calories),
          proteinG: Math.round(it.proteinG * 10) / 10,
          carbG: Math.round(it.carbG * 10) / 10,
          fatG: Math.round(it.fatG * 10) / 10,
          prepTimeMin: it.prepTimeMin,
          notes: it.reason,
          order: idx,
        })),
      });
      toast.success(`Rutina "${proposal.routineName}" guardada y activada`);
      onClose();
    } catch {
      toast.error('No se pudo guardar la rutina');
    } finally {
      setSavingRoutine(false);
    }
  };

  const handleOpenInBuilder = () => {
    if (!proposal) return;
    const mode: MealRoutineMode = proposal.mode === 'weekly' ? 'weekly' : 'daily';
    onClose();
    onEditDraftInBuilder({
      name: proposal.routineName,
      description: proposal.routineDescription,
      mode,
      items: proposal.items.map((it, idx) => ({
        dayOfWeek: mode === 'daily' ? null : (it.dayOfWeek ?? 0),
        mealType: it.mealType,
        name: it.name,
        calories: Math.round(it.calories),
        proteinG: Math.round(it.proteinG * 10) / 10,
        carbG: Math.round(it.carbG * 10) / 10,
        fatG: Math.round(it.fatG * 10) / 10,
        prepTimeMin: it.prepTimeMin,
        notes: it.reason,
        order: idx,
      })),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Asistente IA de comidas"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] sm:rounded-[24px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--divider)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-fill)]/15 text-[var(--accent-text)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
                Asistente de Comidas IA
              </h2>
              <p className="text-[12px] text-[var(--text-muted)] tabular-nums">
                Te faltan hoy: {remaining.calories} kcal · {remaining.proteinG}g proteína
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-secondary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Scope Selector */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--surface-inset)] p-1">
            {[
              { id: 'single_meal', label: 'Comida puntual' },
              { id: 'full_day', label: 'Día completo' },
              { id: 'weekly', label: 'Semana (7 días)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScope(tab.id as typeof scope)}
                className={`min-h-8 cursor-pointer rounded-lg text-xs font-semibold transition-colors ${
                  scope === tab.id
                    ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Chips */}
          {!proposal ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                Objetivos rápidos
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setScope(chip.scope);
                      void sendPrompt(chip.prompt, chip.scope, chip.slot);
                    }}
                    className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-fill)] disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Loading Indicator */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 py-10 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-text)]" />
              Armando propuesta personalizada...
            </div>
          ) : null}

          {/* AI Proposal Display */}
          {proposal && !loading ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3.5">
                <p className="text-xs font-semibold text-[var(--accent-text)]">
                  {proposal.routineName}
                </p>
                <p className="mt-1 text-sm text-[var(--text-primary)]">
                  {proposal.assistantMessage}
                </p>
              </div>

              {/* Weekly Day Tabs */}
              {proposal.mode === 'weekly' ? (
                <div className="flex flex-wrap gap-1">
                  {DAY_LABELS.map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSelectedDayTab(idx)}
                      className={`min-h-8 cursor-pointer rounded-xl px-2.5 text-xs font-semibold ${
                        selectedDayTab === idx
                          ? 'bg-[var(--accent-fill)] text-[var(--on-accent)]'
                          : 'bg-[var(--surface-inset)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Proposed Meals */}
              <div className="space-y-2">
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]/50 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-text)]">
                          {SLOT_LABELS[item.mealType] ?? item.mealType}
                        </span>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                          {item.name}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] tabular-nums">
                          {Math.round(item.calories)} kcal · P {Math.round(item.proteinG)}g · C{' '}
                          {Math.round(item.carbG)}g · G {Math.round(item.fatG)}g ·{' '}
                          {item.prepTimeMin} min
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{item.reason}</p>

                    {proposal.mode === 'single_meal' ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => void handleLogSingleMeal(item)}
                          className="flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--accent-fill)] px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Registrar hoy
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAddSingleToActiveRoutine(item)}
                          className="flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Sumar a mi rutina
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Save / Edit Routine Actions for Day or Week */}
              {proposal.mode !== 'single_meal' ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingRoutine}
                    onClick={() => void handleSaveProposalAsRoutine()}
                    className="flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-4 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-50"
                  >
                    <CalendarDays className="h-4 w-4" />
                    {savingRoutine ? 'Guardando...' : 'Guardar como rutina activa'}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInBuilder}
                    className="flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <Utensils className="h-4 w-4" />
                    Editar antes de guardar
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Conversational Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendPrompt(prompt);
          }}
          className="border-t border-[var(--divider)] bg-[var(--surface-card)] p-4"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                proposal
                  ? 'Pedile cambios a la IA (ej: cambiame la merienda del martes por algo sin lácteos)...'
                  : 'Describí tu objetivo (ej: snacks con 25g de proteína para la tarde)...'
              }
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              aria-label="Enviar a IA"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[var(--accent-fill)] text-[var(--on-accent)] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

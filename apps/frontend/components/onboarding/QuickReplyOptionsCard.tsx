'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import type { AiClarificationQuestion, QuickReplySelectionMode } from '@/lib/api/ai';

const OTHER_MIN_HEIGHT_PX = 44;
const OTHER_MAX_HEIGHT_PX = 160;

const CONFIRMATION_QUICK_REPLY_RE =
  /^(?:(?:s[ií]|dale|ok|perfecto|listo|genial|bueno)[,\s]+)?(?:confirmar(?:\s+(?:la\s+|el\s+)?(?:creaci[oó]n|plan|misi[oó]n(?:\s+secundaria)?|propuesta|todo|cambios))?(?:\s+y\s+(?:guardar|crear|empezar|comenzar|aplicar))?|confirmo(?:\s+(?:el\s+plan|la\s+misi[oó]n|todo))?|confirmalo|(?:guardar|crear)(?:\s+(?:el\s+|la\s+)?(?:plan|misi[oó]n(?:\s+secundaria)?))?(?:\s+y\s+(?:empezar|comenzar))?|aceptar\s+y\s+guardar)[.!]*$/i;

/** Returns true when a single quick-reply selection represents an explicit save/confirm action. */
export function isConfirmationQuickReply(text: string): boolean {
  const normalized = text.trim();
  if (!normalized || normalized.includes('·')) return false;
  return CONFIRMATION_QUICK_REPLY_RE.test(normalized);
}

interface QuickReplyOptionsCardProps {
  options?: string[];
  mode?: QuickReplySelectionMode;
  openQuestions?: string[];
  clarificationQuestions?: AiClarificationQuestion[];
  disabled?: boolean;
  onSendSelected: (combinedText: string) => void;
  onInsertIntoComposer: (combinedText: string) => void;
}

interface StepAnswerState {
  selectedIndices: number[];
  otherSelected: boolean;
  otherText: string;
}

const EMPTY_STEP_ANSWER: StepAnswerState = {
  selectedIndices: [],
  otherSelected: false,
  otherText: '',
};

export default function QuickReplyOptionsCard({
  options = [],
  mode = 'single',
  openQuestions = [],
  clarificationQuestions = [],
  disabled = false,
  onSendSelected,
  onInsertIntoComposer,
}: QuickReplyOptionsCardProps) {
  const steps = useMemo<AiClarificationQuestion[]>(() => {
    if (clarificationQuestions && clarificationQuestions.length > 0) {
      return clarificationQuestions.map((item, idx) => ({
        question: item.question?.trim() ?? '',
        options:
          item.options && item.options.length > 0
            ? item.options
            : idx === 0
              ? options
              : [],
        selectionMode: item.selectionMode ?? mode,
      }));
    }

    if (openQuestions && openQuestions.length > 0) {
      return openQuestions.map((question, idx) => ({
        question: question.trim(),
        options: idx === 0 ? options : [],
        selectionMode: mode,
      }));
    }

    if (options && options.length > 0) {
      return [
        {
          question: '',
          options,
          selectionMode: mode,
        },
      ];
    }

    return [];
  }, [clarificationQuestions, mode, openQuestions, options]);

  const cardKey = useMemo(
    () =>
      steps
        .map(
          (step) =>
            `${step.question}::${step.selectionMode ?? 'single'}::${(step.options ?? []).join('|')}`
        )
        .join('\u0000'),
    [steps]
  );

  const [cardState, setCardState] = useState<{
    key: string;
    activeIndex: number;
    answers: Record<number, StepAnswerState>;
  }>({
    key: cardKey,
    activeIndex: 0,
    answers: {},
  });

  const otherInputRef = useRef<HTMLTextAreaElement | null>(null);

  const totalSteps = steps.length;
  const activeIndex =
    totalSteps > 0 && cardState.key === cardKey
      ? Math.min(Math.max(0, cardState.activeIndex), totalSteps - 1)
      : 0;
  const answersMap = cardState.key === cardKey ? cardState.answers : {};
  const currentAnswer: StepAnswerState = answersMap[activeIndex] ?? EMPTY_STEP_ANSWER;

  const syncOtherInputHeight = useCallback(() => {
    const el = otherInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(
      OTHER_MAX_HEIGHT_PX,
      Math.max(OTHER_MIN_HEIGHT_PX, el.scrollHeight)
    );
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > OTHER_MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    if (currentAnswer.otherSelected) {
      syncOtherInputHeight();
    }
  }, [activeIndex, currentAnswer.otherSelected, currentAnswer.otherText, syncOtherInputHeight]);

  useEffect(() => {
    if (!currentAnswer.otherSelected) return;
    window.addEventListener('resize', syncOtherInputHeight);
    return () => window.removeEventListener('resize', syncOtherInputHeight);
  }, [currentAnswer.otherSelected, syncOtherInputHeight]);

  if (steps.length === 0) return null;

  const currentStep = steps[activeIndex] ?? steps[0];
  const currentOptions = currentStep.options ?? [];
  const currentMode = currentStep.selectionMode ?? mode;
  // Allow multiple selection when mode is 'multiple' (including combining suggested options + "Otra")
  const isMultiple = currentMode === 'multiple';

  const updateCurrentStepAnswer = (updater: (prev: StepAnswerState) => StepAnswerState) => {
    setCardState((prev) => {
      const baseAnswers = prev.key === cardKey ? prev.answers : {};
      const baseIndex = prev.key === cardKey ? prev.activeIndex : 0;
      const current = baseAnswers[activeIndex] ?? EMPTY_STEP_ANSWER;
      return {
        key: cardKey,
        activeIndex: baseIndex,
        answers: {
          ...baseAnswers,
          [activeIndex]: updater(current),
        },
      };
    });
  };

  const goToStep = (nextIndex: number) => {
    if (disabled) return;
    const clamped = Math.min(Math.max(0, nextIndex), totalSteps - 1);
    setCardState((prev) => ({
      key: cardKey,
      activeIndex: clamped,
      answers: prev.key === cardKey ? prev.answers : {},
    }));
  };

  const toggleOption = (idx: number) => {
    if (disabled) return;
    updateCurrentStepAnswer((prev) => {
      if (isMultiple) {
        const nextIndices = prev.selectedIndices.includes(idx)
          ? prev.selectedIndices.filter((i) => i !== idx)
          : [...prev.selectedIndices, idx];
        return {
          ...prev,
          selectedIndices: nextIndices,
        };
      }

      const alreadySelected = prev.selectedIndices[0] === idx && !prev.otherSelected;
      return {
        ...prev,
        selectedIndices: alreadySelected ? [] : [idx],
        otherSelected: false,
      };
    });
  };

  const toggleOther = () => {
    if (disabled) return;
    const willSelect = !currentAnswer.otherSelected;
    updateCurrentStepAnswer((prev) => {
      if (isMultiple) {
        return {
          ...prev,
          otherSelected: !prev.otherSelected,
        };
      }

      return {
        ...prev,
        selectedIndices: [],
        otherSelected: !prev.otherSelected,
      };
    });

    if (willSelect) {
      requestAnimationFrame(() => {
        otherInputRef.current?.focus();
      });
    }
  };

  const handleOtherTextChange = (value: string) => {
    if (disabled) return;
    updateCurrentStepAnswer((prev) => ({
      ...prev,
      otherSelected: true,
      otherText: value,
    }));
  };

  const getStepParts = (stepIndex: number): string[] => {
    const step = steps[stepIndex];
    const ans = answersMap[stepIndex];
    if (!step || !ans) return [];

    const ordered = [...ans.selectedIndices].sort((a, b) => a - b);
    const chosenOptions = ordered
      .map((i) => step.options?.[i]?.trim())
      .filter((val): val is string => Boolean(val));

    if (ans.otherSelected && ans.otherText.trim().length > 0) {
      chosenOptions.push(ans.otherText.trim());
    }

    return chosenOptions;
  };

  const answeredSteps = steps
    .map((_, idx) => ({
      index: idx,
      parts: getStepParts(idx),
    }))
    .filter((entry) => entry.parts.length > 0);

  const totalSelectedItemsCount = answeredSteps.reduce(
    (acc, entry) => acc + entry.parts.length,
    0
  );

  const hasAnySelection = totalSelectedItemsCount > 0;

  const buildCombinedReply = (): string => {
    return answeredSteps.map((entry) => entry.parts.join(' · ')).join(' · ');
  };

  const clearSelection = () => {
    setCardState({
      key: cardKey,
      activeIndex: 0,
      answers: {},
    });
  };

  const badgeCount =
    totalSteps > 1
      ? answeredSteps.length > 1
        ? answeredSteps.length
        : totalSelectedItemsCount > 1 && isMultiple
          ? totalSelectedItemsCount
          : 0
      : isMultiple && totalSelectedItemsCount > 1
        ? totalSelectedItemsCount
        : 0;

  return (
    <div
      role="group"
      aria-label={
        isMultiple
          ? 'Opciones rápidas de selección múltiple'
          : 'Opciones rápidas de selección única'
      }
      className="mt-2 w-full max-w-[96%] rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Antigravity-style single-box stepper header */}
      <div
        className="px-3 py-1.5 border-b flex items-center justify-between gap-1.5"
        style={{
          backgroundColor: 'var(--surface-inset)',
          borderColor: 'var(--divider)',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-xs font-bold tracking-tight tabular-nums shrink-0"
            style={{ color: 'var(--accent-text)' }}
          >
            {totalSteps > 1
              ? `Pregunta ${activeIndex + 1} de ${totalSteps}`
              : 'Pregunta 1'}
          </span>

          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold border truncate"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            {isMultiple ? 'Selección múltiple' : 'Selección única'}
          </span>
        </div>

        {totalSteps > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              aria-label="Pregunta anterior"
              disabled={disabled || activeIndex === 0}
              onClick={() => goToStep(activeIndex - 1)}
              className="size-9 rounded-lg border inline-flex items-center justify-center cursor-pointer active:scale-95 transition-transform duration-150 ease-out disabled:opacity-35 disabled:cursor-default"
              style={{
                touchAction: 'manipulation',
                backgroundColor: 'var(--surface-card)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronLeft className="size-4" />
            </button>

            <button
              type="button"
              aria-label="Siguiente pregunta"
              disabled={disabled || activeIndex >= totalSteps - 1}
              onClick={() => goToStep(activeIndex + 1)}
              className="size-9 rounded-lg border inline-flex items-center justify-center cursor-pointer active:scale-95 transition-transform duration-150 ease-out disabled:opacity-35 disabled:cursor-default"
              style={{
                touchAction: 'manipulation',
                backgroundColor: 'var(--surface-card)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Active Question Title inside the same compact box */}
      {currentStep.question && (
        <div
          className="px-3 py-2 border-b text-xs font-semibold leading-snug"
          style={{
            borderColor: 'var(--divider)',
            color: 'var(--text-primary)',
            backgroundColor: 'color-mix(in srgb, var(--surface-inset) 45%, var(--surface-card))',
          }}
        >
          {currentStep.question}
        </div>
      )}

      {/* Inset Grouped List of Options + "Otra" (zero nested card borders) */}
      <ul className="divide-y" style={{ borderColor: 'var(--divider)' }}>
        {currentOptions.map((option, idx) => {
          const isSelected = currentAnswer.selectedIndices.includes(idx);

          return (
            <li key={`${activeIndex}-${idx}-${option}`} style={{ borderColor: 'var(--divider)' }}>
              <button
                type="button"
                role={isMultiple ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => toggleOption(idx)}
                className="w-full min-h-[44px] px-3 py-2 text-left flex items-center gap-2.5 cursor-pointer transition-colors duration-150 ease-out active:scale-[0.99] disabled:opacity-50"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: isSelected
                    ? 'color-mix(in srgb, var(--accent-fill) 11%, var(--surface-card))'
                    : 'transparent',
                }}
              >
                {isMultiple ? (
                  <span
                    aria-checked={isSelected}
                    className="t-check size-4.5 rounded-[5px] border flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent-fill)' : 'transparent',
                      borderColor: isSelected ? 'var(--accent-fill)' : 'var(--border-control)',
                      color: 'var(--on-accent)',
                    }}
                  >
                    <svg
                      viewBox="0 0 10.1668 10.1668"
                      className="size-2.5 fill-none stroke-current"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 5.52L3.92 9.17L9.17 1" />
                    </svg>
                  </span>
                ) : (
                  <span
                    className="size-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-150 ease-out"
                    style={{
                      borderColor: isSelected ? 'var(--accent-fill)' : 'var(--border-control)',
                      backgroundColor: isSelected
                        ? 'color-mix(in srgb, var(--accent-fill) 16%, transparent)'
                        : 'transparent',
                    }}
                  >
                    {isSelected && (
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: 'var(--accent-fill)' }}
                      />
                    )}
                  </span>
                )}

                <span
                  className="text-xs leading-snug font-medium flex-1"
                  style={{
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {option}
                </span>
              </button>
            </li>
          );
        })}

        {/* Antigravity "Otra" option with inline input expansion */}
        <li key={`${activeIndex}-otra`} style={{ borderColor: 'var(--divider)' }}>
          <button
            type="button"
            role={isMultiple ? 'checkbox' : 'radio'}
            aria-checked={currentAnswer.otherSelected}
            disabled={disabled}
            onClick={toggleOther}
            className="w-full min-h-[44px] px-3 py-2 text-left flex items-center gap-2.5 cursor-pointer transition-colors duration-150 ease-out active:scale-[0.99] disabled:opacity-50"
            style={{
              touchAction: 'manipulation',
              backgroundColor: currentAnswer.otherSelected
                ? 'color-mix(in srgb, var(--accent-fill) 11%, var(--surface-card))'
                : 'transparent',
            }}
          >
            {isMultiple ? (
              <span
                aria-checked={currentAnswer.otherSelected}
                className="t-check size-4.5 rounded-[5px] border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: currentAnswer.otherSelected ? 'var(--accent-fill)' : 'transparent',
                  borderColor: currentAnswer.otherSelected
                    ? 'var(--accent-fill)'
                    : 'var(--border-control)',
                  color: 'var(--on-accent)',
                }}
              >
                <svg
                  viewBox="0 0 10.1668 10.1668"
                  className="size-2.5 fill-none stroke-current"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 5.52L3.92 9.17L9.17 1" />
                </svg>
              </span>
            ) : (
              <span
                className="size-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-150 ease-out"
                style={{
                  borderColor: currentAnswer.otherSelected
                    ? 'var(--accent-fill)'
                    : 'var(--border-control)',
                  backgroundColor: currentAnswer.otherSelected
                    ? 'color-mix(in srgb, var(--accent-fill) 16%, transparent)'
                    : 'transparent',
                }}
              >
                {currentAnswer.otherSelected && (
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: 'var(--accent-fill)' }}
                  />
                )}
              </span>
            )}

            <span
              className="text-xs leading-snug font-medium flex-1"
              style={{
                color: currentAnswer.otherSelected
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
              }}
            >
              Otra
            </span>
          </button>

          {currentAnswer.otherSelected && (
            <div className="px-3 pb-2.5 pt-0.5">
              <textarea
                ref={otherInputRef}
                rows={1}
                disabled={disabled}
                value={currentAnswer.otherText}
                onChange={(e) => handleOtherTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    if (activeIndex < totalSteps - 1) {
                      goToStep(activeIndex + 1);
                    } else {
                      const text = buildCombinedReply();
                      if (text) {
                        onSendSelected(text);
                        clearSelection();
                      }
                    }
                  }
                }}
                placeholder="Escribí tu respuesta..."
                aria-label="Escribir otra respuesta"
                className="w-full min-h-[44px] max-h-[160px] px-3 py-2.5 rounded-xl border text-base sm:text-xs leading-snug resize-none outline-none overscroll-contain transition-colors"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--surface-inset)',
                  borderColor: 'var(--border-control)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}
        </li>
      </ul>

      {/* Contextual Action Bar */}
      {(hasAnySelection || totalSteps > 1) && (
        <div
          className="px-2.5 py-2 border-t flex items-center justify-between gap-2"
          style={{
            backgroundColor: 'var(--surface-inset)',
            borderColor: 'var(--divider)',
          }}
        >
          {totalSteps > 1 ? (
            <button
              type="button"
              disabled={disabled || activeIndex >= totalSteps - 1}
              onClick={() => goToStep(activeIndex + 1)}
              className="min-h-[44px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-transform duration-150 ease-out disabled:opacity-35 disabled:cursor-default"
              style={{
                touchAction: 'manipulation',
                backgroundColor: 'var(--surface-card)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <span>{getStepParts(activeIndex).length > 0 ? 'Siguiente' : 'Saltar'}</span>
              <ChevronRight className="size-3.5" />
            </button>
          ) : (
            <span />
          )}

          {hasAnySelection && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const text = buildCombinedReply();
                  if (text) {
                    onInsertIntoComposer(text);
                    clearSelection();
                  }
                }}
                className="min-h-[44px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--surface-card)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Pencil className="size-3" />
                <span>Editar antes</span>
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const text = buildCombinedReply();
                  if (text) {
                    onSendSelected(text);
                    clearSelection();
                  }
                }}
                className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--accent-fill)',
                  color: 'var(--on-accent)',
                }}
              >
                <span>
                  {badgeCount > 1 ? `Responder (${badgeCount})` : 'Responder'}
                </span>
                <ArrowUp className="size-3.5 stroke-[2.3]" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { ArrowUp, Pencil } from 'lucide-react';
import type { QuickReplySelectionMode } from '@/lib/api/ai';

interface QuickReplyOptionsCardProps {
  options: string[];
  mode?: QuickReplySelectionMode;
  disabled?: boolean;
  onSendSelected: (combinedText: string) => void;
  onInsertIntoComposer: (combinedText: string) => void;
}

export default function QuickReplyOptionsCard({
  options,
  mode = 'single',
  disabled = false,
  onSendSelected,
  onInsertIntoComposer,
}: QuickReplyOptionsCardProps) {
  const optionsKey = (options ?? []).join('\u0000');
  const [selection, setSelection] = useState<{ key: string; indices: number[] }>({
    key: optionsKey,
    indices: [],
  });

  if (!options || options.length === 0) return null;

  const selectedIndices = selection.key === optionsKey ? selection.indices : [];
  const isMultiple = mode === 'multiple' && options.length > 1;

  const toggleOption = (idx: number) => {
    if (disabled) return;
    setSelection((prev) => {
      const current = prev.key === optionsKey ? prev.indices : [];
      const nextIndices = isMultiple
        ? current.includes(idx)
          ? current.filter((i) => i !== idx)
          : [...current, idx]
        : current[0] === idx
          ? []
          : [idx];
      return { key: optionsKey, indices: nextIndices };
    });
  };

  const buildCombinedReply = () => {
    const ordered = [...selectedIndices].sort((a, b) => a - b);
    return ordered
      .map((i) => options[i]?.trim())
      .filter(Boolean)
      .join(' · ');
  };

  const clearSelection = () => {
    setSelection({ key: optionsKey, indices: [] });
  };

  const hasSelection = selectedIndices.length > 0;

  return (
    <div
      role="group"
      aria-label={isMultiple ? 'Opciones rápidas de selección múltiple' : 'Opciones rápidas de selección única'}
      className="mt-2 w-full max-w-[94%] rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Antigravity-style compact mode header */}
      <div
        className="px-3 py-1.5 border-b flex items-center justify-between gap-2"
        style={{
          backgroundColor: 'var(--surface-inset)',
          borderColor: 'var(--divider)',
        }}
      >
        <span
          className="text-[11px] font-semibold tracking-tight"
          style={{ color: 'var(--text-secondary)' }}
        >
          Respuestas sugeridas
        </span>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border"
          style={{
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--accent-text)',
          }}
        >
          {isMultiple ? 'Selección múltiple' : 'Selección única'}
        </span>
      </div>

      {/* Inset Grouped List of Options (zero nested card borders) */}
      <ul className="divide-y" style={{ borderColor: 'var(--divider)' }}>
        {options.map((option, idx) => {
          const isSelected = selectedIndices.includes(idx);

          return (
            <li key={`${idx}-${option}`} style={{ borderColor: 'var(--divider)' }}>
              <button
                type="button"
                role={isMultiple ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => toggleOption(idx)}
                className="w-full min-h-[44px] px-3 py-2.5 text-left flex items-start gap-2.5 cursor-pointer transition-colors duration-150 ease-out active:scale-[0.99] disabled:opacity-50"
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
                    className="t-check mt-0.5 size-4.5 rounded-[5px] border flex items-center justify-center shrink-0"
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
                    className="mt-0.5 size-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-150 ease-out"
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
      </ul>

      {/* Contextual Action Bar once >= 1 option is picked (no forced keyboard popup) */}
      {hasSelection && (
        <div
          className="px-2.5 py-2 border-t flex items-center justify-end gap-2"
          style={{
            backgroundColor: 'var(--surface-inset)',
            borderColor: 'var(--divider)',
          }}
        >
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
            className="min-h-[36px] px-2.5 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
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
            className="min-h-[36px] px-3 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
            style={{
              touchAction: 'manipulation',
              backgroundColor: 'var(--accent-fill)',
              color: 'var(--on-accent)',
            }}
          >
            <span>
              {isMultiple && selectedIndices.length > 1
                ? `Responder (${selectedIndices.length})`
                : 'Responder'}
            </span>
            <ArrowUp className="size-3.5 stroke-[2.3]" />
          </button>
        </div>
      )}
    </div>
  );
}

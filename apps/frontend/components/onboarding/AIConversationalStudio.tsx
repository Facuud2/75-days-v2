'use client';

import { forwardRef, type ComponentType, type ReactNode } from 'react';
import { MessageSquare, Mic, Sparkles } from 'lucide-react';

const USER_BUBBLE_STYLE = {
  backgroundColor: 'color-mix(in srgb, var(--accent-fill) 16%, var(--surface-raised))',
  borderColor: 'color-mix(in srgb, var(--accent-fill) 38%, var(--border-subtle))',
  color: 'var(--text-primary)',
};

const ASSISTANT_BUBBLE_STYLE = {
  backgroundColor: 'var(--surface-inset)',
  borderColor: 'var(--border-subtle)',
  color: 'var(--text-primary)',
};

type ChangeType = 'kept' | 'modified' | 'added';

export type AIStudioView = 'chat' | 'draft';

export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError') ||
    (error instanceof Error &&
      (error.name === 'AbortError' || error.message === 'AbortError'))
  );
}

type StudioTabIcon = ComponentType<{ className?: string }>;

type AIStudioTabsProps = {
  ariaLabel: string;
  activeTab: AIStudioView;
  draftIcon: StudioTabIcon;
  draftLabel: ReactNode;
  hasUnreadDraftChanges?: boolean;
  onChatSelect: () => void;
  onDraftSelect: () => void;
};

export function AIStudioTabs({
  ariaLabel,
  activeTab,
  draftIcon,
  draftLabel,
  hasUnreadDraftChanges = false,
  onChatSelect,
  onDraftSelect,
}: AIStudioTabsProps) {
  const DraftIcon = draftIcon;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1 p-1 rounded-xl border"
      style={{
        backgroundColor: 'var(--surface-inset)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'chat'}
        onClick={onChatSelect}
        className="min-h-[34px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-150 ease-out"
        style={{
          touchAction: 'manipulation',
          backgroundColor: activeTab === 'chat' ? 'var(--surface-card)' : 'transparent',
          color: activeTab === 'chat' ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
      >
        <MessageSquare className="size-3.5" />
        <span>Conversación</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'draft'}
        onClick={onDraftSelect}
        className="min-h-[34px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-150 ease-out"
        style={{
          touchAction: 'manipulation',
          backgroundColor: activeTab === 'draft' ? 'var(--surface-card)' : 'transparent',
          color: activeTab === 'draft' ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
      >
        <DraftIcon className="size-3.5" />
        <span>{draftLabel}</span>
        {hasUnreadDraftChanges && activeTab !== 'draft' && (
          <span className="size-2 rounded-full" style={{ backgroundColor: 'var(--accent-fill)' }} />
        )}
      </button>
    </div>
  );
}

type AIConversationStreamItemProps = {
  role: 'user' | 'assistant';
  text: string;
  viaVoice?: boolean;
  openQuestions?: string[];
  children?: ReactNode;
};

export const AIConversationStreamItem = forwardRef<
  HTMLDivElement,
  AIConversationStreamItemProps
>(function AIConversationStreamItem(
  { role, text, viaVoice = false, openQuestions = [], children },
  ref
) {
  const isUser = role === 'user';

  return (
    <div ref={ref} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed border ${
          isUser ? 'rounded-br-md' : 'rounded-bl-md'
        }`}
        style={isUser ? USER_BUBBLE_STYLE : ASSISTANT_BUBBLE_STYLE}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="size-3" style={{ color: 'var(--accent-text)' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Asistente IA
            </span>
          </div>
        )}

        <p className="whitespace-pre-line break-words">{text}</p>

        {isUser && viaVoice && (
          <span
            className="mt-1 inline-flex items-center gap-1 text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <Mic className="size-3" />
            Audio enviado
          </span>
        )}

        {!isUser && openQuestions.length > 0 && (
          <ol
            className="mt-2.5 pt-2.5 border-t flex flex-col gap-2 text-xs"
            style={{ borderColor: 'var(--divider)', color: 'var(--text-secondary)' }}
          >
            {openQuestions.map((question, questionIndex) => (
              <li key={questionIndex} className="flex items-start gap-2">
                <span
                  className="size-4.5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums"
                  style={{
                    backgroundColor: 'var(--surface-raised)',
                    color: 'var(--accent-text)',
                  }}
                >
                  {questionIndex + 1}
                </span>
                <span className="leading-snug">{question}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {children}
    </div>
  );
});

const CHANGE_BADGES: Partial<Record<ChangeType, { label: string; color: string }>> = {
  added: { label: 'Nueva', color: 'var(--status-success)' },
  modified: { label: 'Editada', color: 'var(--status-info)' },
};

type DraftChangeBadgeProps = {
  changeType?: ChangeType;
};

export function DraftChangeBadge({ changeType }: DraftChangeBadgeProps) {
  const badge = changeType ? CHANGE_BADGES[changeType] : undefined;
  if (!badge) return null;

  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{
        backgroundColor: `color-mix(in srgb, ${badge.color} 16%, transparent)`,
        color: badge.color,
      }}
    >
      {badge.label}
    </span>
  );
}

type DraftSelectionIndicatorProps = {
  checked: boolean;
};

export function DraftSelectionIndicator({ checked }: DraftSelectionIndicatorProps) {
  return (
    <span
      className="t-check mt-0.5 size-5 rounded-md border flex items-center justify-center shrink-0"
      aria-checked={checked}
      style={{
        backgroundColor: checked ? 'var(--accent-fill)' : 'transparent',
        borderColor: checked ? 'var(--accent-fill)' : 'var(--border-control)',
        color: 'var(--on-accent)',
      }}
    >
      <svg
        viewBox="0 0 10.1668 10.1668"
        className="size-3 fill-none stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 5.52L3.92 9.17L9.17 1" />
      </svg>
    </span>
  );
}

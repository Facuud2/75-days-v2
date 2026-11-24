'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowUp, Mic } from 'lucide-react';
import type { VoiceAudioMetrics, VoiceRecorderStatus } from '@/hooks/useVoiceRecorder';
import VoiceSessionOverlay from './VoiceSessionOverlay';

interface AutoGrowComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmitText: () => void;
  placeholder: string;
  disabled?: boolean;
  micBlocked?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  voiceStatus: VoiceRecorderStatus;
  isSpeaking: boolean;
  elapsedSeconds: number;
  subscribeAudioMetrics: (listener: (metrics: VoiceAudioMetrics) => void) => () => void;
  onStartVoice: () => void;
  onCancelVoice: () => void;
  onPauseVoice: () => void;
  onResumeVoice: () => void;
  onStopAndTranscribeVoice: () => void;
  onSendVoiceDirect: () => void;
}

const MIN_HEIGHT_PX = 44;
const MAX_HEIGHT_PX = 136; // ~5 lines on mobile before inner scroll kicks in

export default function AutoGrowComposer({
  value,
  onChange,
  onSubmitText,
  placeholder,
  disabled = false,
  micBlocked = false,
  textareaRef: externalRef,
  voiceStatus,
  isSpeaking,
  elapsedSeconds,
  subscribeAudioMetrics,
  onStartVoice,
  onCancelVoice,
  onPauseVoice,
  onResumeVoice,
  onStopAndTranscribeVoice,
  onSendVoiceDirect,
}: AutoGrowComposerProps) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  const setTextareaNode = useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (externalRef) {
        externalRef.current = node;
      }
    },
    [externalRef]
  );

  const isVoiceModeActive =
    voiceStatus === 'requesting-permission' ||
    voiceStatus === 'recording' ||
    voiceStatus === 'paused' ||
    voiceStatus === 'stopping' ||
    voiceStatus === 'transcribing' ||
    voiceStatus === 'processing';

  const syncHeight = useCallback(() => {
    const el = internalRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(MAX_HEIGHT_PX, Math.max(MIN_HEIGHT_PX, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    if (!isVoiceModeActive) {
      syncHeight();
    }
  }, [value, isVoiceModeActive, syncHeight]);

  useEffect(() => {
    window.addEventListener('resize', syncHeight);
    return () => window.removeEventListener('resize', syncHeight);
  }, [syncHeight]);

  if (isVoiceModeActive) {
    return (
      <VoiceSessionOverlay
        status={voiceStatus}
        isSpeaking={isSpeaking}
        elapsedSeconds={elapsedSeconds}
        subscribeAudioMetrics={subscribeAudioMetrics}
        onCancel={onCancelVoice}
        onPause={onPauseVoice}
        onResume={onResumeVoice}
        onStopAndTranscribe={onStopAndTranscribeVoice}
        onSendDirect={onSendVoiceDirect}
      />
    );
  }

  const hasText = value.trim().length > 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasText || disabled) return;
    onSubmitText();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On desktop pointer devices, Enter submits and Shift+Enter adds a newline.
    // On coarse touch keyboards, let Return insert newlines naturally unless short single-line without shift.
    if (e.key === 'Enter' && !e.shiftKey) {
      const isCoarsePointer =
        typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
      if (!isCoarsePointer) {
        e.preventDefault();
        if (hasText && !disabled) {
          onSubmitText();
        }
      }
    }
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="rounded-2xl border p-1.5 flex items-end gap-1.5 transition-colors duration-150 ease-out"
      style={{
        backgroundColor: 'var(--surface-inset)',
        borderColor: hasText ? 'var(--border-control)' : 'var(--border-subtle)',
      }}
    >
      <textarea
        ref={setTextareaNode}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        enterKeyHint="send"
        aria-label={placeholder}
        className="flex-1 min-h-[44px] max-h-[136px] px-2.5 py-2.5 bg-transparent text-base sm:text-sm leading-snug resize-none outline-none overscroll-contain"
        style={{
          color: 'var(--text-primary)',
        }}
      />

      <div className="flex items-center gap-1 shrink-0 pb-0.5">
        <button
          type="button"
          onClick={onStartVoice}
          disabled={micBlocked || disabled}
          aria-label="Dictar o grabar mensaje de voz"
          title="Usar micrófono"
          className="size-11 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out disabled:opacity-40"
          style={{
            touchAction: 'manipulation',
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <Mic className="size-4" />
        </button>

        <button
          type="submit"
          disabled={!hasText || disabled}
          aria-label="Enviar mensaje"
          className="size-11 rounded-xl flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out disabled:opacity-40"
          style={{
            touchAction: 'manipulation',
            backgroundColor: hasText ? 'var(--accent-fill)' : 'var(--surface-raised)',
            color: hasText ? 'var(--on-accent)' : 'var(--text-muted)',
          }}
        >
          <ArrowUp className="size-4 stroke-[2.4]" />
        </button>
      </div>
    </form>
  );
}

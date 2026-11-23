'use client';

import React, { useEffect, useRef } from 'react';
import { Mic, Pause, Sparkles } from 'lucide-react';
import type { VoiceAudioMetrics } from '@/hooks/useVoiceRecorder';

type VoiceOrbProps = {
  isRecording: boolean;
  isPaused?: boolean;
  isSpeaking?: boolean;
  isProcessing?: boolean;
  size?: 'sm' | 'lg';
  disabled?: boolean;
  audioLevel?: number;
  subscribeAudioMetrics?: (listener: (metrics: VoiceAudioMetrics) => void) => () => void;
  onToggle?: () => void;
};

export default function VoiceOrb({
  isRecording,
  isPaused = false,
  isSpeaking = false,
  isProcessing = false,
  size = 'lg',
  disabled = false,
  audioLevel = 0,
  subscribeAudioMetrics,
  onToggle,
}: VoiceOrbProps) {
  const auraRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!subscribeAudioMetrics || (!isRecording && !isPaused)) return;
    return subscribeAudioMetrics(({ level, isSpeaking: active }) => {
      const auraScale = active ? 1.18 + level * 0.52 : 1.02;
      const auraOpacity = active ? 0.55 + level * 0.4 : 0.18;
      const coreScale = active ? 1 + level * 0.22 : 1;

      if (auraRef.current) {
        auraRef.current.style.transform = `scale(${auraScale.toFixed(3)})`;
        auraRef.current.style.opacity = auraOpacity.toFixed(3);
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${(1.04 + level * 0.36).toFixed(3)})`;
        ringRef.current.style.opacity = active ? (0.4 + level * 0.45).toFixed(3) : '0.12';
      }
      if (coreRef.current) {
        coreRef.current.style.transform = `scale(${coreScale.toFixed(3)})`;
      }
    });
  }, [subscribeAudioMetrics, isRecording, isPaused]);

  const isSmall = size === 'sm';
  const fallbackScale = isRecording && !subscribeAudioMetrics ? 1 + audioLevel * 0.25 : 1;

  const orbCore = (
    <div
      className={`relative flex items-center justify-center select-none shrink-0 ${
        isSmall ? 'size-10' : 'size-24'
      }`}
    >
      {/* Chromatic Siri-style reactive aura (GPU transform + opacity only) */}
      <div
        ref={auraRef}
        aria-hidden="true"
        className={`absolute rounded-full pointer-events-none transition-[transform,opacity] duration-150 ease-out ${
          isSmall ? 'size-12 blur-md' : 'size-32 blur-2xl'
        }`}
        style={{
          opacity: isPaused ? 0.14 : isSpeaking ? 0.72 : 0.22,
          transform: `scale(${fallbackScale})`,
          background:
            'radial-gradient(circle at 30% 30%, #06B6D4 0%, #8B5CF6 48%, #EC4899 85%, #F59E0B 100%)',
        }}
      />

      {/* Active speech harmonic ring */}
      {isRecording && !isPaused && (
        <div
          ref={ringRef}
          aria-hidden="true"
          className={`absolute rounded-full border pointer-events-none transition-[transform,opacity] duration-150 ease-out ${
            isSmall ? 'size-11' : 'size-28'
          }`}
          style={{
            borderColor: isSpeaking ? 'var(--accent-text)' : 'var(--border-subtle)',
            opacity: isSpeaking ? 0.55 : 0.18,
          }}
        />
      )}

      <div
        ref={coreRef}
        className={`relative z-10 rounded-full flex items-center justify-center border transition-transform duration-150 ease-out ${
          isSmall ? 'size-9' : 'size-20 shadow-xl'
        }`}
        style={{
          borderColor: isSpeaking ? 'var(--accent-fill)' : 'var(--border-subtle)',
          background: isPaused
            ? 'var(--surface-raised)'
            : isSpeaking
            ? 'linear-gradient(135deg, var(--accent-fill) 0%, #8B5CF6 60%, #06B6D4 100%)'
            : 'var(--surface-inset)',
          color: isSpeaking ? 'var(--on-accent)' : 'var(--text-primary)',
        }}
      >
        {isProcessing ? (
          <Sparkles className={isSmall ? 'size-4 animate-pulse' : 'size-7 animate-pulse'} />
        ) : isPaused ? (
          <Pause className={isSmall ? 'size-4' : 'size-7'} />
        ) : (
          <Mic className={isSmall ? 'size-4' : 'size-7'} />
        )}
      </div>
    </div>
  );

  if (!onToggle) {
    return orbCore;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isProcessing}
      aria-label={
        isProcessing
          ? 'Procesando audio'
          : isRecording
          ? 'Detener grabación'
          : 'Iniciar grabación de voz'
      }
      className="inline-flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform duration-150 ease-out disabled:opacity-50"
      style={{ touchAction: 'manipulation' }}
    >
      {orbCore}
    </button>
  );
}

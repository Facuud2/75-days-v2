'use client';

import React, { useEffect, useRef } from 'react';
import { ArrowUp, Loader2, Mic, Pause, Play, Square, X } from 'lucide-react';
import type { VoiceAudioMetrics, VoiceRecorderStatus } from '@/hooks/useVoiceRecorder';
import VoiceOrb from './VoiceOrb';

interface VoiceSessionOverlayProps {
  status: VoiceRecorderStatus;
  isSpeaking: boolean;
  elapsedSeconds: number;
  subscribeAudioMetrics: (listener: (metrics: VoiceAudioMetrics) => void) => () => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onStopAndTranscribe: () => void;
  onSendDirect: () => void;
}

const VISUAL_BARS = 16;

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function VoiceSessionOverlay({
  status,
  isSpeaking,
  elapsedSeconds,
  subscribeAudioMetrics,
  onCancel,
  onPause,
  onResume,
  onStopAndTranscribe,
  onSendDirect,
}: VoiceSessionOverlayProps) {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const isPaused = status === 'paused';
  const isRecorderVisual = status === 'recording' || isPaused;
  const pendingCopy =
    status === 'requesting-permission'
      ? {
          title: 'Solicitando acceso al micrófono...',
          description: 'Aceptá el permiso del navegador para empezar a grabar',
        }
      : status === 'stopping'
        ? {
            title: 'Cerrando la grabación...',
            description: 'Estamos preparando el audio de forma segura',
          }
        : status === 'processing'
          ? {
              title: 'Enviando tu mensaje a la IA...',
              description: 'Podés cerrar esta vista; no enviaremos respuestas a otra sesión',
            }
          : status === 'transcribing'
            ? {
                title: 'Transcribiendo a texto...',
                description: 'Vas a poder revisarlo y editarlo antes de enviar',
              }
            : null;

  useEffect(() => {
    if (!isRecorderVisual) return;
    return subscribeAudioMetrics(({ bands, isSpeaking: active }) => {
      for (let i = 0; i < VISUAL_BARS; i++) {
        const el = barRefs.current[i];
        if (!el) continue;
        // Mirror low-to-high frequencies symmetrically from center for balanced voice feedback
        const distanceFromCenter = Math.abs(i - (VISUAL_BARS - 1) / 2);
        const bandIndex = Math.min(bands.length - 1, Math.floor(distanceFromCenter * 1.6));
        const val = bands[bandIndex] ?? 0;
        const scaleY = active ? Math.max(0.18, Math.min(1, 0.18 + val * 0.85)) : 0.14;
        el.style.transform = `scaleY(${scaleY.toFixed(3)})`;
        el.style.opacity = active ? '1' : '0.38';
      }
    });
  }, [isRecorderVisual, subscribeAudioMetrics]);

  if (pendingCopy) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="rounded-2xl border p-3.5 flex items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--surface-inset)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="size-9 rounded-full flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--accent-text)',
            }}
          >
            <Loader2 className="size-4 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {pendingCopy.title}
            </p>
            <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
              {pendingCopy.description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Grabadora de voz activa"
      className="rounded-2xl border p-3 flex flex-col gap-2.5"
      style={{
        backgroundColor: 'var(--surface-inset)',
        borderColor: isSpeaking ? 'var(--accent-fill)' : 'var(--border-subtle)',
        transition: 'border-color 160ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Top Status Row: Exact VAD state (Speaking vs Silence vs Paused) + Timer */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2 min-w-0" aria-live="polite">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border truncate"
            style={
              isPaused
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--status-warning) 14%, var(--surface-card))',
                    borderColor: 'color-mix(in srgb, var(--status-warning) 36%, transparent)',
                    color: 'var(--status-warning)',
                  }
                : isSpeaking
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--status-success) 15%, var(--surface-card))',
                    borderColor: 'color-mix(in srgb, var(--status-success) 40%, transparent)',
                    color: 'var(--status-success)',
                  }
                : {
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }
            }
          >
            {isPaused ? (
              <>
                <Pause className="size-3 shrink-0" />
                <span>En pausa</span>
              </>
            ) : isSpeaking ? (
              <>
                <Mic className="size-3 shrink-0" />
                <span>Captando tu voz</span>
              </>
            ) : (
              <>
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: 'var(--text-muted)' }}
                />
                <span>En silencio · hablá ahora</span>
              </>
            )}
          </span>
        </div>

        <span
          className="pv2-mono text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
          style={{
            backgroundColor: 'var(--surface-card)',
            color: 'var(--text-secondary)',
          }}
        >
          {formatDuration(elapsedSeconds)}
        </span>
      </div>

      {/* Live Reactive Orb + Symmetric 16-Bar Waveform */}
      <div
        className="flex items-center gap-3 px-2.5 py-2 rounded-xl border"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <VoiceOrb
          size="sm"
          isRecording={!isPaused}
          isPaused={isPaused}
          isSpeaking={isSpeaking}
          subscribeAudioMetrics={subscribeAudioMetrics}
        />

        <div
          aria-hidden="true"
          className="flex-1 h-8 flex items-center justify-between gap-1 px-1"
        >
          {Array.from({ length: VISUAL_BARS }).map((_, idx) => (
            <span
              key={idx}
              ref={(el) => {
                barRefs.current[idx] = el;
              }}
              className="flex-1 max-w-[5px] h-7 rounded-full origin-center transition-[transform,opacity] duration-75 ease-out"
              style={{
                transform: 'scaleY(0.14)',
                opacity: 0.38,
                backgroundColor: isPaused
                  ? 'var(--text-muted)'
                  : isSpeaking
                  ? 'var(--accent-fill)'
                  : 'var(--border-control)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Gemini.com-style Controls: Cancel (X) | Pause/Resume | Stop to Transcribe (Square) | Direct Send (ArrowUp) */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Descartar grabación"
          title="Descartar audio"
          className="min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
          style={{
            touchAction: 'manipulation',
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <X className="size-4" />
        </button>

        <button
          type="button"
          onClick={isPaused ? onResume : onPause}
          aria-label={isPaused ? 'Reanudar grabación' : 'Pausar grabación'}
          className="min-h-[44px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
          style={{
            touchAction: 'manipulation',
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          {isPaused ? (
            <>
              <Play className="size-3.5 fill-current" />
              <span>Seguir</span>
            </>
          ) : (
            <>
              <Pause className="size-3.5" />
              <span>Pausar</span>
            </>
          )}
        </button>

        {/* Square Stop -> Transcribe into textarea for review (Gemini.com primary review flow) */}
        <button
          type="button"
          onClick={onStopAndTranscribe}
          aria-label="Detener y transcribir al cuadro de texto para revisar"
          className="flex-1 min-h-[44px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out"
          style={{
            touchAction: 'manipulation',
            backgroundColor: 'var(--surface-raised)',
            borderColor: 'var(--border-control)',
            color: 'var(--text-primary)',
          }}
        >
          <Square className="size-3 fill-current shrink-0" />
          <span className="truncate">Revisar texto</span>
        </button>

        {/* Direct Send Arrow -> Immediate send without needing text review */}
        <button
          type="button"
          onClick={onSendDirect}
          aria-label="Enviar audio directamente a la IA"
          title="Enviar directo"
          className="min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1 shrink-0 cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
          style={{
            touchAction: 'manipulation',
            backgroundColor: 'var(--accent-fill)',
            color: 'var(--on-accent)',
          }}
        >
          <ArrowUp className="size-4 stroke-[2.4]" />
        </button>
      </div>
    </div>
  );
}

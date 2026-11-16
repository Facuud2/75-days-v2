'use client';

import React from 'react';
import { Mic, Square, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

type VoiceOrbProps = {
  isRecording: boolean;
  isProcessing: boolean;
  disabled?: boolean;
  audioLevel: number;
  onToggle: () => void;
};

export default function VoiceOrb({
  isRecording,
  isProcessing,
  disabled = false,
  audioLevel,
  onToggle,
}: VoiceOrbProps) {
  const dynamicScale = isRecording ? 1 + audioLevel * 0.38 : 1;
  const glowScale = isRecording ? 1.15 + audioLevel * 0.55 : 1.05;

  return (
    <div className="relative flex flex-col items-center justify-center py-4 select-none">
      {/* Aura cromática reactiva al sonido */}
      <motion.div
        aria-hidden="true"
        animate={{
          scale: isProcessing ? [1, 1.18, 1] : glowScale,
          opacity: isRecording ? 0.45 + audioLevel * 0.45 : isProcessing ? [0.35, 0.7, 0.35] : 0.28,
        }}
        transition={
          isProcessing
            ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
            : { type: 'spring', stiffness: 260, damping: 20 }
        }
        className="absolute w-36 h-36 rounded-full blur-2xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, #06B6D4 0%, #8B5CF6 48%, #EC4899 85%, #F59E0B 100%)',
        }}
      />

      {/* Anillo secundario cuando está escuchando */}
      {isRecording && (
        <motion.div
          aria-hidden="true"
          animate={{ scale: 1.08 + audioLevel * 0.45, opacity: 0.35 + audioLevel * 0.35 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="absolute w-28 h-28 rounded-full border border-cyan-300/50 pointer-events-none"
        />
      )}

      {/* Botón Orbe principal */}
      <motion.button
        type="button"
        onClick={onToggle}
        disabled={disabled || isProcessing}
        aria-label={
          isProcessing
            ? 'Procesando tu idea con IA'
            : isRecording
            ? 'Detener grabación'
            : 'Tocar para hablar con la IA'
        }
        animate={
          isRecording
            ? { scale: dynamicScale }
            : isProcessing
            ? { scale: [0.97, 1.03, 0.97] }
            : { scale: [1, 1.04, 1] }
        }
        transition={
          isRecording
            ? { type: 'spring', stiffness: 340, damping: 18 }
            : { duration: isProcessing ? 1.2 : 2.4, repeat: Infinity, ease: 'easeInOut' }
        }
        whileTap={{ scale: 0.94 }}
        className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border border-white/25 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        style={{
          touchAction: 'manipulation',
          background: isRecording
            ? 'linear-gradient(135deg, #06B6D4 0%, #8B5CF6 55%, #EC4899 100%)'
            : 'linear-gradient(135deg, #10B981 0%, #06B6D4 55%, #8B5CF6 100%)',
        }}
      >
        <span className="absolute inset-[3px] rounded-full bg-black/20 backdrop-blur-sm pointer-events-none" />
        <span className="relative z-10 text-white flex items-center justify-center">
          {isProcessing ? (
            <Sparkles className="w-8 h-8 animate-pulse" />
          ) : isRecording ? (
            <Square className="w-7 h-7 fill-white" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </span>
      </motion.button>

      <p
        className="mt-4 text-xs font-semibold tracking-wide"
        style={{ color: 'var(--text-secondary)' }}
      >
        {isProcessing
          ? 'Diseñando tu plan...'
          : isRecording
          ? 'Escuchando... tocá el orbe para detener'
          : 'Tocá el orbe y contame qué querés lograr'}
      </p>
    </div>
  );
}

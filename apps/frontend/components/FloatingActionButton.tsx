'use client';

import { Plus } from 'lucide-react';

interface FloatingActionButtonProps {
  onPress: () => void;
  label?: string;
  className?: string;
}

/**
 * Botón flotante circular (FAB) estilo Bitepal.
 * Circular oscuro con "+" claro, con animación de presión suave.
 * Se ancla en la zona del pulgar y no interfiere con el bottom nav.
 * Usa los tokens de superficie de la app para adaptarse a modo claro/oscuro.
 */
export default function FloatingActionButton({
  onPress,
  label = 'Agregar comida',
  className,
}: FloatingActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className={`
        flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4
        border-zinc-950 bg-[var(--surface-raised)]
        shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-transform duration-100 active:scale-95
        ${className ?? ''}
      `}
    >
      <Plus size={28} strokeWidth={2.5} stroke="currentColor" />
    </button>
  );
}

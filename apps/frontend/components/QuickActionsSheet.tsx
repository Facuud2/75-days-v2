'use client';

import { useEffect, useRef, useState } from 'react';
import { Apple, Dumbbell, Target, X } from 'lucide-react';

interface QuickActionsSheetProps {
  isOpen: boolean;
  isActive: boolean;
  onClose: () => void;
  onMeal: () => void;
  onWorkout: () => void;
  onPlans: () => void;
}

const CLOSE_DISTANCE = 96;

export default function QuickActionsSheet({
  isOpen,
  isActive,
  onClose,
  onMeal,
  onWorkout,
  onPlans,
}: QuickActionsSheetProps) {
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const previousFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusedElement.current = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusedElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startY.current = event.clientY;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    setOffsetY(Math.max(0, event.clientY - startY.current));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const distance = event.clientY - startY.current;
    startY.current = null;
    setIsDragging(false);
    setOffsetY(0);
    if (distance > CLOSE_DISTANCE) onClose();
  };

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div
      className="quick-actions-overlay fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="quick-actions-sheet w-full rounded-t-[2rem] border border-white/10 bg-zinc-950/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-actions-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          transform: `translateY(${offsetY}px)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          className="mx-auto mb-4 h-1.5 w-12 touch-none rounded-full bg-white/20"
          aria-hidden="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            startY.current = null;
            setIsDragging(false);
            setOffsetY(0);
          }}
        />
        <div className="flex items-start justify-between gap-4 px-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-400">Acción rápida</p>
            <h2 id="quick-actions-title" className="mt-1 text-xl font-bold text-white">
              {isActive ? '¿Qué quieres registrar?' : 'Comienza tu desafío'}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              {isActive ? 'Elige una actividad para continuar.' : 'Elige un plan para empezar a avanzar.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar acciones rápidas"
            onClick={onClose}
            className="rounded-full p-2 text-white/60 transition-colors active:bg-white/10 active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={() => handleAction(onMeal)}
                className="quick-action-item flex min-h-16 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-left text-white transition-colors active:scale-[0.99] active:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                  <Apple size={23} />
                </span>
                <span>
                  <span className="block font-semibold">Registrar comida</span>
                  <span className="mt-0.5 block text-sm text-white/50">Añade una comida al día actual</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleAction(onWorkout)}
                className="quick-action-item flex min-h-16 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-left text-white transition-colors active:scale-[0.99] active:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                  <Dumbbell size={23} />
                </span>
                <span>
                  <span className="block font-semibold">Registrar entrenamiento</span>
                  <span className="mt-0.5 block text-sm text-white/50">Guarda tu actividad física</span>
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleAction(onPlans)}
              className="quick-action-item flex min-h-16 items-center gap-4 rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 text-left text-white transition-colors active:scale-[0.99] active:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
                <Target size={23} />
              </span>
              <span>
                <span className="block font-semibold">Elegir un plan</span>
                <span className="mt-0.5 block text-sm text-white/55">Inicia un nuevo desafío de 75 días</span>
              </span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-12 w-full rounded-2xl px-4 text-center font-semibold text-white/60 transition-colors active:bg-white/10 active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const CLOSE_DISTANCE = 96;

/**
 * Responsive iOS Bottom Sheet on mobile (< sm) with swipe-to-dismiss handle,
 * and centered modal dialog on desktop (>= sm). Adapts to Light/Dark themes.
 */
export function SettingsSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: SettingsSheetProps) {
  const titleId = useId();
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

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-[3px] sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: offsetY > 0 ? `translateY(${offsetY}px)` : undefined,
          transition: isDragging
            ? 'none'
            : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="w-full max-h-[88dvh] overflow-y-auto rounded-t-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:max-w-lg sm:rounded-3xl sm:pb-6 animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        {/* Mobile swipe handle */}
        <div
          className="sticky top-0 z-10 bg-[var(--surface-card)]/95 backdrop-blur-md px-5 pt-3 pb-3 border-b border-[var(--divider)]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            startY.current = null;
            setIsDragging(false);
            setOffsetY(0);
          }}
        >
          <div
            className="mx-auto mb-3 h-1.5 w-10 touch-none rounded-full bg-[var(--border-control)]/50 sm:hidden"
            aria-hidden="true"
          />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Cerrar ${title}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-4">{children}</div>
      </div>
    </div>
  );
}

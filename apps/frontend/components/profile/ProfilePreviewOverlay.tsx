'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import ProfilePreview, { ProfilePreviewValues } from './ProfilePreview';

interface ProfilePreviewOverlayProps {
  open: boolean;
  onClose: () => void;
  values: ProfilePreviewValues;
  isDesktop: boolean;
}

/**
 * Vista previa a pantalla completa, como el botón "Previsualizar" de Twitter.
 *
 * Se decide en vivo con la media query del llamador: en escritorio reproduce la
 * barra lateral sticky de 300 px de `/profile`; en móvil, la tarjeta de
 * identidad a ancho completo. No hay campos editables: solo se mira.
 */
export default function ProfilePreviewOverlay({
  open,
  onClose,
  values,
  isDesktop,
}: ProfilePreviewOverlayProps) {
  const reduceMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 30);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.18 };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[120] overflow-y-auto"
      style={{ backgroundColor: 'var(--surface-page)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-preview-title"
    >
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--surface-card)',
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="pv2-icon-button"
            aria-label="Cerrar la previsualización"
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h2
              id="profile-preview-title"
              className="truncate text-base font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Vista previa
            </h2>
            <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              Así se va a ver tu perfil en {isDesktop ? 'la computadora' : 'el móvil'}
            </p>
          </div>
        </div>

        <button type="button" onClick={onClose} className="pv2-ghost shrink-0 px-3">
          Volver
        </button>
      </div>

      <div
        className={`mx-auto w-full pb-[calc(2rem+env(safe-area-inset-bottom,0px))] ${
          isDesktop ? 'max-w-6xl px-4 pt-6' : 'pt-3'
        }`}
      >
        {isDesktop ? (
          <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-10">
            <ProfilePreview values={values} variant="desktop" bannerHeight={112} />

            {/* Contexto del perfil real, atenuado: el foco está en la portada. */}
            <div className="mt-4 space-y-3 lg:mt-0" aria-hidden="true">
              {['01 · Retos', '02 · Salud', '03 · Logros'].map((title) => (
                <div key={title} className="pv2-card p-4">
                  <p className="pv2-label">{title}</p>
                  <div className="mt-3 space-y-2">
                    <div className="pv2-skeleton h-4 w-2/3" />
                    <div className="pv2-skeleton h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-2">
            <ProfilePreview values={values} variant="mobile" bannerHeight={132} />
            <div className="mt-3 space-y-3" aria-hidden="true">
              {['01 · Retos', '02 · Salud', '03 · Logros'].map((title) => (
                <div key={title} className="pv2-card p-4">
                  <p className="pv2-label">{title}</p>
                  <div className="mt-3 space-y-2">
                    <div className="pv2-skeleton h-4 w-2/3" />
                    <div className="pv2-skeleton h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

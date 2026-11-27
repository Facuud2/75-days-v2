'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export interface UseLongPressOptions {
  onLongPress: (rect: DOMRect) => void;
  delayMs?: number;
  moveThresholdPx?: number;
  disabled?: boolean;
}

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

const IGNORED_TARGET_SELECTOR = 'input, textarea, select, [contenteditable="true"], [data-no-long-press="true"]';

function triggerSoftHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(12);
    } catch {
      // Ignorar en navegadores que bloquean vibración sin gesto previo
    }
  }
}

/**
 * Detecta pulsación larga (long-press / Haptic Touch) en móvil y clic derecho /
 * Shift+F10 en desktop, cancelando limpiamente ante scroll vertical (>10px) y
 * suprimiendo el click fantasma al soltar.
 */
export function useLongPress({
  onLongPress,
  delayMs = 380,
  moveThresholdPx = 10,
  disabled = false,
}: UseLongPressOptions): {
  isPressing: boolean;
  handlers: LongPressHandlers;
} {
  const [isPressing, setIsPressing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const longPressFiredRef = useRef(false);
  const lastFiredAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPointRef.current = null;
    activeElementRef.current = null;
    setIsPressing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const fireLongPress = useCallback(
    (element: HTMLElement) => {
      longPressFiredRef.current = true;
      lastFiredAtRef.current = Date.now();
      clearTimer();
      triggerSoftHaptic();
      onLongPress(element.getBoundingClientRect());
    },
    [clearTimer, onLongPress]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      // Solo botón principal en mouse; en touch/pen e.button suele ser 0
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest(IGNORED_TARGET_SELECTOR)) return;

      longPressFiredRef.current = false;
      startPointRef.current = { x: e.clientX, y: e.clientY };
      activeElementRef.current = e.currentTarget;
      setIsPressing(true);

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      const el = e.currentTarget;
      timerRef.current = setTimeout(() => {
        fireLongPress(el);
      }, delayMs);
    },
    [delayMs, disabled, fireLongPress]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!startPointRef.current || timerRef.current === null) return;
      const dx = Math.abs(e.clientX - startPointRef.current.x);
      const dy = Math.abs(e.clientY - startPointRef.current.y);
      if (dx > moveThresholdPx || dy > moveThresholdPx) {
        clearTimer();
      }
    },
    [clearTimer, moveThresholdPx]
  );

  const onPointerUp = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerCancel = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerLeave = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') {
        clearTimer();
      }
    },
    [clearTimer]
  );

  const onClickCapture = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (longPressFiredRef.current || Date.now() - lastFiredAtRef.current < 350) {
      e.preventDefault();
      e.stopPropagation();
      longPressFiredRef.current = false;
    }
  }, []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(IGNORED_TARGET_SELECTOR)) return;

      e.preventDefault();
      // Evitar doble disparo si el long-press touch acaba de abrir el menú
      if (Date.now() - lastFiredAtRef.current < 500) return;

      clearTimer();
      lastFiredAtRef.current = Date.now();
      onLongPress(e.currentTarget.getBoundingClientRect());
    },
    [clearTimer, disabled, onLongPress]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (disabled) return;
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault();
        e.stopPropagation();
        clearTimer();
        lastFiredAtRef.current = Date.now();
        onLongPress(e.currentTarget.getBoundingClientRect());
      }
    },
    [clearTimer, disabled, onLongPress]
  );

  return {
    isPressing,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onContextMenu,
      onClickCapture,
      onKeyDown,
    },
  };
}

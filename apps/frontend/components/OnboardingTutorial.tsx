'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flame,
  Plus,
  Settings,
  Sparkles,
  Trophy,
  User,
  X,
} from 'lucide-react';

export interface TutorialStep {
  id: string;
  badge: string;
  title: string;
  description: string;
  tip: string;
  targetSelector?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  exploreLinks?: {
    label: string;
    href: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    badge: 'Bienvenida',
    title: '¡Tu desafío de 75 días ya empezó!',
    description:
      'Terminaste tu configuración inicial. Antes de arrancar de lleno, te mostramos en un minuto lo esencial que podés hacer acá para que recorras el sitio con confianza.',
    tip: 'Podés saltar este recorrido cuando quieras con el botón de arriba.',
    icon: Flame,
  },
  {
    id: 'daily-tasks',
    badge: 'Tu día a día',
    title: 'Completá tus tareas y seguí el progreso',
    description:
      'En Inicio vas a ver las metas diarias de tu plan. Tocalas para marcarlas como hechas y mirá cómo sube tu porcentaje en el resumen del día. Arriba tenés el reloj con el tiempo restante antes del cierre.',
    tip: 'Probá tocar cualquier tarea hoy para ver cómo se actualiza tu anillo de progreso.',
    targetSelector: '[data-tour="daily-tasks"]',
    icon: CheckCircle2,
  },
  {
    id: 'missions',
    badge: 'Misiones',
    title: 'Sumá misiones secundarias a tu ritmo',
    description:
      'Además de tu plan principal, en la pestaña Misiones podés activar retos paralelos más cortos o crear los tuyos propios con la dificultad que elijas.',
    tip: 'Entrá a Misiones y tocá "Nueva Misión" para descubrir las opciones disponibles.',
    targetSelector: '[data-tour="missions-tab"]',
    icon: Trophy,
  },
  {
    id: 'quick-actions',
    badge: 'Acciones rápidas',
    title: 'Registrá comidas, entrenos o cambiá de plan',
    description:
      'El botón + siempre queda a mano en la barra de navegación. Desde ahí podés cargar una comida, registrar un entrenamiento o explorar otros planes cuando lo necesites.',
    tip: 'Abrí el menú + en cualquier pantalla para acceder rápido sin perder lo que estabas haciendo.',
    targetSelector: '[data-tour="quick-actions"]',
    icon: Plus,
  },
  {
    id: 'explore',
    badge: 'Explorá el sitio',
    title: 'Calendario, Perfil y Ajustes te esperan',
    description:
      'No te quedes solo en el inicio: investigá el Calendario para revisar tu historial día a día, visitá tu Perfil para ver logros y métricas, y pasá por Ajustes para elegir tema y paleta de colores.',
    tip: 'Elegí cualquiera de estas secciones para empezar a recorrer o cerrá el tutorial para quedarte en Inicio.',
    targetSelector: '[data-tour="site-nav"]',
    icon: Compass,
    exploreLinks: [
      { label: 'Ir al Calendario', href: '/calendar', icon: Calendar },
      { label: 'Ver mi Perfil', href: '/profile', icon: User },
      { label: 'Abrir Ajustes', href: '/settings', icon: Settings },
    ],
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTutorialProps {
  isOpen: boolean;
  onSkip: () => void;
  onComplete: () => void;
}

function findVisibleTarget(selector?: string): HTMLElement | null {
  if (!selector || typeof document === 'undefined') return null;
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return (
    elements.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ?? null
  );
}

function isFixedPosition(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    const position = window.getComputedStyle(current).position;
    if (position === 'fixed' || position === 'sticky') {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

export function computeSpotlightRect(
  rect: Pick<DOMRect, 'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'>,
  viewport: { width: number; height: number },
  options?: { padding?: number; paddingTop?: number },
): SpotlightRect {
  const padding = options?.padding ?? 8;
  const paddingTop = options?.paddingTop ?? padding;
  const top = Math.max(4, rect.top - paddingTop);
  const left = Math.max(4, rect.left - padding);
  const right = Math.min(viewport.width - 4, rect.right + padding);
  const bottom = Math.min(viewport.height - 4, rect.bottom + padding);

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export default function OnboardingTutorial({
  isOpen,
  onSkip,
  onComplete,
}: OnboardingTutorialProps) {
  if (!isOpen) return null;
  return <OnboardingTutorialModal onSkip={onSkip} onComplete={onComplete} />;
}

function OnboardingTutorialModal({
  onSkip,
  onComplete,
}: Omit<OnboardingTutorialProps, 'isOpen'>) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const currentStep = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;

  const updateSpotlight = useCallback(() => {
    const target = findVisibleTarget(currentStep.targetSelector);
    if (!target) {
      setSpotlightRect(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    const isBottomNav =
      currentStep.targetSelector === '[data-tour="site-nav"]' &&
      rect.bottom >= window.innerHeight - 24;

    setSpotlightRect(
      computeSpotlightRect(
        rect,
        { width: window.innerWidth, height: window.innerHeight },
        {
          padding: 8,
          // Account for the protruding -mt-6 floating '+' action button on mobile bottom nav
          paddingTop: isBottomNav ? 26 : 8,
        },
      ),
    );
  }, [currentStep.targetSelector]);

  useEffect(() => {
    const target = findVisibleTarget(currentStep.targetSelector);
    let rafId = 0;
    let settleEnd = 0;

    if (target && !isFixedPosition(target)) {
      const rect = target.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Keep non-fixed targets comfortably away from sticky header (top) and bottom nav
      const idealTop = currentStep.id === 'missions' ? 96 : Math.max(88, viewportHeight * 0.48);
      const delta = rect.top - idealTop;

      if (Math.abs(delta) > 12) {
        window.scrollBy({ top: delta, behavior: 'smooth' });
        settleEnd = performance.now() + 550;
      }
    }

    const syncDuringScroll = () => {
      updateSpotlight();
      if (performance.now() < settleEnd) {
        rafId = window.requestAnimationFrame(syncDuringScroll);
      }
    };

    rafId = window.requestAnimationFrame(syncDuringScroll);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && target
        ? new ResizeObserver(() => updateSpotlight())
        : null;
    if (resizeObserver && target) {
      resizeObserver.observe(target);
    }

    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [currentStep.id, currentStep.targetSelector, updateSpotlight]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSkip();
      } else if (event.key === 'ArrowRight') {
        setStepIndex((prev) => Math.min(TUTORIAL_STEPS.length - 1, prev + 1));
      } else if (event.key === 'ArrowLeft') {
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSkip]);

  const cardPositionClass = useMemo(() => {
    if (!spotlightRect) {
      return 'items-center justify-center p-4';
    }
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const spaceAbove = spotlightRect.top;
    const spaceBelow = viewportHeight - (spotlightRect.top + spotlightRect.height);
    return spaceAbove >= spaceBelow
      ? 'items-start justify-center px-4 pt-16 sm:pt-20'
      : 'items-end justify-center px-4 pb-20 sm:pb-8';
  }, [spotlightRect]);

  const StepIcon = currentStep.icon;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleExploreNavigate = (href: string) => {
    onComplete();
    router.push(href);
  };

  return (
    <div
      className={`fixed inset-0 z-[110] flex ${cardPositionClass}`}
      role="presentation"
    >
      {/* Backdrop: either full dim or spotlight cutout */}
      {spotlightRect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-2xl ring-2 ring-rose-400"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-black/75 backdrop-blur-[2px]"
        />
      )}

      {/* Click-blocker overlay so background elements aren't accidentally triggered mid-tour */}
      <div
        aria-hidden="true"
        className="fixed inset-0"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Tutorial Card */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-step-title"
        aria-describedby="tutorial-step-description"
        className="relative z-10 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-white/15 bg-zinc-950/95 p-5 sm:p-6 shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top bar: step badge + skip button */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-400">
            <Sparkles size={12} aria-hidden="true" />
            <span>
              Paso {stepIndex + 1} de {TUTORIAL_STEPS.length} · {currentStep.badge}
            </span>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <span>Saltar tutorial</span>
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
            <StepIcon size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="tutorial-step-title"
              className="text-lg font-bold tracking-tight text-white"
            >
              {currentStep.title}
            </h2>
            <p
              id="tutorial-step-description"
              className="mt-1.5 text-sm leading-relaxed text-white/75"
            >
              {currentStep.description}
            </p>
          </div>
        </div>

        {/* Tip box */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs leading-relaxed text-white/70">
          <span className="font-bold text-rose-400">Tip: </span>
          {currentStep.tip}
        </div>

        {/* Quick-explore links on final step */}
        {currentStep.exploreLinks && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {currentStep.exploreLinks.map((link) => {
              const LinkIcon = link.icon;
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => handleExploreNavigate(link.href)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <LinkIcon size={14} aria-hidden="true" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer: progress dots + navigation buttons */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-1.5" aria-label="Progreso del tutorial">
            {TUTORIAL_STEPS.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                aria-label={`Ir al paso ${idx + 1}: ${step.badge}`}
                aria-current={idx === stepIndex ? 'step' : undefined}
                onClick={() => setStepIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === stepIndex
                    ? 'w-6 bg-rose-400'
                    : idx < stepIndex
                      ? 'w-2 bg-rose-400/50'
                      : 'w-2 bg-white/20 hover:bg-white/35'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                <span>Anterior</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-rose-400 px-4 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-rose-500/20 transition-colors hover:bg-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <span>
                {isFirstStep
                  ? 'Empezar recorrido'
                  : isLastStep
                    ? '¡Listo, a explorar!'
                    : 'Siguiente'}
              </span>
              {!isLastStep && <ChevronRight size={14} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

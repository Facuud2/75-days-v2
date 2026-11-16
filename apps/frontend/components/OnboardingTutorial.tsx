'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  SunMoon,
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
  fallbackSelector?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  exploreLinks?: {
    label: string;
    href: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[];
}

export interface BuildTutorialStepsOptions {
  userName?: string | null;
  planDifficulty?: string | null;
}

export function buildTutorialSteps(
  options?: BuildTutorialStepsOptions,
): TutorialStep[] {
  const firstName = options?.userName?.trim().split(/\s+/)[0];
  const isCustomPlan = options?.planDifficulty === 'Custom';
  const planLabel = options?.planDifficulty || '75 Days';

  return [
    {
      id: 'welcome',
      badge: 'Bienvenida',
      title: firstName
        ? `¡Hola, ${firstName}! Tu desafío ya empezó`
        : '¡Tu desafío de 75 días ya empezó!',
      description: isCustomPlan
        ? 'Configuraste tu plan Custom con tus propias reglas. Ahora te mostramos cada sección del sitio para que sepas qué podés hacer en cada una.'
        : `Ya tenés activo tu plan ${planLabel}. En menos de un minuto te mostramos de forma interactiva qué vas a encontrar en cada sección.`,
      tip: 'Pulsá "Siguiente" para iluminar cada sección o saltá el recorrido cuando quieras.',
      icon: Flame,
    },
    {
      id: 'daily-summary',
      badge: 'Resumen del día',
      title: 'Tu avance y el reloj diario siempre a la vista',
      description:
        'En este panel ves en qué día del reto estás, tu porcentaje de progreso diario y cuántas tareas te faltan. Arriba tenés el reloj con el tiempo restante antes del cierre del día.',
      tip: 'Cada tarea que marques actualiza al instante tu anillo de progreso.',
      targetSelector: '[data-tour="daily-summary"]',
      icon: LayoutDashboard,
    },
    {
      id: 'daily-tasks',
      badge: isCustomPlan ? 'Plan Custom' : 'Tareas diarias',
      title: isCustomPlan
        ? 'Tus metas personalizadas del día'
        : 'Marcá tus tareas del plan activo',
      description: isCustomPlan
        ? 'Acá aparecen las metas diarias que diseñaste en tu plan Custom. Tocalas para marcarlas como completadas y sumar avance en tu jornada.'
        : 'En Inicio ves todas las metas diarias de tu plan. Tocalas para completarlas y mirá cómo sube tu porcentaje al instante.',
      tip: isCustomPlan
        ? 'Podés modificar tus metas o cambiar de plan cuando quieras desde el botón +.'
        : '¿Querés armar tus propias reglas? Desde el botón + podés pasarte a un plan Custom.',
      targetSelector: '[data-tour="daily-tasks"]',
      icon: CheckCircle2,
    },
    {
      id: 'missions-create',
      badge: 'Misiones secundarias',
      title: 'Creá misiones nuevas y marcá tu progreso',
      description:
        'Cambiamos a la pestaña Misiones para mostrarte este espacio: acá ves tus retos paralelos activos, podés tocar cualquiera para marcar su avance diario y usar "Nueva Misión" para elegir plantillas o crear misiones propias.',
      tip: 'Tocá "Nueva Misión" cuando termines el tour para explorar retos cortos o diseñar uno a tu medida.',
      targetSelector: '[data-tour="new-mission-btn"]',
      fallbackSelector: '[data-tour="missions-tab"]',
      icon: Trophy,
    },
    {
      id: 'quick-actions',
      badge: 'Acciones rápidas',
      title: 'Registrá comidas, entrenos o cambiá de plan',
      description:
        'El botón + siempre queda a mano en toda la app. Desde ahí cargás comidas, registrás entrenamientos o abrís el selector de planes para cambiar de dificultad o crear tu propio desafío Custom.',
      tip: 'Usalo desde cualquier pantalla sin perder lo que estabas haciendo.',
      targetSelector: '[data-tour="quick-actions"]',
      icon: Plus,
    },
    {
      id: 'nav-calendar',
      badge: 'Calendario',
      title: 'Revisá tu historial día por día',
      description:
        'En Calendario vas a encontrar el registro visual de los 75 días: qué jornadas completaste al 100%, tus rachas y el detalle de comidas, entrenamientos y tareas de días anteriores.',
      tip: 'Tocá cualquier día del calendario para abrir su resumen completo.',
      targetSelector: '[data-tour="nav-calendar"]',
      fallbackSelector: '[data-tour="site-nav"]',
      icon: Calendar,
    },
    {
      id: 'nav-profile',
      badge: 'Perfil',
      title: 'Logros, métricas y personalización',
      description:
        'En tu Perfil ves tus logros desbloqueados, evolución de peso y estadísticas. Además, desde ahí podés cambiar tu foto, banner, nombre o frase de perfil en cualquier momento.',
      tip: 'Visitá tu Perfil para seguir tus medallas y personalizar tu tarjeta.',
      targetSelector: '[data-tour="nav-profile"]',
      fallbackSelector: '[data-tour="site-nav"]',
      icon: User,
    },
    {
      id: 'theme-toggle',
      badge: 'Modo claro / oscuro',
      title: 'Cambiá entre modo claro y oscuro al instante',
      description:
        'Con este botón del encabezado podés alternar entre modo oscuro y modo claro en cualquier pantalla con una transición fluida.',
      tip: 'Probá tocar el ícono de sol/luna cuando quieras adaptar la app a la luz del momento.',
      targetSelector: '[data-tour="theme-toggle"]',
      icon: SunMoon,
    },
    {
      id: 'nav-settings',
      badge: 'Ajustes y más',
      title: 'Ajustes de apariencia y seguridad',
      description:
        'En Ajustes podés elegir tu paleta de colores favorita, configurar preferencias, cambiar tu contraseña o volver a lanzar este tutorial cuando lo necesites.',
      tip: 'Elegí a qué sección querés ir ahora o cerrá el recorrido para empezar en Inicio.',
      targetSelector: '[data-tour="nav-settings"]',
      fallbackSelector: '[data-tour="site-nav"]',
      icon: Settings,
      exploreLinks: [
        { label: 'Ir al Calendario', href: '/calendar', icon: Calendar },
        { label: 'Ver mi Perfil', href: '/profile', icon: User },
        { label: 'Abrir Ajustes', href: '/settings', icon: Settings },
      ],
    },
  ];
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTutorialProps {
  isOpen: boolean;
  userName?: string | null;
  planDifficulty?: string | null;
  onStepChange?: (stepId: string) => void;
  onSkip: () => void;
  onComplete: () => void;
}

function findVisibleTarget(
  selector?: string,
  fallbackSelector?: string,
): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const queryVisible = (sel?: string) => {
    if (!sel) return null;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(sel));
    return (
      elements.find((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) ?? null
    );
  };

  return queryVisible(selector) ?? queryVisible(fallbackSelector);
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
  userName,
  planDifficulty,
  onStepChange,
  onSkip,
  onComplete,
}: OnboardingTutorialProps) {
  if (!isOpen) return null;
  return (
    <OnboardingTutorialModal
      userName={userName}
      planDifficulty={planDifficulty}
      onStepChange={onStepChange}
      onSkip={onSkip}
      onComplete={onComplete}
    />
  );
}

function OnboardingTutorialModal({
  userName,
  planDifficulty,
  onStepChange,
  onSkip,
  onComplete,
}: Omit<OnboardingTutorialProps, 'isOpen'>) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const steps = useMemo(
    () => buildTutorialSteps({ userName, planDifficulty }),
    [userName, planDifficulty],
  );

  const currentStep = steps[stepIndex] ?? steps[0];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  const updateSpotlight = useCallback(() => {
    const target = findVisibleTarget(
      currentStep.targetSelector,
      currentStep.fallbackSelector,
    );
    if (!target) {
      setSpotlightRect(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    const isBottomQuickAction =
      currentStep.targetSelector === '[data-tour="quick-actions"]' &&
      rect.bottom >= window.innerHeight - 36;

    setSpotlightRect(
      computeSpotlightRect(
        rect,
        { width: window.innerWidth, height: window.innerHeight },
        {
          padding: 8,
          paddingTop: isBottomQuickAction ? 14 : 8,
        },
      ),
    );
  }, [currentStep.fallbackSelector, currentStep.targetSelector]);

  useEffect(() => {
    onStepChange?.(currentStep.id);
  }, [currentStep.id, onStepChange]);

  useEffect(() => {
    let rafId = 0;
    let settleEnd = 0;
    let delayedSyncTimer = 0;

    const runSync = () => {
      const target = findVisibleTarget(
        currentStep.targetSelector,
        currentStep.fallbackSelector,
      );

      if (target && !isFixedPosition(target)) {
        const rect = target.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const idealTop =
          currentStep.id === 'missions-create'
            ? 110
            : Math.max(88, viewportHeight * 0.42);
        const delta = rect.top - idealTop;

        if (Math.abs(delta) > 16) {
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
    };

    runSync();
    // Re-sync after tab-switch animations mount newly visible targets (e.g. Nueva Misión)
    delayedSyncTimer = window.setTimeout(runSync, 90);

    const target = findVisibleTarget(
      currentStep.targetSelector,
      currentStep.fallbackSelector,
    );
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
      window.clearTimeout(delayedSyncTimer);
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [
    currentStep.fallbackSelector,
    currentStep.id,
    currentStep.targetSelector,
    updateSpotlight,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSkip();
      } else if (event.key === 'ArrowRight') {
        setDirection(1);
        setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
      } else if (event.key === 'ArrowLeft') {
        setDirection(-1);
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSkip, steps.length]);

  const cardPositionClass = useMemo(() => {
    if (!spotlightRect) {
      return 'items-center justify-center p-4';
    }
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const spaceAbove = spotlightRect.top;
    const spaceBelow = viewportHeight - (spotlightRect.top + spotlightRect.height);
    return spaceAbove >= spaceBelow
      ? 'items-start justify-center px-4 pt-16 sm:pt-20'
      : 'items-end justify-center px-4 pb-24 sm:pb-8';
  }, [spotlightRect]);

  const StepIcon = currentStep.icon;

  const goToStep = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, nextIndex));
    setDirection(clamped >= stepIndex ? 1 : -1);
    setStepIndex(clamped);
  };

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      goToStep(stepIndex + 1);
    }
  };

  const handlePrev = () => {
    goToStep(stepIndex - 1);
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
      {/* Backdrop: either full dim or animated spotlight cutout */}
      {spotlightRect ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-2xl ring-2 ring-rose-400"
          initial={false}
          animate={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 360, damping: 34 }
          }
          style={{
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
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-step-title"
        aria-describedby="tutorial-step-description"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', bounce: 0, duration: 0.35 }
        }
        className="relative z-10 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-white/15 bg-zinc-950/95 p-5 sm:p-6 shadow-2xl outline-none"
      >
        {/* Top bar: step badge + skip button */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-400">
            <Sparkles size={12} aria-hidden="true" />
            <span>
              Paso {stepIndex + 1} de {steps.length} · {currentStep.badge}
            </span>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <span>Saltar</span>
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Animated step content */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep.id}
            initial={
              reduceMotion
                ? false
                : { opacity: 0, x: direction * 12 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, x: direction * -12 }
            }
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }
            }
          >
            <div className="mt-4 flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
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
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs leading-relaxed text-white/70">
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
          </motion.div>
        </AnimatePresence>

        {/* Footer: progress dots + navigation buttons */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-1.5" aria-label="Progreso del tutorial">
            {steps.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                aria-label={`Ir al paso ${idx + 1}: ${step.badge}`}
                aria-current={idx === stepIndex ? 'step' : undefined}
                onClick={() => goToStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === stepIndex
                    ? 'w-5 bg-rose-400'
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
      </motion.div>
    </div>
  );
}

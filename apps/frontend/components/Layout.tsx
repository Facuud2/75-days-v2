'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useUIStore } from '@/store/useUIStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import dynamic from 'next/dynamic';
import { Home, Calendar, User, Settings, LogOut, Moon, Sun, Flame, Plus, Dumbbell, Utensils } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { startCircularReveal } from '@/lib/themeTransition';
import { getPageTransitionDirection, type PageTransitionDirection } from '@/lib/pageTransitions';
import { getLocalDateString } from '@/lib/utils/date';
import HeaderCountdownTimer from '@/components/HeaderCountdownTimer';
import { RouteContentSkeleton } from '@/components/auth/RouteBootSkeleton';

// Lazy-loaded modal/sheet components to keep root bundle light (vercel-react-best-practices: bundle-dynamic-imports)
const PlansModal = dynamic(() => import('@/components/PlansModal'), { ssr: false });
const LogMealModal = dynamic(() => import('@/components/LogMealModal'), { ssr: false });
const LogWorkoutModal = dynamic(() => import('@/components/LogWorkoutModal'), { ssr: false });
const LogWeightModal = dynamic(() => import('@/components/LogWeightModal'), { ssr: false });
const QuickActionsSheet = dynamic(() => import('@/components/QuickActionsSheet'), { ssr: false });
const LogWorkoutMenu = dynamic(() => import('@/components/LogWorkoutMenu'), { ssr: false });
const LogoutConfirmSheet = dynamic(() => import('@/components/profile/LogoutConfirmSheet'), { ssr: false });
const LiveWorkoutOverlay = dynamic(() => import('@/components/fitness/LiveWorkoutOverlay'), { ssr: false });
const ActiveWorkoutBanner = dynamic(() => import('@/components/fitness/ActiveWorkoutBanner'), { ssr: false });

/**
 * Custom palettes can pick an arbitrarily bright accent. In dark appearance the
 * accent fill is used raw, so pick the text colour that keeps WCAG AA contrast
 * instead of assuming white.
 */
function relativeLuminance(color: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function pickOnAccent(accentFill: string): string {
  const luminance = relativeLuminance(accentFill);
  if (luminance === null) return '#ffffff';
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithWhite >= 4.5 ? '#ffffff' : '#111111';
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout, user } = useAuthStore();
  const { appearance, colorPalette, customPalette, setAppearance, resetTheme } = useThemeStore();
  const {
    openPlansModal,
    openLogMealModal,
    openLogWorkoutModal,
    openLogWorkoutMenu,
    closeLogWorkoutMenu,
    closeLogWeightModal,
    isPlansModalOpen,
    isLogMealModalOpen,
    isLogWorkoutModalOpen,
    isLogWorkoutMenuOpen,
    isQuickLogWorkout,
    isLogWeightModalOpen,
    isQuickActionsOpen,
    openQuickActions,
    closeQuickActions,
  } = useUIStore();
  const { difficulty, isActive } = useChallengeStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<{
    href: string;
    direction: PageTransitionDirection;
  } | null>(null);
  const lastDirectionRef = useRef<PageTransitionDirection>('none');
  const hasNavigatedRef = useRef(false);

  const activeHref = pendingNav?.href ?? pathname;
  const isShowingPendingSkeleton = pendingNav !== null && pendingNav.href !== pathname;

  // ── Applies dark/light class + data-appearance synchronously on <html> ──────
  // This must run synchronously inside startViewTransition's callback so the API
  // can capture the before/after DOM snapshots and animate between them.
  const applyAppearanceToDom = useCallback((mode: typeof appearance) => {
    const root = document.documentElement;
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    isDark ? root.classList.add('dark') : root.classList.remove('dark');
    root.setAttribute('data-appearance', isDark ? 'dark' : 'light');
    root.style.colorScheme = isDark ? 'dark' : 'light';
    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-runtime-theme]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.name = 'theme-color';
      themeColor.dataset.runtimeTheme = 'true';
    }
    themeColor.setAttribute('content', isDark ? '#09090b' : '#f6f5f3');
    if (!themeColor.isConnected) document.head.appendChild(themeColor);
  }, []);

  // Apply appearance on store changes (covers page load & system changes)
  useEffect(() => {
    applyAppearanceToDom(appearance);
  }, [appearance, applyAppearanceToDom]);

  // The public auth screens always use the site's identity palette. A previous
  // user's custom palette must never leak into the next login session.
  useEffect(() => {
    if (!isAuthenticated && (pathname === '/login' || pathname === '/register')) {
      resetTheme();
    }
  }, [isAuthenticated, pathname, resetTheme]);

  // Apply colour palette: data-palette attr for presets, direct CSS vars for custom
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-palette', colorPalette);
    const roseShades = ['400', '500', '600', '700', '900', '950'];
    if (colorPalette === 'custom') {
      root.style.setProperty('--color-rose-400', customPalette.accent);
      root.style.setProperty('--color-rose-500', customPalette.primary);
      root.style.setProperty('--color-rose-600', customPalette.secondary);
      root.style.setProperty('--color-rose-700', customPalette.secondary);
      root.style.setProperty('--color-rose-900', customPalette.secondary);
      root.style.setProperty('--color-rose-950', customPalette.secondary);
    } else {
      roseShades.forEach((s) => root.style.removeProperty(`--color-rose-${s}`));
    }
  }, [colorPalette, customPalette]);

  // Custom palettes bypass the static --on-accent overrides, so derive the
  // readable label colour for the resolved appearance at runtime.
  useEffect(() => {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-appearance') === 'dark';
    if (colorPalette === 'custom' && isDark) {
      root.style.setProperty('--on-accent', pickOnAccent(customPalette.secondary));
    } else {
      root.style.removeProperty('--on-accent');
    }
  }, [appearance, colorPalette, customPalette]);

  // Clear optimistic pending navigation once Next.js commits the target route
  useEffect(() => {
    if (!pendingNav) return;
    if (
      pathname === pendingNav.href ||
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/onboarding'
    ) {
      setPendingNav(null);
    }
  }, [pathname, pendingNav]);

  // Safety valve so an aborted/failed navigation never traps the UI on a skeleton
  useEffect(() => {
    if (!pendingNav) return;
    const timer = window.setTimeout(() => {
      setPendingNav(null);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [pendingNav]);

  // Prefetch primary navigation tabs for snappier mobile/tablet transitions
  useEffect(() => {
    if (!isAuthenticated || !user?.onboardingCompleted) return;
    ['/dashboard', '/nutrition', '/fitness', '/profile'].forEach((route) => {
      router.prefetch(route);
    });
  }, [isAuthenticated, user?.onboardingCompleted, router]);

  const navigateFromAppNav = useCallback((href: string) => {
    const currentVisibleHref = pendingNav?.href ?? pathname;
    if (href === currentVisibleHref) return;

    const direction = getPageTransitionDirection(currentVisibleHref, href);
    hasNavigatedRef.current = true;
    lastDirectionRef.current = direction;

    if (href === pathname) {
      setPendingNav(null);
      router.push(href);
      return;
    }

    setPendingNav({ href, direction });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    router.push(href);
  }, [pathname, pendingNav, router]);

  const appNavLinkProps = useCallback((href: string) => ({
    href,
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      event.preventDefault();
      if (href !== activeHref) navigateFromAppNav(href);
    },
  }), [activeHref, navigateFromAppNav]);

  // Auth surfaces own the full viewport (safe areas, status bar, scroll) and
  // must not inherit the app header or the padded content shell.
  if (pathname === '/login' || pathname === '/register' || (!isAuthenticated && pathname === '/')) {
    return <>{children}</>;
  }

  if (!isAuthenticated && !['/login', '/register', '/onboarding'].includes(pathname)) {
    return <div className="min-h-dvh bg-zinc-950 text-white">{children}</div>;
  }

  const toggleTheme = (e: React.MouseEvent) => {
    const nextMode = appearance === 'dark' ? 'light' : 'dark';
    startCircularReveal(e, () => {
      applyAppearanceToDom(nextMode);
      setAppearance(nextMode);
    });
  };

  const transitionDirection = pendingNav?.direction ?? lastDirectionRef.current;
  const contentInitial = !hasNavigatedRef.current
    ? false
    : transitionDirection === 'forward'
      ? { opacity: 0, x: 12 }
      : transitionDirection === 'backward'
        ? { opacity: 0, x: -12 }
        : { opacity: 0, x: 0 };

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-shell min-h-dvh flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-rose-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>
      {/* Header */}
      <header className="app-header sticky top-0 z-50 border-b px-4 md:px-6 py-2 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Flame size={18} className="text-rose-500 sm:h-6 sm:w-6" fill="currentColor" />
          <span className="font-bold text-xl tracking-wider hidden sm:inline">75 DAYS</span>
          <span className="text-rose-500 italic font-bold text-[17px] leading-tight sm:text-xl">
            {isAuthenticated
              ? user?.onboardingCompleted
                ? difficulty?.toUpperCase() || 'ACTIVO'
                : 'BIENVENIDA'
              : 'APP'}
          </span>
        </div>

        <div className="flex items-center gap-2.5 md:gap-6">
          {/* Timer - Only visible once onboarding is completed */}
          {isAuthenticated && user?.onboardingCompleted && <HeaderCountdownTimer />}

          {/* Nav - Desktop links (mobile uses bottom nav) + utility controls */}
          <nav className="app-nav flex items-center gap-1 md:gap-2">
            {isAuthenticated && user?.onboardingCompleted && (
              <div data-tour="site-nav" className="hidden lg:flex items-center gap-1 md:gap-2">
                <Link data-tour="nav-home" {...appNavLinkProps('/dashboard')} className={`app-header-nav flex flex-col items-center p-2 transition-colors ${activeHref === '/dashboard' ? 'is-active' : ''}`}>
                  <Home size={20} strokeWidth={activeHref === '/dashboard' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Inicio</span>
                </Link>
                <Link data-tour="nav-calendar" {...appNavLinkProps('/calendar')} className={`app-header-nav flex flex-col items-center p-2 transition-colors ${activeHref === '/calendar' ? 'is-active' : ''}`}>
                  <Calendar size={20} strokeWidth={activeHref === '/calendar' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Calendario</span>
                </Link>
                <Link data-tour="nav-nutrition" {...appNavLinkProps('/nutrition')} className={`app-header-nav flex flex-col items-center p-2 transition-colors ${activeHref === '/nutrition' ? 'is-active' : ''}`}>
                  <Utensils size={20} strokeWidth={activeHref === '/nutrition' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Nutrición</span>
                </Link>
                <button data-tour="quick-actions" aria-label="Abrir acciones rápidas" aria-expanded={isQuickActionsOpen} onClick={openQuickActions} className="app-header-nav flex flex-col items-center rounded-xl p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                  <Plus size={20} strokeWidth={2.2} />

                </button>
                <Link data-tour="nav-fitness" {...appNavLinkProps('/fitness')} className={`app-header-nav flex flex-col items-center p-2 transition-colors ${activeHref === '/fitness' ? 'is-active' : ''}`}>
                  <Dumbbell size={20} strokeWidth={activeHref === '/fitness' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Fitness</span>
                </Link>
                <Link data-tour="nav-profile" {...appNavLinkProps('/profile')} className={`app-header-nav flex flex-col items-center p-2 transition-colors ${activeHref === '/profile' ? 'is-active' : ''}`}>
                  <User size={20} strokeWidth={activeHref === '/profile' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Perfil</span>
                </Link>
                <Link data-tour="nav-settings" {...appNavLinkProps('/settings')} className={`app-header-nav flex flex-col items-center p-2 transition-colors ${activeHref === '/settings' ? 'is-active' : ''}`}>
                  <Settings size={20} strokeWidth={activeHref === '/settings' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Ajustes</span>
                </Link>
              </div>
            )}

            {/* Mobile Calendar + Settings shortcuts in header (moved from bottom nav to make room for Nutrition & Fitness) */}
            {isAuthenticated && user?.onboardingCompleted && activeHref !== '/calendar' && (
              <Link
                data-tour="nav-calendar"
                {...appNavLinkProps('/calendar')}
                aria-label="Abrir calendario"
                className="lg:hidden hit-44 inline-flex h-11 w-11 items-center justify-center app-header-control transition-colors rounded-full border active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <Calendar size={18} strokeWidth={1.8} />
              </Link>
            )}
            {/* Mobile Settings shortcut: only shown on the Profile screen */}
            {isAuthenticated && user?.onboardingCompleted && activeHref === '/profile' && (
              <Link
                data-tour="nav-settings-mobile"
                {...appNavLinkProps('/settings')}
                aria-label="Abrir ajustes"
                className="lg:hidden hit-44 inline-flex h-11 w-11 items-center justify-center app-header-control transition-colors rounded-full border ml-1.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <Settings size={18} strokeWidth={1.8} />
              </Link>
            )}

            {/* Always visible theme toggle */}
            <button data-tour="theme-toggle" aria-label={appearance === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={(e) => toggleTheme(e)} className="app-header-control hit-44 inline-flex h-11 w-11 items-center justify-center transition-colors rounded-full border ml-1.5 relative overflow-hidden active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 bg-[var(--surface-inset)] hover:bg-[var(--surface-raised)]" title={appearance === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}>
              <span className={`block transition-all duration-200 motion-reduce:transition-none ${appearance === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute'}`}>
                <Sun size={18} strokeWidth={1.8} />
              </span>
              <span className={`block transition-all duration-200 motion-reduce:transition-none ${appearance === 'dark' ? '-rotate-90 scale-0 absolute' : 'rotate-0 scale-100'}`}>
                <Moon size={18} strokeWidth={1.8} />
              </span>
            </button>

            {/* Logout button: shown next to theme toggle only on Settings */}
            {isAuthenticated && pathname === '/settings' && (
              <button aria-label="Cerrar sesión" onClick={() => setIsLogoutConfirmOpen(true)} className="hit-44 inline-flex h-11 w-11 items-center justify-center app-header-control transition-colors rounded-full border ml-1.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                <LogOut size={18} strokeWidth={1.8} />
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className={`app-main flex-1 max-w-7xl w-full mx-auto px-4 pt-2.5 md:p-6 ${isAuthenticated && user?.onboardingCompleted ? 'pb-20 md:pb-6' : 'app-main--no-nav pb-3 md:pb-6'} ${!isAuthenticated ? 'flex items-center justify-center' : ''}`}>
        <motion.div
          key={activeHref}
          initial={contentInitial}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          {isShowingPendingSkeleton ? (
            <RouteContentSkeleton pathname={pendingNav.href} />
          ) : (
            children
          )}
        </motion.div>
      </main>

      {isAuthenticated && isPlansModalOpen && <PlansModal />}
      {isAuthenticated && isLogMealModalOpen && <LogMealModal isOpen={isLogMealModalOpen} onClose={() => { useUIStore.getState().closeLogMealModal(); }} date={getLocalDateString()} onSaved={() => { }} />}
      {isAuthenticated && isLogWorkoutModalOpen && <LogWorkoutModal isOpen={isLogWorkoutModalOpen} quickLog={isQuickLogWorkout} onClose={() => { useUIStore.getState().closeLogWorkoutModal(); }} date={getLocalDateString()} onSaved={() => { }} />}
      {isAuthenticated && isLogWeightModalOpen && <LogWeightModal isOpen={isLogWeightModalOpen} onClose={closeLogWeightModal} date={getLocalDateString()} />}
      {isAuthenticated && user?.onboardingCompleted && (
        <>
          <LiveWorkoutOverlay />
          <ActiveWorkoutBanner />
        </>
      )}
      {isAuthenticated && isQuickActionsOpen && (
        <QuickActionsSheet
          isOpen={isQuickActionsOpen}
          isActive={isActive}
          onClose={closeQuickActions}
          onMeal={openLogMealModal}
          onWorkout={openLogWorkoutMenu}
          onPlans={openPlansModal}
        />
      )}
      {isAuthenticated && (
        <LogWorkoutMenu
          isOpen={isLogWorkoutMenuOpen}
          onClose={closeLogWorkoutMenu}
          onNewWorkout={() => {
            closeLogWorkoutMenu();
            openLogWorkoutModal(false);
          }}
          onQuickLog={() => {
            closeLogWorkoutMenu();
            openLogWorkoutModal(true);
          }}
        />
      )}
      {isAuthenticated && isLogoutConfirmOpen && (
        <LogoutConfirmSheet
          open={isLogoutConfirmOpen}
          onClose={() => setIsLogoutConfirmOpen(false)}
          onConfirm={() => {
            setIsLogoutConfirmOpen(false);
            logout();
            router.replace('/login');
          }}
        />
      )}

      {/* Mobile Bottom Nav - Only visible if logged in */}
      {isAuthenticated && user?.onboardingCompleted && (
        <nav data-tour="site-nav" aria-label="Navegación principal" className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around gap-1 border-t border-white/10 px-1.5 pt-1">
          <Link data-tour="nav-home" {...appNavLinkProps('/dashboard')} aria-current={activeHref === '/dashboard' ? 'page' : undefined} className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-medium leading-none transition-colors ${activeHref === '/dashboard' ? '' : 'text-white/55'}`}>
            {activeHref === '/dashboard' && <motion.span layoutId="bottom-nav-active" className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-rose-400" transition={{ type: 'spring', bounce: 0.14, duration: 0.24 }} />}
            <Home size={20} strokeWidth={activeHref === '/dashboard' ? 2.2 : 1.7} />
            <span>Inicio</span>
          </Link>
          <Link data-tour="nav-nutrition" {...appNavLinkProps('/nutrition')} aria-current={activeHref === '/nutrition' ? 'page' : undefined} className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-medium leading-none transition-colors ${activeHref === '/nutrition' ? '' : 'text-white/55'}`}>
            {activeHref === '/nutrition' && <motion.span layoutId="bottom-nav-active" className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-rose-400" transition={{ type: 'spring', bounce: 0.14, duration: 0.24 }} />}
            <Utensils size={20} strokeWidth={activeHref === '/nutrition' ? 2.2 : 1.7} />
            <span>Nutrición</span>
          </Link>
          <button data-tour="quick-actions" aria-label="Abrir acciones rápidas" aria-expanded={isQuickActionsOpen} onClick={openQuickActions} className="mobile-action-button -mt-3.5 flex min-w-0 flex-1 flex-col items-center justify-center pb-0.5 text-[10px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-zinc-950 bg-rose-500 shadow-[0_6px_18px_rgba(244,63,94,0.38)] transition-transform active:scale-95">
              <Plus size={22} strokeWidth={2.5} />
            </span>
          </button>
          <Link data-tour="nav-fitness" {...appNavLinkProps('/fitness')} aria-current={activeHref === '/fitness' ? 'page' : undefined} className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-medium leading-none transition-colors ${activeHref === '/fitness' ? '' : 'text-white/55'}`}>
            {activeHref === '/fitness' && <motion.span layoutId="bottom-nav-active" className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-rose-400" transition={{ type: 'spring', bounce: 0.14, duration: 0.24 }} />}
            <Dumbbell size={20} strokeWidth={activeHref === '/fitness' ? 2.2 : 1.7} />
            <span>Fitness</span>
          </Link>
          <Link data-tour="nav-profile" {...appNavLinkProps('/profile')} aria-current={activeHref === '/profile' ? 'page' : undefined} className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-medium leading-none transition-colors ${activeHref === '/profile' ? '' : 'text-white/55'}`}>
            {activeHref === '/profile' && <motion.span layoutId="bottom-nav-active" className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-rose-400" transition={{ type: 'spring', bounce: 0.14, duration: 0.24 }} />}
            <User size={20} strokeWidth={activeHref === '/profile' ? 2.2 : 1.7} />
            <span>Perfil</span>
          </Link>
        </nav>
      )}
    </div>
    </MotionConfig>
  );
}

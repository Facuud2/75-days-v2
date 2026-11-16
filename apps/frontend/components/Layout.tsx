'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useUIStore } from '@/store/useUIStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import dynamic from 'next/dynamic';
import { Home, Calendar, User, Settings, LogOut, Moon, Sun, Flame, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { startCircularReveal } from '@/lib/themeTransition';
import { getLocalDateString } from '@/lib/utils/date';
import HeaderCountdownTimer from '@/components/HeaderCountdownTimer';

// Lazy-loaded modal/sheet components to keep root bundle light (vercel-react-best-practices: bundle-dynamic-imports)
const PlansModal = dynamic(() => import('@/components/PlansModal'), { ssr: false });
const LogMealModal = dynamic(() => import('@/components/LogMealModal'), { ssr: false });
const LogWorkoutModal = dynamic(() => import('@/components/LogWorkoutModal'), { ssr: false });
const QuickActionsSheet = dynamic(() => import('@/components/QuickActionsSheet'), { ssr: false });
const LogoutConfirmSheet = dynamic(() => import('@/components/profile/LogoutConfirmSheet'), { ssr: false });

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout, user } = useAuthStore();
  const { appearance, colorPalette, customPalette, setAppearance, resetTheme } = useThemeStore();
  const {
    openPlansModal,
    openLogMealModal,
    openLogWorkoutModal,
    isPlansModalOpen,
    isLogMealModalOpen,
    isLogWorkoutModalOpen,
    isQuickActionsOpen,
    openQuickActions,
    closeQuickActions,
  } = useUIStore();
  const { difficulty, isActive } = useChallengeStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

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

  // Auth surfaces own the full viewport (safe areas, status bar, scroll) and
  // must not inherit the app header or the padded content shell.
  if (pathname === '/login' || pathname === '/register') {
    return <>{children}</>;
  }

  if (!isAuthenticated && !['/login', '/register', '/onboarding'].includes(pathname)) {
    return <div className="min-h-screen bg-zinc-950 text-white">{children}</div>;
  }

  const toggleTheme = (e: React.MouseEvent) => {
    const nextMode = appearance === 'dark' ? 'light' : 'dark';
    startCircularReveal(e, () => {
      applyAppearanceToDom(nextMode);
      setAppearance(nextMode);
    });
  };


  return (
    <div className="app-shell min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-rose-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>
      {/* Header */}
      <header className="app-header sticky top-0 z-50 border-b px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="text-rose-500" fill="currentColor" />
          <span className="font-bold text-xl tracking-wider hidden sm:inline">75 DAYS</span>
          <span className="text-rose-500 italic font-bold text-xl">
            {isAuthenticated ? (difficulty?.toUpperCase() || 'ACTIVO') : 'APP'}
          </span>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {/* Timer - Only visible if logged in */}
          {isAuthenticated && <HeaderCountdownTimer />}

          {/* Nav - Desktop links (mobile uses bottom nav) + utility controls */}
          <nav className="app-nav flex items-center gap-1 md:gap-2">
            {isAuthenticated && user?.onboardingCompleted && (
              <div data-tour="site-nav" className="hidden lg:flex items-center gap-1 md:gap-2">
                <Link data-tour="nav-home" href="/dashboard" className={`app-header-nav flex flex-col items-center p-2 transition-colors ${pathname === '/dashboard' ? 'is-active' : ''}`}>
                  <Home size={20} strokeWidth={pathname === '/dashboard' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Inicio</span>
                </Link>
                <Link data-tour="nav-calendar" href="/calendar" className={`app-header-nav flex flex-col items-center p-2 transition-colors ${pathname === '/calendar' ? 'is-active' : ''}`}>
                  <Calendar size={20} strokeWidth={pathname === '/calendar' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Calendario</span>
                </Link>
                <button data-tour="quick-actions" aria-label="Abrir acciones rápidas" aria-expanded={isQuickActionsOpen} onClick={openQuickActions} className="app-header-nav flex flex-col items-center rounded-xl p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                  <Plus size={20} strokeWidth={2.2} />

                </button>
                <Link data-tour="nav-profile" href="/profile" className={`app-header-nav flex flex-col items-center p-2 transition-colors ${pathname === '/profile' ? 'is-active' : ''}`}>
                  <User size={20} strokeWidth={pathname === '/profile' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Perfil</span>
                </Link>
                <Link data-tour="nav-settings" href="/settings" className={`app-header-nav flex flex-col items-center p-2 transition-colors ${pathname === '/settings' ? 'is-active' : ''}`}>
                  <Settings size={20} strokeWidth={pathname === '/settings' ? 2.4 : 1.8} />
                  <span className="text-[10px] mt-1 hidden sm:block">Ajustes</span>
                </Link>
              </div>
            )}

            {/* Always visible theme toggle */}
            <button data-tour="theme-toggle" aria-label={appearance === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={(e) => toggleTheme(e)} className="app-header-control inline-flex min-h-11 min-w-11 items-center justify-center transition-colors rounded-full border ml-2 relative overflow-hidden active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400" title={appearance === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}>
              <span className={`block transition-all duration-200 motion-reduce:transition-none ${appearance === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute'}`}>
                <Sun size={18} />
              </span>
              <span className={`block transition-all duration-200 motion-reduce:transition-none ${appearance === 'dark' ? '-rotate-90 scale-0 absolute' : 'rotate-0 scale-100'}`}>
                <Moon size={18} />
              </span>
            </button>

            {/* Logout button: shown next to theme toggle only on Settings */}
            {isAuthenticated && pathname === '/settings' && (
              <button aria-label="Cerrar sesión" onClick={() => setIsLogoutConfirmOpen(true)} className="inline-flex min-h-11 min-w-11 items-center justify-center app-header-control transition-colors rounded-full border ml-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                <LogOut size={18} />
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className={`app-main flex-1 max-w-7xl w-full mx-auto px-4 pt-3 md:p-6 ${isAuthenticated && user?.onboardingCompleted ? 'pb-24 md:pb-6' : 'app-main--no-nav pb-3 md:pb-6'} ${!isAuthenticated ? 'flex items-center justify-center' : ''}`}>
        {children}
      </main>

      {isAuthenticated && isPlansModalOpen && <PlansModal />}
      {isAuthenticated && isLogMealModalOpen && <LogMealModal isOpen={isLogMealModalOpen} onClose={() => { useUIStore.getState().closeLogMealModal(); }} date={getLocalDateString()} onSaved={() => { }} />}
      {isAuthenticated && isLogWorkoutModalOpen && <LogWorkoutModal isOpen={isLogWorkoutModalOpen} onClose={() => { useUIStore.getState().closeLogWorkoutModal(); }} date={getLocalDateString()} onSaved={() => { }} />}
      {isAuthenticated && isQuickActionsOpen && (
        <QuickActionsSheet
          isOpen={isQuickActionsOpen}
          isActive={isActive}
          onClose={closeQuickActions}
          onMeal={openLogMealModal}
          onWorkout={openLogWorkoutModal}
          onPlans={openPlansModal}
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
        <nav data-tour="site-nav" aria-label="Navegación principal" className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around gap-1 border-t border-white/10 px-1 pt-1">
          <Link data-tour="nav-home" href="/dashboard" aria-current={pathname === '/dashboard' ? 'page' : undefined} className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-semibold ${pathname === '/dashboard' ? '' : 'text-white/55'}`}>
            <Home size={22} strokeWidth={pathname === '/dashboard' ? 2.4 : 1.8} />
            <span>Inicio</span>
          </Link>
          <Link data-tour="nav-calendar" href="/calendar" aria-current={pathname === '/calendar' ? 'page' : undefined} className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-semibold ${pathname === '/calendar' ? '' : 'text-white/55'}`}>
            <Calendar size={22} strokeWidth={pathname === '/calendar' ? 2.4 : 1.8} />
            <span>Calendario</span>
          </Link>
          <button data-tour="quick-actions" aria-label="Abrir acciones rápidas" aria-expanded={isQuickActionsOpen} onClick={openQuickActions} className="mobile-action-button -mt-6 flex min-w-0 flex-1 flex-col items-center gap-1 pb-1 text-[11px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-zinc-950 bg-rose-500 shadow-[0_8px_24px_rgba(244,63,94,0.4)] transition-transform active:scale-95">
              <Plus size={28} strokeWidth={2.5} />
            </span>
          </button>
          <Link data-tour="nav-profile" href="/profile" aria-current={pathname === '/profile' ? 'page' : undefined} className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-semibold ${pathname === '/profile' ? '' : 'text-white/55'}`}>
            <User size={22} strokeWidth={pathname === '/profile' ? 2.4 : 1.8} />
            <span>Perfil</span>
          </Link>
          <Link data-tour="nav-settings" href="/settings" aria-current={pathname === '/settings' ? 'page' : undefined} className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-semibold ${pathname === '/settings' ? '' : 'text-white/55'}`}>
            <Settings size={22} strokeWidth={pathname === '/settings' ? 2.4 : 1.8} />
            <span>Ajustes</span>
          </Link>
        </nav>
      )}
    </div>
  );
}

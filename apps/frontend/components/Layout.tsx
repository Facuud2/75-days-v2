'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useUIStore } from '@/store/useUIStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import PlansModal from '@/components/PlansModal';
import { Home, Calendar, User, Settings, LogOut, Moon, Sun, Flame, Target, Trophy, Apple, Dumbbell } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { startCircularReveal } from '@/lib/themeTransition';
import { getLocalDateString } from '@/lib/utils/date';
import LogMealModal from '@/components/LogMealModal';
import LogWorkoutModal from '@/components/LogWorkoutModal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout, user } = useAuthStore();
  const { appearance, colorPalette, customPalette, setAppearance } = useThemeStore();
  const { openPlansModal, openLogMealModal, openLogWorkoutModal, isLogMealModalOpen, isLogWorkoutModalOpen } = useUIStore();
  const { difficulty, isActive } = useChallengeStore();
  const pathname = usePathname();
  const router = useRouter();

  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();

      setTimeLeft({
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Applies dark/light class + data-appearance synchronously on <html> ──────
  // This must run synchronously inside startViewTransition's callback so the API
  // can capture the before/after DOM snapshots and animate between them.
  const applyAppearanceToDom = (mode: typeof appearance) => {
    const root = document.documentElement;
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    isDark ? root.classList.add('dark') : root.classList.remove('dark');
    root.setAttribute('data-appearance', isDark ? 'dark' : 'light');
  };

  // Apply appearance on store changes (covers page load & system changes)
  useEffect(() => {
    applyAppearanceToDom(appearance);
  }, [appearance]);

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
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950 border-b border-white/5 px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="text-rose-500" fill="currentColor" />
          <span className="font-bold text-xl tracking-wider hidden sm:inline">75 DAYS</span>
          <span className="text-rose-500 italic font-bold text-xl">
            {isAuthenticated ? (difficulty?.toUpperCase() || 'ACTIVO') : 'APP'}
          </span>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {/* Timer - Only visible if logged in */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-2 text-sm">
              <div className="flex gap-1">
                <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-rose-500 font-mono">
                  {timeLeft.hours.toString().padStart(2, '0')}
                </span>:
                <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-rose-500 font-mono">
                  {timeLeft.minutes.toString().padStart(2, '0')}
                </span>:
                <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-rose-500 font-mono">
                  {timeLeft.seconds.toString().padStart(2, '0')}
                </span>
              </div>
              <span className="text-white/50 text-xs font-bold tracking-wider ml-2">HASTA RESET</span>
            </div>
          )}

          {/* Nav - Only visible if logged in */}
          <nav className="flex items-center gap-1 md:gap-2">
            {isAuthenticated && user?.onboardingCompleted && (
              <>
                <Link href="/dashboard" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/dashboard' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                  <Home size={20} />
                  <span className="text-[10px] mt-1 hidden sm:block">Inicio</span>
                </Link>
                {isActive && (
                  <Link href="/calendar" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/calendar' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                    <Calendar size={20} />
                    <span className="text-[10px] mt-1 hidden sm:block">Calendario</span>
                  </Link>
                )}
                {!isActive ? (
                  <button onClick={openPlansModal} className={`flex flex-col items-center p-2 transition-colors text-white/50 hover:text-white`}>
                    <Target size={20} />
                    <span className="text-[10px] mt-1 hidden sm:block">Planes</span>
                  </button>
                ) : (
                  <>
                    <button onClick={openLogMealModal} className={`flex flex-col items-center p-2 transition-colors text-white/50 hover:text-white`}>
                      <Apple size={20} />
                      <span className="text-[10px] mt-1 hidden sm:block">Comida</span>
                    </button>
                    <button onClick={openLogWorkoutModal} className={`flex flex-col items-center p-2 transition-colors text-white/50 hover:text-white`}>
                      <Dumbbell size={20} />
                      <span className="text-[10px] mt-1 hidden sm:block">Físico</span>
                    </button>
                  </>
                )}
                <Link href="/profile" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/profile' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                  <User size={20} />
                  <span className="text-[10px] mt-1 hidden sm:block">Perfil</span>
                </Link>
                <Link href="/settings" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/settings' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                  <Settings size={20} />
                  <span className="text-[10px] mt-1 hidden sm:block">Ajustes</span>
                </Link>
              </>
            )}

            {/* Always visible theme toggle */}
            <button onClick={(e) => toggleTheme(e)} className="p-2 text-white/50 hover:text-white transition-colors rounded-full border border-white/10 ml-2 relative overflow-hidden" title={appearance === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}>
              <span className={`block transition-all duration-300 ${appearance === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute'}`}>
                <Sun size={18} />
              </span>
              <span className={`block transition-all duration-300 ${appearance === 'dark' ? '-rotate-90 scale-0 absolute' : 'rotate-0 scale-100'}`}>
                <Moon size={18} />
              </span>
            </button>

            {/* Logout button */}
            {isAuthenticated && (
              <button onClick={() => { logout(); router.push('/login'); }} className="p-2 text-white/50 hover:text-white transition-colors rounded-full border border-white/10 ml-2">
                <LogOut size={18} />
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-24 md:pb-6 ${!isAuthenticated ? 'flex items-center justify-center' : ''}`}>
        {children}
      </main>

      {isAuthenticated && <PlansModal />}
      {isAuthenticated && isLogMealModalOpen && <LogMealModal isOpen={isLogMealModalOpen} onClose={() => { useUIStore.getState().closeLogMealModal(); }} date={getLocalDateString()} onSaved={() => { }} />}
      {isAuthenticated && isLogWorkoutModalOpen && <LogWorkoutModal isOpen={isLogWorkoutModalOpen} onClose={() => { useUIStore.getState().closeLogWorkoutModal(); }} date={getLocalDateString()} onSaved={() => { }} />}

      {/* Mobile Bottom Nav - Only visible if logged in */}
      {isAuthenticated && user?.onboardingCompleted && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-white/5 flex justify-around p-2 z-50">
          <Link href="/dashboard" className={`flex flex-col items-center p-2 ${pathname === '/dashboard' ? 'text-white' : 'text-white/50'}`}>
            <Home size={24} />
          </Link>
          {isActive && (
            <Link href="/calendar" className={`flex flex-col items-center p-2 ${pathname === '/calendar' ? 'text-white' : 'text-white/50'}`}>
              <Calendar size={24} />
            </Link>
          )}
          {!isActive ? (
            <button onClick={openPlansModal} className={`flex flex-col items-center p-2 text-white/50`}>
              <Target size={24} />
            </button>
          ) : (
            <>
              <button onClick={openLogMealModal} className={`flex flex-col items-center p-2 text-white/50`}>
                <Apple size={24} />
              </button>
              <button onClick={openLogWorkoutModal} className={`flex flex-col items-center p-2 text-white/50`}>
                <Dumbbell size={24} />
              </button>
            </>
          )}
          <Link href="/profile" className={`flex flex-col items-center p-2 ${pathname === '/profile' ? 'text-white' : 'text-white/50'}`}>
            <User size={24} />
          </Link>
          <Link href="/settings" className={`flex flex-col items-center p-2 ${pathname === '/settings' ? 'text-white' : 'text-white/50'}`}>
            <Settings size={24} />
          </Link>
        </nav>
      )}
    </div>
  );
}

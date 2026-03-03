'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useUIStore } from '@/store/useUIStore';
import PlansModal from '@/components/PlansModal';
import { Home, Calendar, User, Settings, LogOut, Moon, Sun, Flame, Target, Trophy } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuthStore();
  const { theme, customColors, setTheme } = useThemeStore();
  const { openPlansModal } = useUIStore();
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

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (theme === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  useEffect(() => {
    if (theme === 'custom') {
      document.documentElement.style.setProperty('--color-primary', customColors.primary);
      document.documentElement.style.setProperty('--color-secondary', customColors.secondary);
      document.documentElement.style.setProperty('--color-accent', customColors.accent);
    } else {
      document.documentElement.style.removeProperty('--color-primary');
      document.documentElement.style.removeProperty('--color-secondary');
      document.documentElement.style.removeProperty('--color-accent');
    }
  }, [theme, customColors]);

  if (!isAuthenticated && pathname !== '/login' && pathname !== '/register') {
    return <div className="min-h-screen bg-[#050505] text-white">{children}</div>;
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050505] border-b border-white/5 px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="text-[#f43f5e]" fill="currentColor" />
          <span className="font-bold text-xl tracking-wider hidden sm:inline">75 DAYS</span>
          <span className="text-[#f43f5e] italic font-bold text-xl">HARD</span>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          {/* Timer */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            <div className="flex gap-1">
              <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-[#f43f5e] font-mono">
                {timeLeft.hours.toString().padStart(2, '0')}
              </span>:
              <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-[#f43f5e] font-mono">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </span>:
              <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-[#f43f5e] font-mono">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </span>
            </div>
            <span className="text-white/50 text-xs font-bold tracking-wider ml-2">HASTA RESET</span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1 md:gap-2">
            <Link href="/dashboard" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/dashboard' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
              <Home size={20} />
              <span className="text-[10px] mt-1 hidden sm:block">Inicio</span>
            </Link>
            <button onClick={openPlansModal} className={`flex flex-col items-center p-2 transition-colors text-white/50 hover:text-white`}>
              <Target size={20} />
              <span className="text-[10px] mt-1 hidden sm:block">Planes</span>
            </button>
            <Link href="/profile" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/profile' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
              <Trophy size={20} />
              <span className="text-[10px] mt-1 hidden sm:block">Logros</span>
            </Link>
            <Link href="/settings" className={`flex flex-col items-center p-2 transition-colors ${pathname === '/settings' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
              <User size={20} />
              <span className="text-[10px] mt-1 hidden sm:block">Perfil</span>
            </Link>
            <button onClick={toggleTheme} className="p-2 text-white/50 hover:text-white transition-colors rounded-full border border-white/10 ml-2 hidden sm:block">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => { logout(); router.push('/login'); }} className="p-2 text-white/50 hover:text-white transition-colors rounded-full border border-white/10 ml-2">
              <LogOut size={18} />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-24 md:pb-6">
        {children}
      </main>

      <PlansModal />

      {/* Mobile Bottom Nav (Fallback if needed, though header might be enough) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#050505] border-t border-white/5 flex justify-around p-2 z-50">
        <Link href="/dashboard" className={`flex flex-col items-center p-2 ${pathname === '/dashboard' ? 'text-white' : 'text-white/50'}`}>
          <Home size={24} />
        </Link>
        <button onClick={openPlansModal} className={`flex flex-col items-center p-2 text-white/50`}>
          <Target size={24} />
        </button>
        <Link href="/profile" className={`flex flex-col items-center p-2 ${pathname === '/profile' ? 'text-white' : 'text-white/50'}`}>
          <Trophy size={24} />
        </Link>
        <Link href="/settings" className={`flex flex-col items-center p-2 ${pathname === '/settings' ? 'text-white' : 'text-white/50'}`}>
          <User size={24} />
        </Link>
      </nav>
    </div>
  );
}

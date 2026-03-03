'use client';

import { useThemeStore, ThemeType } from '@/store/useThemeStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Monitor, Palette, LogOut, AlertTriangle, RefreshCw } from 'lucide-react';

export default function Settings() {
  const { theme, customColors, setTheme, setCustomColors } = useThemeStore();
  const { isActive, abandonChallenge } = useChallengeStore();
  const router = useRouter();

  const handleAbandon = () => {
    if (confirm('Are you sure you want to abandon your current challenge? This will reset your streak.')) {
      abandonChallenge();
      router.push('/onboarding');
    }
  };

  const themes: { id: ThemeType; label: string; icon: any }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
    { id: 'custom', label: 'Custom', icon: Palette },
  ];

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Customize your experience</p>
      </header>

      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-100 dark:border-zinc-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-4">Appearance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {themes.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                    theme === t.id
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50'
                      : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Icon size={24} className="mb-2" />
                  <span className="font-medium text-sm">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {theme === 'custom' && (
          <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 animate-in fade-in slide-in-from-top-2">
            <h3 className="font-medium">Custom Colors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Primary</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customColors.primary}
                    onChange={(e) => setCustomColors({ primary: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono uppercase">{customColors.primary}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Secondary</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customColors.secondary}
                    onChange={(e) => setCustomColors({ secondary: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono uppercase">{customColors.secondary}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customColors.accent}
                    onChange={(e) => setCustomColors({ accent: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono uppercase">{customColors.accent}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-100 dark:border-zinc-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-4 text-red-600 dark:text-red-400">Danger Zone</h2>
          {isActive ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Abandoning your challenge will reset your current streak and progress. Your historical data and achievements will be kept.
              </p>
              <button
                onClick={handleAbandon}
                className="flex items-center justify-center w-full md:w-auto px-6 py-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <AlertTriangle size={20} className="mr-2" />
                Abandon Challenge
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You don&apos;t have an active challenge.
              </p>
              <button
                onClick={() => router.push('/onboarding')}
                className="flex items-center justify-center w-full md:w-auto px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                <RefreshCw size={20} className="mr-2" />
                Start New Challenge
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

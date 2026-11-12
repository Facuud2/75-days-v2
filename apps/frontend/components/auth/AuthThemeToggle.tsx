'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/useThemeStore';
import { startCircularReveal } from '@/lib/themeTransition';

/**
 * The auth surface uses the same appearance switch as the app header:
 * a 44px circular button, Sun while dark, Moon while light, and the
 * circular View Transition when the theme changes.
 */
export default function AuthThemeToggle() {
  const { appearance, setAppearance } = useThemeStore();
  const systemDark = useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    () => true,
  );
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const isDark =
    appearance === 'system' ? systemDark : appearance === 'dark';

  const label = !mounted
    ? 'Cambiar tema'
    : isDark
      ? 'Cambiar a modo claro'
      : 'Cambiar a modo oscuro';

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextMode = isDark ? 'light' : 'dark';

    startCircularReveal(event, () => {
      const root = document.documentElement;
      const nextIsDark = nextMode === 'dark';
      root.classList.toggle('dark', nextIsDark);
      root.setAttribute('data-appearance', nextIsDark ? 'dark' : 'light');
      setAppearance(nextMode);
    });
  };

  return (
    <button
      type="button"
      className="auth-theme-toggle"
      onClick={handleToggle}
      aria-label={label}
      title={label}
    >
      <span className="auth-theme-icon" data-icon="sun">
        <Sun size={18} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="auth-theme-icon" data-icon="moon">
        <Moon size={18} strokeWidth={1.75} aria-hidden="true" />
      </span>
    </button>
  );
}

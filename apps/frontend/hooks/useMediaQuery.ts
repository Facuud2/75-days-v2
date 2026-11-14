'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Consulta una media query sin desajustes de hidratación.
 *
 * En el servidor devuelve `false`; tras hidratar se sincroniza con el
 * navegador. Para layout puro conviene combinar esto con CSS, no con JS.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', onStoreChange);
      return () => mediaQueryList.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

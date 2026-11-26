import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export type PageTransitionDirection = 'forward' | 'backward' | 'none';

/**
 * Triggers Next.js App Router navigation directly without blocking the frame
 * in `document.startViewTransition` (which would capture the old DOM twice
 * while `router.push` resolves asynchronously and freeze fixed nav bars).
 * Spatial transitions and instant skeletons are synchronized in `AppLayout`.
 */
export function navigateWithPageTransition(
  router: AppRouterInstance,
  href: string,
  _direction: PageTransitionDirection = 'none',
): void {
  router.push(href);
}

export function getPageTransitionDirection(currentPath: string, nextPath: string): PageTransitionDirection {
  const currentIndex = getPrimaryRouteIndex(currentPath);
  const nextIndex = getPrimaryRouteIndex(nextPath);

  if (currentIndex === null || nextIndex === null || currentIndex === nextIndex) return 'none';
  return nextIndex > currentIndex ? 'forward' : 'backward';
}

function getPrimaryRouteIndex(pathname: string): number | null {
  const route = pathname.split('/')[1];
  const index = ['dashboard', 'nutrition', 'fitness', 'profile'].indexOf(route);
  return index === -1 ? null : index;
}

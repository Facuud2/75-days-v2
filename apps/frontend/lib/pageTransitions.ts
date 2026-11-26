import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export type PageTransitionDirection = 'forward' | 'backward' | 'none';

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

/**
 * Navigate between app routes with a small spatial handoff when the platform
 * supports View Transitions. The callback is intentionally synchronous: the
 * App Router queues the route update while the browser captures both states.
 */
export function navigateWithPageTransition(
  router: AppRouterInstance,
  href: string,
  direction: PageTransitionDirection = 'none',
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    router.push(href);
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startViewTransition = (document as ViewTransitionDocument).startViewTransition;

  if (prefersReducedMotion || typeof startViewTransition !== 'function') {
    router.push(href);
    return;
  }

  const root = document.documentElement;
  if (direction !== 'none') root.dataset.pageNav = direction;

  // `startViewTransition` is a Web IDL method: extracting it loses its
  // required Document receiver in Safari/Chromium.
  const transition = startViewTransition.call(document, () => {
    router.push(href);
  });

  transition.finished
    .catch(() => undefined)
    .finally(() => {
      delete root.dataset.pageNav;
    });
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

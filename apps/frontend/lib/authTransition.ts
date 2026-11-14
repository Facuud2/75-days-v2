import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export type AuthNavDirection = 'forward' | 'backward';

let pendingDirection: AuthNavDirection | null = null;
let pendingUsingViewTransition = false;
let pendingResolve: (() => void) | null = null;
let safetyTimer: number | null = null;

function clearSafetyTimer() {
  if (safetyTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(safetyTimer);
    safetyTimer = null;
  }
}

export function navigateAuthWithTransition(
  router: AppRouterInstance,
  href: string,
  direction: AuthNavDirection
): void {
  if (typeof document === 'undefined') {
    router.push(href);
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canViewTransition =
    !reducedMotion &&
    'startViewTransition' in document &&
    typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function';

  pendingDirection = direction;

  if (!canViewTransition) {
    pendingUsingViewTransition = false;
    router.push(href);
    return;
  }

  // If a previous transition is still pending, resolve it immediately before starting a new one.
  if (pendingResolve) {
    pendingResolve();
    pendingResolve = null;
    clearSafetyTimer();
  }

  const root = document.documentElement;
  root.dataset.authNav = direction;
  pendingUsingViewTransition = true;

  const startVT = (
    document as Document & {
      startViewTransition: (cb: () => Promise<void> | void) => { finished: Promise<void> };
    }
  ).startViewTransition.bind(document);

  const vt = startVT(
    () =>
      new Promise<void>((resolve) => {
        pendingResolve = resolve;
        safetyTimer = window.setTimeout(() => {
          if (pendingResolve) {
            pendingResolve();
            pendingResolve = null;
          }
          safetyTimer = null;
        }, 1200);
        router.push(href);
      })
  );

  vt.finished
    .catch(() => undefined)
    .finally(() => {
      delete root.dataset.authNav;
      pendingUsingViewTransition = false;
    });
}

export function consumeAuthEnterMode(): 'vt' | AuthNavDirection | null {
  const dir = pendingDirection;
  const usingVT = pendingUsingViewTransition;
  pendingDirection = null;
  if (usingVT) return 'vt';
  return dir;
}

export function notifyAuthRouteCommitted(): void {
  if (pendingResolve) {
    clearSafetyTimer();
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve();
  }
}

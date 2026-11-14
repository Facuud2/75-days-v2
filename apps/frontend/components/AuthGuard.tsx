'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

// Public routes that anyone can access, logged in or not.
const PUBLIC_ROUTES =
    process.env.NODE_ENV === 'development'
        ? ['/login', '/register', '/dev/edge-cases', '/dev/profile-edge-cases']
        : ['/login', '/register'];

// Routes that are ONLY for non-authenticated users (e.g., they shouldn't see login if already logged in)
const AUTH_ROUTES = ['/login', '/register'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, token, checkAuth, user, checkOnboardingStatus } = useAuthStore();

    // Manage hydration to prevent layout flashes
    const [isHydrated, setIsHydrated] = useState(false);
    // Track whether we've verified onboarding status from the DB (fresh, not just localStorage)
    const [onboardingChecked, setOnboardingChecked] = useState(false);

    const bootCheckDoneRef = useRef(false);
    const checkedOnboardingUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    // Verify persisted token once on initial hydration (never re-trigger right after login/register).
    useEffect(() => {
        if (!isHydrated || bootCheckDoneRef.current) return;
        bootCheckDoneRef.current = true;
        if (token) {
            checkAuth().catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHydrated, token]);

    // After auth resolves, verify onboarding status once per user session if not already completed.
    useEffect(() => {
        if (!isHydrated) return;

        if (!isAuthenticated) {
            checkedOnboardingUserIdRef.current = null;
            setOnboardingChecked(true);
            return;
        }

        if (user?.onboardingCompleted === true) {
            setOnboardingChecked(true);
            return;
        }

        const sessionKey = user?.id ?? 'authenticated';
        if (checkedOnboardingUserIdRef.current === sessionKey) return;
        checkedOnboardingUserIdRef.current = sessionKey;

        setOnboardingChecked(false);
        checkOnboardingStatus()
            .catch(() => { })
            .finally(() => setOnboardingChecked(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHydrated, isAuthenticated, user?.id, user?.onboardingCompleted]);

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isOnboardingRoute = pathname === '/onboarding';

    const isSessionPending = Boolean(token) && !isAuthenticated;
    // Onboarding writes profile/challenge data and must be authenticated too.
    const isRoutingRestricted = !isPublicRoute && !isAuthenticated && !isSessionPending;
    const isRedundantLogin = isAuthenticated && isAuthRoute;

    // Must complete onboarding: authenticated but onboarding not done (DB-verified), and not already on onboarding page
    const needsOnboarding = isAuthenticated && onboardingChecked && user && user.onboardingCompleted !== true && !isOnboardingRoute;
    // Already onboarded users should not re-enter the onboarding wizard and risk resetting their active challenge
    const isRedundantOnboarding = isAuthenticated && onboardingChecked && user?.onboardingCompleted === true && isOnboardingRoute;

    const shouldShowBoot = isAuthRoute
        ? !isHydrated || isRedundantLogin || isSessionPending
        : !isHydrated || isSessionPending || (isAuthenticated && !onboardingChecked) || isRoutingRestricted || isRedundantLogin || needsOnboarding || isRedundantOnboarding;

    // Route Protection logic that triggers navigation instead of internal state
    useEffect(() => {
        if (!isHydrated) return;

        if (isRoutingRestricted) {
            router.replace('/login');
        } else if (isRedundantLogin || isRedundantOnboarding) {
            router.replace('/dashboard');
        } else if (onboardingChecked && needsOnboarding) {
            router.replace('/onboarding');
        }
    }, [isHydrated, onboardingChecked, isRoutingRestricted, isRedundantLogin, isRedundantOnboarding, needsOnboarding, router]);

    // Prevent flash of protected content while evaluating
    if (shouldShowBoot) {
        if (isAuthRoute) {
            return (
                <div className="auth-boot" aria-busy="true" aria-label="Cargando">
                    <div className="auth-boot-spinner" />
                </div>
            );
        }

        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
            </div>
        );
    }

    return <>{children}</>;
}

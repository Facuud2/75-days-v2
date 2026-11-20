'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import RouteBootSkeleton from '@/components/auth/RouteBootSkeleton';

// Public routes that anyone can access, logged in or not.
const PUBLIC_ROUTES =
    process.env.NODE_ENV === 'development'
        ? ['/', '/login', '/register', '/legal', '/dev/edge-cases', '/dev/profile-edge-cases']
        : ['/', '/login', '/register', '/legal'];

// Routes that are ONLY for non-authenticated users (e.g., they shouldn't see login if already logged in)
const AUTH_ROUTES = ['/login', '/register'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, token, checkAuth, logout, user, checkOnboardingStatus } = useAuthStore();

    // Manage hydration to prevent layout flashes
    const [isHydrated, setIsHydrated] = useState(false);
    // Track whether we've verified onboarding status from the DB (or already verified as completed in store)
    const [onboardingChecked, setOnboardingChecked] = useState(() => user?.onboardingCompleted === true);

    const bootCheckDoneRef = useRef(false);
    const checkedOnboardingUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    // Immediately clear in-memory auth state if any API request receives 401
    // so cached user data is replaced by RouteBootSkeleton during redirect.
    useEffect(() => {
        const handleUnauthorized = () => {
            logout();
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, [logout]);

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

        if (isAuthenticated && !token) {
            logout();
            setOnboardingChecked(true);
            return;
        }

        if (!isAuthenticated || !token) {
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
    }, [isHydrated, isAuthenticated, token, user?.id, user?.onboardingCompleted]);

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isOnboardingRoute = pathname === '/onboarding';

    const hasValidSession = isAuthenticated && Boolean(token);
    const isSessionPending = Boolean(token) && !isAuthenticated;
    // Onboarding writes profile/challenge data and must be authenticated too.
    const isRoutingRestricted = !isPublicRoute && !hasValidSession && !isSessionPending;
    const isRedundantLogin = hasValidSession && isAuthRoute;

    const isOnboardingVerified = onboardingChecked || user?.onboardingCompleted === true;
    // Must complete onboarding: authenticated but onboarding not done (DB-verified), and not already on onboarding page
    const needsOnboarding = hasValidSession && isOnboardingVerified && user && user.onboardingCompleted !== true && !isOnboardingRoute;
    // Already onboarded users should not re-enter the onboarding wizard and risk resetting their active challenge
    const isRedundantOnboarding = hasValidSession && isOnboardingVerified && user?.onboardingCompleted === true && isOnboardingRoute;

    const shouldShowBoot = isAuthRoute
        ? !isHydrated || isRedundantLogin || isSessionPending
        : !isHydrated || isSessionPending || (hasValidSession && !isOnboardingVerified) || isRoutingRestricted || isRedundantLogin || needsOnboarding || isRedundantOnboarding;

    // Route Protection logic that triggers navigation instead of internal state
    useEffect(() => {
        if (!isHydrated) return;

        if (isRoutingRestricted) {
            router.replace('/login');
        } else if (isRedundantLogin || isRedundantOnboarding) {
            router.replace('/dashboard');
        } else if (isOnboardingVerified && needsOnboarding) {
            router.replace('/onboarding');
        }
    }, [isHydrated, isOnboardingVerified, isRoutingRestricted, isRedundantLogin, isRedundantOnboarding, needsOnboarding, router]);

    // Prevent flash of protected content while evaluating
    if (shouldShowBoot) {
        return <RouteBootSkeleton pathname={pathname} />;
    }

    return <div className="boot-content-reveal">{children}</div>;
}

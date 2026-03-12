'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

// Public routes that anyone can access, logged in or not.
const PUBLIC_ROUTES = ['/login', '/register', '/dashboard'];

// Routes that are ONLY for non-authenticated users (e.g., they shouldn't see login if already logged in)
const AUTH_ROUTES = ['/login', '/register'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, checkAuth, isLoading, user, checkOnboardingStatus } = useAuthStore();

    // Manage hydration to prevent layout flashes
    const [isHydrated, setIsHydrated] = useState(false);
    // Track whether we've verified onboarding status from the DB (fresh, not just localStorage)
    const [onboardingChecked, setOnboardingChecked] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setIsHydrated(true), 0);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (isHydrated) {
            checkAuth().catch(() => { });
        }
        // checkAuth is excluded intentionally: it's stable in zustand but changes reference on each render.
        // We only want to re-run this when hydration status changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHydrated]);

    // After auth resolves (user is authenticated), fetch the real onboardingCompleted value
    // directly from the DB so we don't rely on potentially stale localStorage.
    useEffect(() => {
        if (!isHydrated) return;

        if (isAuthenticated && !isLoading) {
            checkOnboardingStatus()
                .catch(() => { })
                .finally(() => setOnboardingChecked(true));
        } else if (!isAuthenticated && !isLoading) {
            // Not authenticated — no onboarding check needed
            setOnboardingChecked(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, isLoading, isHydrated]);

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isOnboardingRoute = pathname === '/onboarding';

    const isRoutingRestricted = !isPublicRoute && !isOnboardingRoute && !isAuthenticated;
    const isRedundantLogin = isAuthenticated && isAuthRoute;

    // Must complete onboarding: authenticated but onboarding not done (DB-verified), and not already on onboarding page
    const needsOnboarding = isAuthenticated && onboardingChecked && user && user.onboardingCompleted !== true && !isOnboardingRoute;

    // Route Protection logic that triggers navigation instead of internal state
    useEffect(() => {
        if (!isHydrated || isLoading || !onboardingChecked) return;

        if (isRoutingRestricted) {
            router.replace('/login');
        } else if (isRedundantLogin) {
            router.replace('/dashboard');
        } else if (needsOnboarding) {
            router.replace('/onboarding');
        }
    }, [isHydrated, isLoading, onboardingChecked, isRoutingRestricted, isRedundantLogin, needsOnboarding, router]);

    // Prevent flash of protected content while evaluating
    if (!isHydrated || isLoading || !onboardingChecked || isRoutingRestricted || isRedundantLogin || needsOnboarding) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
            </div>
        );
    }

    return <>{children}</>;
}

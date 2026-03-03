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
    const { isAuthenticated, checkAuth, isLoading } = useAuthStore();

    // Manage hydration to prevent layout flashes
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setIsHydrated(true), 0);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (isHydrated) {
            checkAuth().catch(() => { });
        }
    }, [isHydrated, checkAuth]);

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isRoutingRestricted = !isPublicRoute && !isAuthenticated;
    const isRedundantLogin = isAuthenticated && isAuthRoute;

    // Route Protection logic that triggers navigation instead of internal state
    useEffect(() => {
        if (!isHydrated || isLoading) return;

        if (isRoutingRestricted) {
            router.replace('/login');
        } else if (isRedundantLogin) {
            router.replace('/dashboard');
        }
    }, [isHydrated, isLoading, isRoutingRestricted, isRedundantLogin, router]);

    // Prevent flash of protected content while evaluating
    if (!isHydrated || isLoading || isRoutingRestricted || isRedundantLogin) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
            </div>
        );
    }

    return <>{children}</>;
}

'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import RouteBootSkeleton from '@/components/auth/RouteBootSkeleton';

export default function Home() {
  const { isAuthenticated, token } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const redirect = () => {
      const state = useAuthStore.getState();
      if (state.isAuthenticated) {
        router.replace('/dashboard');
      } else if (!state.token) {
        router.replace('/login');
      }
    };

    if (useAuthStore.persist?.hasHydrated?.()) {
      redirect();
      return;
    }

    const unsub = useAuthStore.persist?.onFinishHydration?.(redirect);
    return () => unsub?.();
  }, [isAuthenticated, token, router]);

  return <RouteBootSkeleton pathname="/dashboard" />;
}

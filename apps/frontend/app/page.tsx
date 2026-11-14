'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-12 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-4"></div>
        <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
      </div>
    </div>
  );
}

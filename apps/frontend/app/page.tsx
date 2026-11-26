'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, CheckCircle2, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import RouteBootSkeleton from '@/components/auth/RouteBootSkeleton';

export default function Home() {
  const { isAuthenticated, token, user } = useAuthStore();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(() =>
    Boolean(useAuthStore.persist?.hasHydrated?.())
  );

  useEffect(() => {
    const syncHydration = () => {
      setHydrated(true);
      const state = useAuthStore.getState();
      if (state.isAuthenticated) {
        router.replace(state.user?.onboardingCompleted ? '/dashboard' : '/onboarding');
      }
    };

    if (useAuthStore.persist?.hasHydrated?.()) {
      syncHydration();
      return;
    }

    const unsub = useAuthStore.persist?.onFinishHydration?.(syncHydration);
    return () => unsub?.();
  }, [isAuthenticated, token, user, router]);

  if (!hydrated || isAuthenticated) {
    return <RouteBootSkeleton pathname="/dashboard" />;
  }

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-10"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
            <Flame className="w-7 h-7 text-rose-500" fill="currentColor" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-rose-500">
              75 Days Challenge
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Construí tu rutina saludable, día a día
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Un espacio simple para cuidarte durante 75 días a tu propio ritmo, sin formularios eternos ni distracciones.
            </p>
          </div>
        </div>

        <ul
          className="rounded-2xl border p-5 space-y-3.5 text-sm"
          style={{
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <li className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <span>
              <strong className="font-semibold">Simple desde el día 1:</strong> elegís tu nivel (Soft, Medium, Hard o propio) y marcás tus hábitos diarios en segundos.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <span>
              <strong className="font-semibold">A tu medida:</strong> sin presiones; podés omitir datos personales si todavía no querés compartirlos.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <span>
              <strong className="font-semibold">Progreso claro:</strong> seguí tu racha y tu mapa de 75 días con total privacidad.
            </span>
          </li>
        </ul>

        <div className="space-y-3">
          <Link
            href="/register"
            className="w-full min-h-[48px] rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>Empezar mi desafío</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full min-h-[48px] rounded-2xl border font-semibold text-sm flex items-center justify-center transition-colors"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            Ya tengo cuenta · Iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}

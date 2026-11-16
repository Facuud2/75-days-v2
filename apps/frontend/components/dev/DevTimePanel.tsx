'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, RotateCcw, Trophy, FastForward, Rewind, Loader2 } from 'lucide-react';
import { devService, type TimeTravelFillMode } from '@/lib/api/dev';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useHealthStore } from '@/store/useHealthStore';
import { useAuthStore } from '@/store/useAuthStore';

const FILL_MODES: { value: TimeTravelFillMode; label: string }[] = [
  { value: 'success', label: 'Completar días' },
  { value: 'fail', label: 'Dejar sin hacer (fail)' },
  { value: 'none', label: 'Solo mover fecha' },
];

/**
 * Solo dev: panel flotante para simular el paso del tiempo (avanzar/retroceder
 * días, completar los 75 días o reiniciar la cuenta desde cero contra la DB local).
 * Nunca debe renderizarse ni importarse en producción.
 */
export default function DevTimePanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [fillMode, setFillMode] = useState<TimeTravelFillMode>('success');
  const [confirmReset, setConfirmReset] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const isActive = useChallengeStore((s) => s.isActive);
  const currentDay = useChallengeStore((s) => s.currentDay);
  const streak = useChallengeStore((s) => s.streak);
  const fetchCurrentChallenge = useChallengeStore((s) => s.fetchCurrentChallenge);

  useEffect(() => {
    if (!open) {
      setConfirmReset(false);
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (process.env.NODE_ENV !== 'development') return null;

  const runAction = async (key: string, fn: () => Promise<void>, message?: string) => {
    setBusyAction(key);
    setFeedback(null);
    try {
      await fn();
      if (message) setFeedback(message);
    } catch (err: any) {
      setFeedback(err?.message || 'Error ejecutando acción dev');
    } finally {
      setBusyAction(null);
    }
  };

  const handleTimeTravel = (days: number) =>
    runAction(
      `travel-${days}`,
      async () => {
        await devService.timeTravel(days, fillMode);
        await fetchCurrentChallenge();
      },
      days > 0 ? `+${days}d aplicado` : `${days}d aplicado`
    );

  const handleComplete75 = () =>
    runAction(
      'complete-75',
      async () => {
        await devService.completeChallenge();
        await fetchCurrentChallenge();
      },
      'Desafío completado (Día 75/75)'
    );

  const handleResetAccount = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    runAction('reset', async () => {
      await devService.resetAccount(true);
      useChallengeStore.getState().reset();
      useQuestStore.getState().reset();
      useHealthStore.getState().reset();
      await useAuthStore.getState().checkAuth();
      setOpen(false);
      router.push('/onboarding');
    });
  };

  const busy = busyAction !== null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="dev-time-panel"
        aria-label="Debug de tiempo y cuenta"
        onClick={() => setOpen((prev) => !prev)}
        className={`
          flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-lg
          transition-[background-color,border-color,color,box-shadow] duration-200 ease-out
          active:scale-[0.97]
          ${open
            ? 'border-sky-500 bg-zinc-900 text-white ring-2 ring-sky-500/40'
            : 'border-zinc-600 bg-zinc-900/95 text-zinc-300 hover:text-white'}
        `}
      >
        {busy ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-sky-400" />
        ) : (
          <Clock className="size-4 shrink-0 text-sky-400" />
        )}
        <span className="tabular-nums">
          {isActive ? `Día ${currentDay}/75` : 'Sin reto'}
        </span>
      </button>

      {open && (
        <div
          id="dev-time-panel"
          role="region"
          aria-label="Debug de tiempo y cuenta"
          className="
            absolute bottom-[calc(100%+0.5rem)] right-0 w-72 max-w-[calc(100vw-2rem)]
            origin-bottom-right rounded-2xl border border-white/10 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur
            animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200 ease-out
          "
        >
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              dev · tiempo y cuenta
            </p>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-300 tabular-nums">
              {isActive ? `Racha ${streak}d` : 'Inactivo'}
            </span>
          </div>

          {/* Modo al avanzar */}
          <label className="mb-2 block">
            <span className="mb-1 block text-[11px] text-zinc-400">Al avanzar días:</span>
            <select
              value={fillMode}
              disabled={busy}
              onChange={(e) => setFillMode(e.target.value as TimeTravelFillMode)}
              className="w-full rounded-xl border border-white/10 bg-zinc-800/90 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500"
            >
              {FILL_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {/* Botones de salto temporal */}
          <div className="mb-2.5 grid grid-cols-4 gap-1.5">
            <button
              type="button"
              disabled={!isActive || busy}
              onClick={() => handleTimeTravel(-1)}
              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              <Rewind className="size-3" />
              -1d
            </button>
            <button
              type="button"
              disabled={!isActive || busy}
              onClick={() => handleTimeTravel(1)}
              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              +1d
              <FastForward className="size-3" />
            </button>
            <button
              type="button"
              disabled={!isActive || busy}
              onClick={() => handleTimeTravel(7)}
              className="rounded-xl border border-white/10 bg-white/5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              +7d
            </button>
            <button
              type="button"
              disabled={!isActive || busy}
              onClick={() => handleTimeTravel(30)}
              className="rounded-xl border border-white/10 bg-white/5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              +30d
            </button>
          </div>

          {/* Acciones de ciclo de vida */}
          <div className="space-y-1.5 border-t border-white/10 pt-2.5">
            <button
              type="button"
              disabled={!isActive || busy}
              onClick={handleComplete75}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40"
            >
              <Trophy className="size-3.5" />
              Completar 75 días
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleResetAccount}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
                confirmReset
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
              }`}
            >
              <RotateCcw className="size-3.5" />
              {confirmReset ? 'Confirmar reinicio total' : 'Reiniciar cuenta desde cero'}
            </button>
          </div>

          {feedback && (
            <p className="mt-2 text-center text-[11px] text-zinc-400">{feedback}</p>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

const subscribeNoop = () => () => {};
const getWakeLockSupported = () =>
  typeof navigator !== 'undefined' && 'wakeLock' in navigator;
const getServerWakeLockSupported = () => false;

/**
 * Keeps the mobile screen awake during an active gym workout session using
 * the standard Screen Wake Lock API, automatically re-acquiring on tab return.
 */
export function useWakeLock(enabled: boolean) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const isSupported = useSyncExternalStore(
    subscribeNoop,
    getWakeLockSupported,
    getServerWakeLockSupported
  );
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      if (!enabled || cancelled) return;
      try {
        const wakeLockApi = (navigator as unknown as {
          wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
        }).wakeLock;
        const sentinel = await wakeLockApi.request('screen');
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        setIsActive(true);
        sentinel.addEventListener?.('release', () => {
          setIsActive(false);
        });
      } catch {
        setIsActive(false);
      }
    };

    const release = async () => {
      if (sentinelRef.current) {
        const current = sentinelRef.current;
        sentinelRef.current = null;
        await current.release().catch(() => {});
      }
      setIsActive(false);
    };

    if (enabled) {
      void acquire();
    } else {
      void release();
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) {
        void acquire();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void release();
    };
  }, [enabled]);

  return { isSupported, isActive };
}

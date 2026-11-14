import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore, User } from '@/store/useAuthStore';
import { authService } from '@/lib/api/auth';
import { baseRequest } from '@/lib/api/base';

const mockUser: User = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  registeredAt: '2026-01-01T00:00:00.000Z',
  onboardingCompleted: true,
};

describe('useAuthStore session & logout race safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('logout clears isLoading, error, token, user, and isAuthenticated', () => {
    useAuthStore.setState({
      user: mockUser,
      token: 'jwt-123',
      isAuthenticated: true,
      isLoading: true,
      error: 'stale error',
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('ignores stale checkAuth resolution after logout', async () => {
    let resolveGetMe!: (value: { user: User }) => void;
    vi.spyOn(authService, 'getMe').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetMe = resolve;
        })
    );

    useAuthStore.setState({
      user: mockUser,
      token: 'jwt-123',
      isAuthenticated: true,
      isLoading: false,
    });

    const pendingCheck = useAuthStore.getState().checkAuth();
    expect(useAuthStore.getState().isLoading).toBe(true);

    // User logs out while checkAuth is still in flight
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);

    // Stale checkAuth resolves later
    resolveGetMe({ user: mockUser });
    await pendingCheck;

    const finalState = useAuthStore.getState();
    expect(finalState.isAuthenticated).toBe(false);
    expect(finalState.user).toBeNull();
    expect(finalState.token).toBeNull();
  });

  it('ignores stale checkOnboardingStatus resolution after logout', async () => {
    let resolveOnboarding!: (value: { onboardingCompleted: boolean }) => void;
    vi.spyOn(authService, 'getOnboardingStatus').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOnboarding = resolve;
        })
    );

    useAuthStore.setState({
      user: { ...mockUser, onboardingCompleted: false },
      token: 'jwt-123',
      isAuthenticated: true,
    });

    const pendingOnboarding = useAuthStore.getState().checkOnboardingStatus();
    useAuthStore.getState().logout();

    resolveOnboarding({ onboardingCompleted: true });
    const result = await pendingOnboarding;

    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('clears session on 401 but preserves authenticated session on transient network error', async () => {
    useAuthStore.setState({
      user: mockUser,
      token: 'jwt-123',
      isAuthenticated: true,
    });

    vi.spyOn(authService, 'getMe').mockRejectedValueOnce(new Error('Network timeout'));
    await useAuthStore.getState().checkAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);

    const err401 = Object.assign(new Error('Unauthorized'), { status: 401 });
    vi.spyOn(authService, 'getMe').mockRejectedValueOnce(err401);
    await useAuthStore.getState().checkAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('baseRequest rejects on timeout instead of hanging indefinitely', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const abortErr = new Error('Aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          })
      )
    );

    await expect(baseRequest('/auth/me', { timeoutMs: 25 })).rejects.toThrow(
      'La solicitud tardó demasiado'
    );
  });
});

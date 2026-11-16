import { apiClient } from './client';
import type { SideQuest, SideQuestTemplate } from '@/store/useQuestStore';
import { userService, type UserProfileResponse } from './users';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useHealthStore } from '@/store/useHealthStore';

export interface CoreSyncBundle {
  syncVersion?: number;
  challenge: any | null;
  quests: SideQuest[];
  availableQuests: SideQuestTemplate[];
  profile?: UserProfileResponse | null;
}

export const syncService = {
  getCoreSync: (includeProfile = false) => {
    const timezoneOffset = new Date().getTimezoneOffset();
    return apiClient<CoreSyncBundle>(
      `/sync?timezoneOffset=${timezoneOffset}&includeProfile=${includeProfile ? 'true' : 'false'}`
    );
  },
};

/**
 * Fase 2 (Patrón /api/sync de appManifestV2):
 * Sincroniza en 1 único round-trip HTTP el reto activo (con daily reset ya
 * aplicado en servidor), las misiones del usuario, el catálogo de misiones y
 * opcionalmente el perfil + logros. Si el endpoint unificado no está disponible
 * (p. ej. en mocks de tests E2E que solo interceptan rutas individuales), cae
 * automáticamente al flujo clásico en paralelo.
 */
export async function syncCoreStores(options?: {
  includeProfile?: boolean;
}): Promise<{ usedSyncEndpoint: boolean }> {
  const includeProfile = Boolean(options?.includeProfile);
  try {
    const bundle = await syncService.getCoreSync(includeProfile);
    if (bundle && bundle.syncVersion === 1) {
      useChallengeStore.getState().hydrateFromSync(bundle.challenge);
      useQuestStore
        .getState()
        .hydrateFromSync(bundle.quests || [], bundle.availableQuests || []);
      if (includeProfile && bundle.profile) {
        useHealthStore.getState().hydrateProfileFromSync(bundle.profile);
      }
      return { usedSyncEndpoint: true };
    }
  } catch (error: any) {
    if (includeProfile && (error?.status === 401 || error?.status === 403)) {
      useHealthStore.setState({
        authBlocked: true,
        hasLoadedProfile: true,
        isLoadingProfile: false,
      });
      return { usedSyncEndpoint: false };
    }
    // Fallback below when /api/sync is not mocked or returns an error
  }

  await Promise.allSettled([
    useChallengeStore.getState().fetchCurrentChallenge(),
    useChallengeStore.getState().checkDailyReset(),
    useQuestStore.getState().fetchQuests(),
    useQuestStore.getState().fetchAvailableQuests(),
    includeProfile
      ? userService
          .getProfile()
          .then((data) => {
            useHealthStore.getState().hydrateProfileFromSync(data);
          })
          .catch((error) => {
            if (error?.status === 401 || error?.status === 403) {
              useHealthStore.setState({
                authBlocked: true,
                hasLoadedProfile: true,
                isLoadingProfile: false,
              });
              return;
            }
            useHealthStore.setState({
              profileError: 'No pudimos cargar tu perfil.',
              hasLoadedProfile: true,
              isLoadingProfile: false,
            });
          })
      : Promise.resolve(),
  ]);

  return { usedSyncEndpoint: false };
}

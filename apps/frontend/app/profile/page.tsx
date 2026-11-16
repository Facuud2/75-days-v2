'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  LogOut,
} from 'lucide-react';

import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import type { Goal } from '@/store/useChallengeStore';
import { useQuestStore } from '@/store/useQuestStore';
import type { SideQuest } from '@/store/useQuestStore';
import { useHealthStore } from '@/store/useHealthStore';
import { useUIStore } from '@/store/useUIStore';
import { healthService, Meal } from '@/lib/api/health';
import { getLocalDateString } from '@/lib/utils/date';
import {
  formatDecimal,
  formatMemberSince,
  formatNumber,
  safeNumber,
} from '@/lib/utils/display';

import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileSection from '@/components/profile/ProfileSection';
import ProfileChallenges from '@/components/profile/ProfileChallenges';
import ProfileHealth from '@/components/profile/ProfileHealth';
import ProfileAchievements from '@/components/profile/ProfileAchievements';
import ProfileEditMenu from '@/components/profile/ProfileEditMenu';
import ProfileSkeleton from '@/components/profile/ProfileSkeleton';
import { readDevDataset } from '@/components/dev/DevDatasetPicker';
import type { DevDataset } from '@/components/dev/DevDatasetPicker';
import { buildDevProfileData, DEV_PROFILE_NAME } from '@/components/dev/profileFixtures';

// Chrome de desarrollo: en producción el fragmento no se renderiza y el chunk
// del selector no se referencia en el HTML servido.
const DevDatasetPicker = dynamic(() => import('@/components/dev/DevDatasetPicker'), { ssr: false });

// Lazy-loaded modal & sheet components (vercel-react-best-practices: bundle-dynamic-imports)
const ActivitiesSheet = dynamic(() => import('@/components/profile/ActivitiesSheet'), { ssr: false });
const AchievementsSheet = dynamic(() => import('@/components/profile/AchievementsSheet'), { ssr: false });
const LogoutConfirmSheet = dynamic(() => import('@/components/profile/LogoutConfirmSheet'), { ssr: false });
const EditProfileSheet = dynamic(() => import('@/components/EditProfileSheet'), { ssr: false });
const LogMealModal = dynamic(() => import('@/components/LogMealModal'), { ssr: false });
const EditMealModal = dynamic(() => import('@/components/EditMealModal'), { ssr: false });
const LogWorkoutModal = dynamic(() => import('@/components/LogWorkoutModal'), { ssr: false });
const SideQuestDetailModal = dynamic(() => import('@/components/SideQuestDetailModal'), { ssr: false });
const SideQuestsModal = dynamic(() => import('@/components/SideQuestsModal'), { ssr: false });

const IS_DEV_BUILD = process.env.NODE_ENV === 'development';
import type {
  AvailableQuestSummary,
  ChallengeSummary,
  HealthSummary,
  MealSummary,
  ProfileAchievement,
  QuestSummary,
  WorkoutSummary,
} from '@/components/profile/types';

import type { ProfileEditMode } from '@/components/EditProfileSheet';

function getBmiLabel(bmi: number | null): string {
  if (bmi === null || bmi <= 0) return 'Sin datos';
  if (bmi < 18.5) return 'Bajo peso';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidad';
}

function toQuestSummary(quest: SideQuest): QuestSummary {
  return {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    difficulty: quest.difficulty,
    durationDays: quest.durationDays,
    icon: quest.icon,
    progress: safeNumber(quest.progress) ?? 0,
    completed: quest.completed,
    completionCount: safeNumber(quest.completionCount) ?? 0,
  };
}

export default function Profile() {
  const router = useRouter();
  const { user, logout, updateProfile: updateAuthUser } = useAuthStore();
  const {
    isActive,
    difficulty,
    streak,
    currentDay,
    points,
    challengesCompleted,
    logs,
    customGoalsTemplate,
    fetchCurrentChallenge,
  } = useChallengeStore();
  const { openPlansModal } = useUIStore();

  const {
    quests,
    availableQuests,
    fetchQuests,
    fetchAvailableQuests,
    subscribeToQuest,
  } = useQuestStore();

  const {
    profileData,
    dailyStatsByDate,
    recentWorkouts,
    isStravaConnected,
    hasLoadedProfile,
    hasLoadedStats,
    profileError,
    authBlocked,
    fetchProfileBundle,
    fetchCatalogIfNeeded,
    applyOptimisticProfilePatch,
    setStravaConnected,
  } = useHealthStore();

  const today = getLocalDateString();
  const dailyStats = dailyStatsByDate[today] ?? null;

  const [syncingStrava, setSyncingStrava] = useState(false);
  const [stravaError, setStravaError] = useState<string | null>(null);
  const [challengeReady, setChallengeReady] = useState(() =>
    Boolean(isActive || Object.keys(logs).length > 0 || hasLoadedProfile)
  );

  const [profileEditMode, setProfileEditMode] = useState<ProfileEditMode | null>(null);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [isActivitiesSheetOpen, setIsActivitiesSheetOpen] = useState(false);
  const [isAchievementsSheetOpen, setIsAchievementsSheetOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isSideQuestsModalOpen, setIsSideQuestsModalOpen] = useState(false);

  const [isLogMealModalOpen, setIsLogMealModalOpen] = useState(false);
  const [isLogWorkoutModalOpen, setIsLogWorkoutModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<any | null>(null);
  const [selectedSideQuest, setSelectedSideQuest] = useState<SideQuest | null>(null);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);
  const [devDataset, setDevDataset] = useState<DevDataset>(() => readDevDataset());

  const fetchProfile = useCallback(() => {
    if (!user) return;
    const currentDayKey = getLocalDateString();
    void fetchProfileBundle(currentDayKey);
    void fetchCatalogIfNeeded();
  }, [user, fetchProfileBundle, fetchCatalogIfNeeded]);

  useEffect(() => {
    // F-04: todos estos fetches son independientes — lanzarlos en paralelo (Stale-While-Revalidate).
    Promise.allSettled([
      fetchProfile(),
      fetchCurrentChallenge().finally(() => setChallengeReady(true)),
      fetchQuests(),
      fetchAvailableQuests(),
    ]);

    // Manejo de callbacks de Strava OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('strava') === 'success') {
      setStravaConnected(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('strava') === 'error') {
      setStravaError('No pudimos conectar con Strava.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchProfile, fetchCurrentChallenge, fetchQuests, fetchAvailableQuests, setStravaConnected]);

  const handleConnectStrava = async () => {
    try {
      const { url } = await healthService.getStravaAuthUrl();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get Strava auth URL', error);
      setStravaError('No pudimos iniciar la conexión con Strava.');
    }
  };

  const handleSyncStrava = async () => {
    if (syncingStrava) return;
    setSyncingStrava(true);
    setStravaError(null);
    try {
      const result = await healthService.syncStravaWorkouts();
      fetchProfile();
      toast.success(result.message);
    } catch (error) {
      console.error('Error syncing strava', error);
      toast.error('No pudimos sincronizar los entrenamientos.');
    } finally {
      setSyncingStrava(false);
    }
  };

  const handleSubscribe = (quest: AvailableQuestSummary) => {
    if (subscribingTo !== null) return;
    setSubscribingTo(quest.title);
    toast.success(`Te suscribiste a ${quest.title}.`);
    void subscribeToQuest(quest.title, quest.difficulty, quest.durationDays)
      .then(() => {
        const error = useQuestStore.getState().error;
        if (error) toast.error('No pudimos suscribirte a la actividad.');
      })
      .finally(() => {
        setSubscribingTo(null);
      });
  };

  const handleOpenQuest = (quest: QuestSummary) => {
    const fullQuest = quests.find((item) => item.id === quest.id);
    setIsActivitiesSheetOpen(false);
    if (fullQuest) setSelectedSideQuest(fullQuest);
  };

  const handleCreateCustom = () => {
    setIsActivitiesSheetOpen(false);
    setIsSideQuestsModalOpen(true);
  };

  const handleEditSelect = (mode: ProfileEditMode) => {
    setIsEditMenuOpen(false);
    setProfileEditMode(mode);
  };

   const handleLogout = () => {
     setIsLogoutConfirmOpen(false);
     logout();
     toast.success('Sesión cerrada correctamente.');
     router.replace('/login');
   };

  const level = Math.floor((safeNumber(points) ?? 0) / 100) + 1;
  const memberSince = formatMemberSince(profileData?.user.registeredAt);

  const todayGoals: Goal[] =
    logs[today]?.goals ??
    customGoalsTemplate.map((goal, index) => ({
      ...goal,
      id: `template-${index}`,
      completed: false,
    }));

  const currentWeight =
    safeNumber(profileData?.user.currentWeight) ?? safeNumber(user?.weight) ?? null;
  const initialWeight = safeNumber(profileData?.user.initialWeight) ?? null;
  const goalWeight =
    safeNumber(profileData?.user.targetWeight) ?? safeNumber(user?.targetWeight) ?? null;
  // Negativo = el usuario subió de peso. `ProfileHealth` decide el tono y el
  // texto ("ganados") a partir del signo; clampear a 0 ocultaba la subida.
  const weightLost =
    safeNumber(profileData?.stats?.totalWeightLost) ??
    (initialWeight !== null && currentWeight !== null
      ? initialWeight - currentWeight
      : null);
  // Distancia a la meta en cualquier dirección: alguien por debajo de su meta
  // (p. ej. ganando masa muscular) también tiene kilómetros por recorrer.
  const toGoal =
    goalWeight !== null && currentWeight !== null
      ? Math.abs(currentWeight - goalWeight)
      : null;

  const heightMeters =
    (safeNumber(profileData?.user.height) ?? safeNumber(user?.height) ?? 0) / 100;
  const bmi =
    heightMeters > 0 && currentWeight !== null
      ? Number((currentWeight / (heightMeters * heightMeters)).toFixed(1))
      : null;

  const weightHistory = useMemo(
    () =>
      (profileData?.user.weightHistory || [])
        .map((point) => ({ date: point.date, weight: safeNumber(point.weight) }))
        .filter((point): point is { date: string; weight: number } => point.weight !== null),
    [profileData?.user.weightHistory],
  );
   // F-07: combinar iteraciones sobre quests en un solo pase + Set para O(1) lookup.
   const { activeQuests, completedQuests, activeTitles } = useMemo(() => {
     const active: typeof quests = [];
     const completed: typeof quests = [];
     (quests || []).forEach((q) => (q.completed ? completed : active).push(q));
     const titles = new Set(active.map((q) => q.title));
     return { activeQuests: active, completedQuests: completed, activeTitles: titles };
   }, [quests]);

   const availableToSubscribe = useMemo(
     () => (availableQuests || []).filter((q) => !activeTitles.has(q.title)),
     [availableQuests, activeTitles],
   );

  const achievements = (profileData?.achievements || []) as ProfileAchievement[];
  const unlockedAchievements = (achievements || []).filter((achievement) => achievement.unlocked).length;

  const challengeData: ChallengeSummary = {
    isActive,
    difficulty,
    currentDay: safeNumber(currentDay) ?? 0,
    streak: safeNumber(streak) ?? 0,
    challengesCompleted: safeNumber(challengesCompleted) ?? 0,
    todayGoals: todayGoals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      completed: goal.completed,
      icon: goal.icon,
    })),
    activeQuests: activeQuests.map(toQuestSummary),
    completedQuestsCount: completedQuests.length,
  };

  const healthData: HealthSummary = {
    currentWeight,
    initialWeight,
    goalWeight,
    weightLost,
    toGoal,
    bmi,
    bmiLabel: getBmiLabel(bmi),
    weightHistory,
    nutrition: dailyStats
      ? {
          consumed: safeNumber(dailyStats.consumed) ?? 0,
          dailyGoal: safeNumber(dailyStats.dailyGoal) ?? 0,
          remainingToGoal: safeNumber(dailyStats.remainingToGoal) ?? 0,
          macros: {
            proteinG: safeNumber(dailyStats.macros?.proteinG) ?? 0,
            carbG: safeNumber(dailyStats.macros?.carbG) ?? 0,
            fatG: safeNumber(dailyStats.macros?.fatG) ?? 0,
            goals: dailyStats.macros?.goals
              ? {
                  proteinG: safeNumber(dailyStats.macros.goals.proteinG) ?? 0,
                  carbG: safeNumber(dailyStats.macros.goals.carbG) ?? 0,
                  fatG: safeNumber(dailyStats.macros.goals.fatG) ?? 0,
                }
              : undefined,
          },
          meals: (dailyStats.meals || []).map((meal) => ({
            id: meal.id,
            mealType: meal.mealType,
            name: meal.name,
            calories: safeNumber(meal.calories) ?? 0,
            proteinG: safeNumber(meal.proteinG) ?? 0,
            carbG: safeNumber(meal.carbG) ?? 0,
            fatG: safeNumber(meal.fatG) ?? 0,
          })),
        }
      : null,
    workouts: (recentWorkouts || []).map((workout) => ({
      id: workout.id,
      sport: workout.sport || 'Entrenamiento',
      notes: workout.notes ?? null,
      durationMin: safeNumber(workout.durationMin),
      caloriesBurned: safeNumber(workout.caloriesBurned),
      distanceKm: safeNumber(workout.distanceKm),
    })),
    isStravaConnected,
    todayWorkoutMinutes: safeNumber(dailyStats?.totalWorkoutMin),
  };

  // El fixture entra en el mismo punto donde se arma el dato: los componentes
  // de perfil reciben props de la misma forma, sin saber cuál está activo.
  // `challengeData` / `healthData` / `achievements` se recalculan en cada render
  // (dependen de la API y del store), así que no hay nada que memoizar aquí:
  // `buildDevProfileData` devuelve la misma referencia con `demo`.
  const devFixture = buildDevProfileData(devDataset, {
    challenge: challengeData,
    health: healthData,
    achievements,
  });
  const activeChallenge = IS_DEV_BUILD ? devFixture.challenge : challengeData;
  const activeHealth = IS_DEV_BUILD ? devFixture.health : healthData;
  const activeAchievements = IS_DEV_BUILD ? devFixture.achievements : achievements;
  const isDevDataset = IS_DEV_BUILD && devDataset !== 'demo';
  const unlockedCount = (activeAchievements || []).filter((achievement) => achievement.unlocked).length;
  const displayName = isDevDataset && devDataset === 'worst' ? DEV_PROFILE_NAME : user?.name ?? '';

  const handleEditMeal = (meal: MealSummary) => {
    setEditingMeal(meal as Meal);
  };

  const handleEditWorkout = (workout: WorkoutSummary) => {
    setEditingWorkout(workout);
    setIsLogWorkoutModalOpen(true);
  };

  const retosSummary = activeChallenge.isActive
    ? `Día ${formatNumber(activeChallenge.currentDay)}/75`
    : 'Sin reto activo';
  const saludSummary = [
    activeHealth.currentWeight !== null ? `${formatDecimal(activeHealth.currentWeight)} kg` : null,
    dailyStats ? `${formatNumber(activeHealth.nutrition?.consumed ?? dailyStats.consumed)} kcal` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const logrosSummary = `${formatNumber(unlockedCount)}/${formatNumber(activeAchievements.length)}`;

  const headerLoading = !hasLoadedProfile && !profileData;
  const isInitialLoading = !user || headerLoading || !challengeReady || authBlocked;

  if (isInitialLoading) return <ProfileSkeleton />;

  return (
    <div className="pv2-page mx-auto w-full max-w-6xl pb-6">
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ProfileHeader
            name={displayName}
            avatarUrl={user.avatarUrl}
            bannerUrl={user.bannerUrl}
            level={level}
            memberSince={memberSince}
            quote={user.profileQuote}
            onEdit={() => setIsEditMenuOpen(true)}
            onAvatar={() => setProfileEditMode('avatar')}
            onBanner={() => setProfileEditMode('banner')}
            loading={headerLoading}
          />
        </aside>

        <div className="mt-3 space-y-3 lg:mt-0">
          {profileError && !profileData ? (
            <div className="pv2-card p-4" role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={18}
                  strokeWidth={1.5}
                  className="mt-0.5 shrink-0"
                  style={{ color: 'var(--status-danger)' }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {profileError}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Revisa tu conexión e inténtalo de nuevo.
                  </p>
                  <button type="button" onClick={fetchProfile} className="pv2-ghost mt-3">
                    Reintentar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <ProfileSection
            id="retos"
            index="01"
            title="Retos"
            summary={retosSummary}
            defaultOpen
          >
            <ProfileChallenges
              data={activeChallenge}
              loading={!challengeReady}
              onContinue={() => router.push('/dashboard')}
              onStartChallenge={openPlansModal}
              onDiscoverActivities={() => setIsActivitiesSheetOpen(true)}
              onOpenQuest={handleOpenQuest}
            />
          </ProfileSection>

          <ProfileSection
            id="salud"
            index="02"
            title="Salud"
            summary={saludSummary || 'Sin datos'}
          >
            <ProfileHealth
              data={activeHealth}
              loading={headerLoading}
              loadingNutrition={!hasLoadedStats}
              onLogMeal={() => setIsLogMealModalOpen(true)}
              onEditMeal={handleEditMeal}
              onLogWorkout={() => {
                setEditingWorkout(null);
                setIsLogWorkoutModalOpen(true);
              }}
              onEditWorkout={handleEditWorkout}
              onConnectStrava={handleConnectStrava}
              onSyncStrava={handleSyncStrava}
              syncingStrava={syncingStrava}
              stravaError={stravaError}
            />
          </ProfileSection>

          <ProfileSection
            id="logros"
            index="03"
            title="Logros"
            summary={activeAchievements.length > 0 ? `${logrosSummary} desbloqueados` : 'Sin logros'}
          >
            <ProfileAchievements
              achievements={activeAchievements}
              loading={headerLoading}
              onOpenAll={() => setIsAchievementsSheetOpen(true)}
            />
          </ProfileSection>

          <footer className="pt-2">
            <div className="pv2-card overflow-hidden">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(true)}
                className="pv2-row pv2-row--interactive"
                style={{ color: 'var(--status-danger)' }}
              >
                <LogOut size={18} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-sm font-medium">Cerrar sesión</span>
              </button>
            </div>
          </footer>
        </div>
      </div>

      {/* break-ui · selector de datasets (sólo dev) */}
      {IS_DEV_BUILD && (
        <DevDatasetPicker
          selected={devDataset}
          onSelect={setDevDataset}
          positionClassName="bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6"
        />
      )}

      <ProfileEditMenu
        open={isEditMenuOpen}
        onClose={() => setIsEditMenuOpen(false)}
        onSelect={handleEditSelect}
      />

      {isActivitiesSheetOpen && (
        <ActivitiesSheet
          open={isActivitiesSheetOpen}
          onClose={() => setIsActivitiesSheetOpen(false)}
          activeQuests={activeQuests.map(toQuestSummary)}
          completedQuests={completedQuests.map(toQuestSummary)}
          availableQuests={availableToSubscribe}
          onSubscribe={handleSubscribe}
          subscribingTo={subscribingTo}
          onOpenQuest={handleOpenQuest}
          onCreateCustom={handleCreateCustom}
        />
      )}

      {isAchievementsSheetOpen && (
        <AchievementsSheet
          open={isAchievementsSheetOpen}
          onClose={() => setIsAchievementsSheetOpen(false)}
          achievements={achievements}
        />
      )}

      {isLogoutConfirmOpen && (
        <LogoutConfirmSheet
          open={isLogoutConfirmOpen}
          onClose={() => setIsLogoutConfirmOpen(false)}
          onConfirm={handleLogout}
        />
      )}

      {profileEditMode ? (
        <EditProfileSheet
          mode={profileEditMode}
          onClose={() => setProfileEditMode(null)}
          onSaved={(updated) => {
            updateAuthUser({
              ...(updated.name !== undefined && { name: updated.name }),
              ...(updated.avatarUrl !== undefined && { avatarUrl: updated.avatarUrl }),
              ...(updated.bannerUrl !== undefined && { bannerUrl: updated.bannerUrl }),
              ...(updated.profileQuote !== undefined && { profileQuote: updated.profileQuote }),
              ...(updated.email !== undefined && { email: updated.email }),
              ...(updated.age !== undefined && { age: updated.age }),
              ...(updated.weight !== undefined && { weight: updated.weight }),
              ...(updated.targetWeight !== undefined && { targetWeight: updated.targetWeight }),
              ...(updated.height !== undefined && { height: updated.height }),
            });
            applyOptimisticProfilePatch(updated);
          }}
          initialValues={{
            name: user.name,
            avatarUrl: user.avatarUrl,
            bannerUrl: user.bannerUrl,
            profileQuote: user.profileQuote,
            level,
            registeredAt: profileData?.user.registeredAt ?? user.registeredAt,
          }}
        />
      ) : null}

      {isLogMealModalOpen && (
        <LogMealModal
          isOpen={isLogMealModalOpen}
          onClose={() => setIsLogMealModalOpen(false)}
          date={today}
          onSaved={() => {}}
        />
      )}

      {editingMeal && (
        <EditMealModal
          isOpen={!!editingMeal}
          meal={editingMeal}
          date={today}
          onClose={() => setEditingMeal(null)}
          onSaved={() => {
            setEditingMeal(null);
          }}
        />
      )}

      {isLogWorkoutModalOpen && (
        <LogWorkoutModal
          isOpen={isLogWorkoutModalOpen}
          onClose={() => {
            setIsLogWorkoutModalOpen(false);
            setEditingWorkout(null);
          }}
          date={today}
          initialData={editingWorkout}
          onDelete={() => {
            setEditingWorkout(null);
          }}
          onSaved={() => {
            setEditingWorkout(null);
          }}
        />
      )}

      {isSideQuestsModalOpen ? (
        <SideQuestsModal
          onClose={() => {
            setIsSideQuestsModalOpen(false);
          }}
        />
      ) : null}

      {selectedSideQuest ? (
        <SideQuestDetailModal quest={selectedSideQuest} onClose={() => setSelectedSideQuest(null)} />
      ) : null}
    </div>
  );
}

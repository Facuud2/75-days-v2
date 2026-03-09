'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useQuestStore } from '@/store/useQuestStore';
import { userService, UserProfileResponse } from '@/lib/api/users';
import { healthService, DailyStats } from '@/lib/api/health';
import { format } from 'date-fns';
import { Trophy, Calendar, Scale, Award, Flame, Target, ChevronRight, CheckCircle2, Lock, Activity, BarChart3, Footprints, Clock, Zap, Pencil, PieChart as PieChartIcon, RefreshCw, Sun, Moon, Dumbbell, Book, Droplet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, Legend } from 'recharts';
import AchievementsModal from '@/components/AchievementsModal';
import EditProfileModal from '@/components/EditProfileModal';
import LogMealModal from '@/components/LogMealModal';
import EditMealModal from '@/components/EditMealModal';
import LogWorkoutModal from '@/components/LogWorkoutModal';
import { Meal } from '@/lib/api/health';

const iconMap: Record<string, any> = {
  droplet: Droplet,
  dumbbell: Dumbbell,
  book: Book,
  sun: Sun,
  moon: Moon,
  target: Target,
};

export default function Profile() {
  const { user, updateProfile: updateAuthUser } = useAuthStore();
  const {
    isActive,
    difficulty,
    streak,
    currentDay,
    points,
    achievements,
    bestWeight,
    challengesCompleted,
    sideQuests
  } = useChallengeStore();

  const {
    quests,
    availableQuests,
    fetchQuests,
    fetchAvailableQuests,
    subscribeToQuest,
    progressQuest
  } = useQuestStore();

  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isLogMealModalOpen, setIsLogMealModalOpen] = useState(false);
  const [isLogWorkoutModalOpen, setIsLogWorkoutModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<any | null>(null);

  // Strava State
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [syncingStrava, setSyncingStrava] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);

  const fetchProfile = useCallback(() => {
    if (user) {
      const today = format(new Date(), 'yyyy-MM-dd');
      Promise.all([
        userService.getProfile(),
        healthService.getDailyStats(today).catch(() => null),
        healthService.getStravaStatus().catch(() => ({ connected: false })),
        healthService.getWorkoutsForDay(today).catch(() => ({ workouts: [] }))
      ])
        .then(([profile, healthData, stravaStatus, workoutsData]) => {
          setProfileData(profile);
          setDailyStats(healthData);
          setIsStravaConnected(stravaStatus.connected);
          setRecentWorkouts(workoutsData?.workouts || []);
          setLoadingProfile(false);
        })
        .catch(err => {
          console.error('Error fetching data:', err);
          setLoadingProfile(false);
        });
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
    fetchQuests();
    fetchAvailableQuests();

    // Check for OAuth callbacks in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('strava') === 'success') {
      setIsStravaConnected(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('strava') === 'error') {
      setAuthError('Error al conectar con Strava');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchProfile, fetchQuests, fetchAvailableQuests]);

  const handleConnectStrava = async () => {
    try {
      const { url } = await healthService.getStravaAuthUrl();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get Strava auth URL', error);
      setAuthError('No se pudo iniciar la conexión con Strava.');
    }
  };

  const handleSyncStrava = async () => {
    if (syncingStrava) return;
    setSyncingStrava(true);
    try {
      const result = await healthService.syncStravaWorkouts();
      // Refetch profile to update stats (assuming workouts affect daily stats if today)
      fetchProfile();
      alert(result.message);
    } catch (error) {
      console.error('Error syncing strava', error);
      alert('Error sincronizando entrenamientos.');
    } finally {
      setSyncingStrava(false);
    }
  };

  const handleSubscribe = async (title: string, difficulty: string, durationDays: number) => {
    setSubscribingTo(title);
    try {
      await subscribeToQuest(title, difficulty, durationDays);
    } finally {
      setSubscribingTo(null);
    }
  };

  if (!user || loadingProfile) return <div className="p-8 text-center text-zinc-400 min-h-screen bg-zinc-950">Cargando perfil...</div>;

  const mockWeightLost = Number((profileData?.stats.totalWeightLost || 0).toFixed(2));
  const mockChallengesCount = profileData?.stats.totalChallengesCompleted || 0;
  const mockTotalDays = profileData?.stats.totalDaysCompleted || 0;

  const mockInitialWeight = profileData?.user.initialWeight || 0;
  const mockGoalWeight = profileData?.user.targetWeight || 0;
  const mockCurrentWeight = profileData?.user.currentWeight || user?.weight || 0;

  // Only calculate "to lose" if a goal is set and we're above it
  const mockToLose = mockGoalWeight > 0
    ? Math.max(0, mockCurrentWeight - mockGoalWeight).toFixed(1)
    : "0.0";

  // Macros Pie Chart Data
  const macrosData = dailyStats && dailyStats.macros ? [
    { name: 'Proteínas', value: dailyStats.macros.proteinG, color: '#3b82f6' }, // Blue
    { name: 'Carbos', value: dailyStats.macros.carbG, color: '#f59e0b' },    // Yellow
    { name: 'Grasas', value: dailyStats.macros.fatG, color: '#ef4444' }       // Red
  ] : [];
  const hasMacros = macrosData.some(m => m.value > 0);

  const weightHistoryData = profileData?.user.weightHistory || [];

  // Keeping these at 0 since there are no fields yet for this
  const mockWeeklyWorkouts = 0;
  const mockWeeklyCals = 0;
  const mockWeeklyHours = 0;

  const mockTotalDistance = 0;
  const mockTotalHours = 0;
  const mockTotalCals = 0;

  const mockHeightMeters = (profileData?.user.height || user?.height || 0) / 100;
  const mockBMI = mockHeightMeters > 0 ? Number((mockCurrentWeight / (mockHeightMeters * mockHeightMeters)).toFixed(1)) : 0;

  const getBMICategory = (bmi: number) => {
    if (bmi === 0) return { label: 'Sin datos', color: 'text-zinc-500', bg: 'bg-zinc-800' };
    if (bmi < 18.5) return { label: 'Bajo peso', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (bmi < 25) return { label: 'Normal', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (bmi < 30) return { label: 'Sobrepeso', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    return { label: 'Obesidad', color: 'text-red-400', bg: 'bg-red-500/20' };
  };
  const bmiCategory = getBMICategory(mockBMI);

  const mockCompletedChallenges: any[] = [];
  const achievementsList = profileData?.achievements || [];
  const unlockedAchievementsCount = achievementsList.filter(a => a.unlocked).length;
  const achievementsPercentage = achievementsList.length > 0 ? Math.round((unlockedAchievementsCount / achievementsList.length) * 100) : 0;

  const level = Math.floor(points / 100) + 1;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in bg-zinc-950 min-h-screen text-zinc-100 font-sans">

      {/* 1. Header Profile Card */}
      <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-center md:items-stretch gap-8 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-900/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        {/* User Info Left */}
        <div className="flex items-center gap-6 flex-1">
          <div className="relative">
            {/* Avatar placeholder - replacing image with styled circle for consistent UI */}
            <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-center text-4xl font-bold uppercase shadow-2xl relative overflow-hidden">
              {user.name.charAt(0)}
              <div className="absolute inset-0 bg-rose-500 mt-auto h-2"></div>
            </div>
          </div>

          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{user.name}</h1>
              <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-md border border-rose-500/30">
                Nivel {level}
              </span>
            </div>
            <p className="text-zinc-400 text-sm">
              Miembro desde {format(new Date(user.registeredAt), 'MMMM yyyy')}
            </p>
          </div>
        </div>

        {/* Key Stats Right */}
        <div className="flex flex-wrap md:flex-nowrap gap-3 md:gap-4 justify-center md:justify-end">
          {/* Edit Profile Button */}
          <button
            onClick={() => setIsEditProfileModalOpen(true)}
            className="bg-zinc-950/50 border border-zinc-800 hover:border-rose-500/50 p-4 rounded-xl flex flex-col items-center justify-center min-w-[100px] group transition-colors cursor-pointer"
          >
            <Pencil className="w-6 h-6 text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold group-hover:text-rose-400 transition-colors">Editar</span>
            <span className="text-xs text-zinc-500">Perfil</span>
          </button>

          <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center min-w-[100px]">
            <Flame className="w-6 h-6 text-orange-500 mb-2" />
            <span className="text-xl font-bold">{streak} días</span>
            <span className="text-xs text-zinc-500">Racha Actual</span>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center min-w-[100px]">
            <Calendar className="w-6 h-6 text-rose-500 mb-2" />
            <span className="text-xl font-bold">{mockTotalDays}</span>
            <span className="text-xs text-zinc-500">Días Totales</span>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center min-w-[100px]">
            <Activity className="w-6 h-6 text-green-500 mb-2" />
            <span className="text-xl font-bold">{mockWeightLost} kg</span>
            <span className="text-xs text-zinc-500">Peso Perdido</span>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center min-w-[100px]">
            <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
            <span className="text-xl font-bold">{mockChallengesCount}</span>
            <span className="text-xs text-zinc-500">Desafíos</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column - Main Content (Spans 2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Challenge Banner */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-rose-400 w-5 h-5" />
              <h2 className="text-lg font-semibold">Desafíos</h2>
              <span className="text-sm text-zinc-500 ml-auto">{mockChallengesCount} completados · {isActive ? '1' : '0'} en progreso</span>
            </div>

            {isActive ? (
              <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔥</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">Desafío 75 {difficulty?.toUpperCase() || 'HARD'}</h3>
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-xs font-medium rounded">En Progreso</span>
                      </div>
                      <p className="text-zinc-400 text-sm mt-1">75 días de entrenamiento diario, dieta estricta, sin alcohol, leer 10 páginas</p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar inside Active Challenge */}
                <div className="space-y-2 mt-4">
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(100, (currentDay / 75) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-end text-xs text-zinc-500 font-medium">
                    {currentDay}/75 días
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-5 text-center text-zinc-400">
                No hay ningún desafío activo en este momento.
              </div>
            )}

            {/* Completed Challenges Grid */}
            <div className="mt-8">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Completados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockCompletedChallenges.map((challenge, i) => (
                  <div key={i} className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{challenge.icon}</span>
                        <span className="font-semibold text-sm flex-1 truncate">{challenge.title}</span>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-2">{challenge.desc}</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium mt-4 block">{challenge.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Achievements Section */}
          <div
            className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 cursor-pointer hover:border-zinc-700 transition-colors group relative overflow-hidden"
            onClick={() => setIsAchievementsModalOpen(true)}
          >
            {/* Subtle interactive hover highlight */}
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

            <div className="flex items-center text-zinc-100 justify-between mb-6 pb-4 border-b border-zinc-800/50 relative z-10">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500/20 p-2 rounded-lg">
                  <Award className="text-yellow-500 w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold leading-tight group-hover:text-yellow-400 transition-colors flex items-center gap-2">
                    Logros <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h2>
                  <p className="text-sm text-zinc-400">{unlockedAchievementsCount} de {achievementsList.length} desbloqueados</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold">{achievementsPercentage}%</span>
                <p className="text-xs text-zinc-500">Completado</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {achievementsList.slice(0, 4).map((ach) => (
                <div key={ach.id} className={`p-4 rounded-xl border flex gap-4 ${ach.unlocked
                  ? 'bg-zinc-950/40 border-zinc-800'
                  : 'bg-zinc-950/20 border-zinc-800/40 opacity-70'
                  }`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl shadow-inner ${ach.color}`}>
                    {ach.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <h4 className="font-semibold text-sm truncate">{ach.title}</h4>
                      {ach.unlocked && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-1 mb-2">{ach.description}</p>

                    {ach.unlocked ? (
                      <span className="text-[10px] text-yellow-500/80 font-medium">
                        Desbloqueado {ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : ''}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 mt-auto">
                        <span className="text-[10px] text-zinc-500">Progreso</span>
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-zinc-600 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${Math.min(100, (ach.progress / ach.total) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500">{ach.progress} / {ach.total}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {achievementsList.length > 4 && (
              <div className="mt-4 text-center text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                Haz clic para ver los {achievementsList.length} logros
              </div>
            )}
          </div>

          {/* Dynamic Activities Section */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-900/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

            <div className="flex items-center text-zinc-100 justify-between mb-8 relative z-10 border-b border-zinc-800/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-2 rounded-lg">
                  <Target className="text-emerald-500 w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold leading-tight">Actividades Dinámicas</h2>
                  <p className="text-sm text-zinc-400">Misiones secundarias para potenciar tu progreso</p>
                </div>
              </div>
            </div>

            <div className="space-y-8 relative z-10">
              {/* Suscribed Quests */}
              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
                  Mis Actividades
                </h3>

                {quests.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {quests.map(quest => {
                      const IconComponent = Trophy;
                      return (
                        <div
                          key={quest.id}
                          onClick={() => !quest.completed && progressQuest(quest.id)}
                          className={`group border rounded-xl p-4 flex items-center gap-4 transition-all duration-300 ${quest.completed
                            ? 'border-emerald-500/30 bg-emerald-500/5 cursor-default'
                            : 'border-zinc-800/80 bg-zinc-950/40 hover:border-emerald-500/50 hover:bg-zinc-900/60 cursor-pointer active:scale-[0.99]'
                            }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${quest.completed
                            ? 'bg-emerald-500/20 text-emerald-500'
                            : 'bg-zinc-800/80 text-emerald-500/70 group-hover:text-emerald-500'
                            }`}>
                            <IconComponent size={20} strokeWidth={1.5} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1 gap-2">
                              <h3 className={`font-semibold text-sm truncate transition-colors ${quest.completed ? 'text-zinc-500 line-through' : 'text-zinc-200 group-hover:text-white'}`}>
                                {quest.title}
                              </h3>
                              {quest.completed && (
                                <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0">
                                  Completada
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                                Nivel: <span className={
                                  quest.difficulty === 'Easy' ? 'text-emerald-400' :
                                    quest.difficulty === 'Medium' ? 'text-amber-400' : 'text-red-400'
                                }>{quest.difficulty === 'Easy' ? 'Fácil' : quest.difficulty === 'Medium' ? 'Medio' : 'Difícil'}</span>
                              </span>
                            </div>

                            {!quest.completed && (
                              <div className="flex items-center gap-2 mt-3">
                                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                                    style={{ width: `${(quest.progress / quest.durationDays) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-zinc-500 whitespace-nowrap font-medium">{quest.progress} / {quest.durationDays}</span>
                              </div>
                            )}
                          </div>

                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ease-out ${quest.completed
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-zinc-700/50 group-hover:border-emerald-500/50'
                            }`}>
                            {quest.completed && <CheckCircle2 size={12} className="text-zinc-950" strokeWidth={4} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-zinc-950/30 rounded-xl border border-dashed border-zinc-800/80">
                    <p className="text-sm text-zinc-500">Aún no te has suscrito a ninguna actividad.</p>
                    <p className="text-xs text-zinc-600 mt-1">Explora las misiones disponibles abajo y comienza una nueva.</p>
                  </div>
                )}
              </div>

              {/* Available Quests */}
              <div className="pt-2">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-rose-500/70" />
                  Nuevas Actividades Disponibles
                </h3>

                {(() => {
                  const activeQuestTitles = quests.filter(q => !q.completed).map(q => q.title);
                  const availableToSubscribe = availableQuests.filter(q => !activeQuestTitles.includes(q.title));

                  if (availableToSubscribe.length === 0) {
                    return (
                      <div className="text-center py-6 bg-zinc-950/30 rounded-xl border border-dashed border-zinc-800/80">
                        <Trophy className="mx-auto w-8 h-8 text-yellow-500/40 mb-2" />
                        <p className="text-sm text-zinc-400">¡Has completado o tienes activas todas las misiones!</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableToSubscribe.map(quest => {
                        const IconComponent = quest.icon ? iconMap[quest.icon] : Trophy;
                        const isSubscribing = subscribingTo === quest.title;

                        return (
                          <div key={quest.title} className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col hover:border-zinc-700/80 transition-colors group">
                            <div className="flex items-start gap-3 mb-2">
                              <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 group-hover:text-rose-400 transition-colors shrink-0">
                                <IconComponent size={20} strokeWidth={1.5} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-semibold text-sm truncate text-zinc-200 group-hover:text-white transition-colors">{quest.title}</h4>
                                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${quest.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-500' :
                                    quest.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                                      'bg-red-500/10 text-red-500'
                                    }`}>
                                    {quest.difficulty === 'Easy' ? 'Fácil' : quest.difficulty === 'Medium' ? 'Medio' : 'Difícil'}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{quest.description}</p>
                                <div className="text-[10px] font-semibold text-zinc-600 mt-2 bg-zinc-900 inline-block px-1.5 py-0.5 rounded">
                                  {quest.durationDays} Días
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleSubscribe(quest.title, quest.difficulty, quest.durationDays)}
                              disabled={subscribingTo !== null}
                              className="mt-3 w-full py-2 bg-rose-500/10 text-rose-500 text-xs font-bold rounded-lg hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 flex items-center justify-center h-8"
                            >
                              {isSubscribing ? (
                                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                              ) : (
                                'Suscribirse'
                              )}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column - Sidebar Widgets (Spans 1 col) */}
        <div className="space-y-6">

          {/* Weight Progress Widget */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
            <h3 className="text-sm font-semibold flex items-center justify-between mb-4 text-zinc-300">
              <span className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-green-400" />
                Progreso de Peso
              </span>
              {mockBMI > 0 && (
                <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${bmiCategory.bg} ${bmiCategory.color}`}>
                  IMC: {mockBMI} ({bmiCategory.label})
                </div>
              )}
            </h3>
            <div className="mb-6">
              <div className="text-3xl font-bold">{mockCurrentWeight} kg</div>
              <div className="text-sm text-green-400 font-medium mt-1">↓ {mockWeightLost} kg total</div>
            </div>

            {/* Dynamic Graph Line using Recharts */}
            <div className="w-full h-32 flex items-end mb-6 relative -ml-2">
              {weightHistoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightHistoryData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-rose-500)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-rose-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: 'var(--color-rose-500)', fontWeight: 'bold' }}
                      labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                      formatter={(value: number | undefined) => [`${value} kg`, 'Peso Registrado']}
                    />
                    {mockInitialWeight > 0 && (
                      <ReferenceLine y={mockInitialWeight} stroke="#a1a1aa" strokeDasharray="3 3" opacity={0.5} />
                    )}
                    <Area type="monotone" dataKey="weight" name="Peso (kg)" stroke="var(--color-rose-500)" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" activeDot={{ r: 6, fill: 'var(--color-rose-500)', stroke: '#18181b', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs text-center px-4">
                  Registra tu peso diariamente para ver tu progreso aquí.
                </div>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b border-zinc-800/50 pb-2">
                <span className="text-zinc-400">Peso Inicial</span>
                <span className="font-medium">{mockInitialWeight.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800/50 pb-2">
                <span className="text-zinc-400">Meta Final</span>
                <span className="font-medium text-rose-400">{mockGoalWeight.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-zinc-400">Por Perder</span>
                <span className="font-medium flex items-center gap-1">
                  {mockToLose === "0.0" ? <span className="text-green-500">0 kg <CheckCircle2 className="w-3 h-3 inline" /></span> : `${mockToLose} kg`}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Nutrition Widget */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-zinc-300">
                <PieChartIcon className="w-4 h-4 text-orange-400" />
                Nutrición de Hoy
              </h3>
              <button
                onClick={() => setIsLogMealModalOpen(true)}
                className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors"
              >
                + Registrar
              </button>
            </div>

            {dailyStats ? (
              <div className="space-y-6">
                {/* Calories Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">Consumido</div>
                    <div className="font-bold text-orange-400">{dailyStats.consumed} kcal</div>
                  </div>
                  <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">Restante</div>
                    <div className="font-bold text-green-400">{dailyStats.remainingToGoal > 0 ? dailyStats.remainingToGoal : 0} kcal</div>
                  </div>
                </div>

                {/* Progress Bar for Calories */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>0</span>
                    <span>Meta: {dailyStats.dailyGoal} kcal</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${dailyStats.consumed > dailyStats.dailyGoal ? 'bg-red-500' : 'bg-orange-500'}`}
                      style={{ width: `${Math.min(100, (dailyStats.consumed / (dailyStats.dailyGoal || 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Macros Donut Chart */}
                <div className="pt-2">
                  <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider text-center">Macronutrientes</h4>
                  {hasMacros ? (
                    <div className="h-48 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={macrosData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {macrosData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: any) => [`${value}g`, '']}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center absolute text */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8 text-center pt-[15px]">
                        <span className="text-lg font-bold text-zinc-300">{(macrosData[0].value * 4 + macrosData[1].value * 4 + macrosData[2].value * 9).toFixed(0)} <br /><span className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">kcal</span></span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-24 bg-zinc-950/50 rounded-xl border border-zinc-800 flex items-center justify-center text-xs text-zinc-500 text-center px-4 mt-4">
                      No has registrado comidas hoy.
                    </div>
                  )}
                </div>

                {/* Registered Meals Feed */}
                <div className="pt-2 border-t border-zinc-800/80">
                  <h4 className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Últimas Comidas</h4>

                  {(!dailyStats.meals || dailyStats.meals.length === 0) ? (
                    <div className="text-center text-xs text-zinc-500 py-4 bg-zinc-950/30 rounded-lg">
                      No hay registros
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dailyStats.meals.map(meal => (
                        <button
                          key={meal.id}
                          onClick={() => setEditingMeal(meal)}
                          className="w-full text-left flex justify-between items-center bg-zinc-950/40 border border-zinc-800/50 p-3 rounded-xl hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors group cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors">{meal.name}</span>
                            <span className="text-[10px] text-zinc-500 uppercase font-medium">{meal.mealType} • {meal.proteinG}g P, {meal.carbG}g C, {meal.fatG}g G</span>
                          </div>
                          <div className="text-sm font-bold text-orange-400 flex items-center gap-2">
                            {meal.calories} <span className="text-[10px] text-zinc-500 font-normal">kcal</span>
                            <Pencil className="w-3 h-3 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-zinc-500 py-8 bg-zinc-950/50 rounded-xl border border-zinc-800">
                Información nutricional no disponible.
              </div>
            )}
          </div>

          {/* Sports Activity Widget */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-zinc-300">
                <Footprints className="w-4 h-4 text-[#fc4c02]" />
                Actividad Deportiva
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingWorkout(null);
                    setIsLogWorkoutModalOpen(true);
                  }}
                  className="text-xs font-bold text-zinc-400 hover:text-white transition-colors flex items-center gap-1 bg-zinc-800/50 px-2 py-1.5 rounded-md border border-zinc-700/50"
                  title="Registrar Actividad Manual"
                >
                  + Registrar
                </button>
                {isStravaConnected ? (
                  <button
                    onClick={handleSyncStrava}
                    disabled={syncingStrava}
                    className="text-xs font-bold text-zinc-400 hover:text-white transition-colors flex items-center gap-1 bg-zinc-800/50 px-2 py-1.5 rounded-md border border-zinc-700/50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingStrava ? 'animate-spin' : ''}`} />
                    {syncingStrava ? 'Sincronizando...' : 'Strava'}
                  </button>
                ) : (
                  <button
                    onClick={handleConnectStrava}
                    className="text-xs font-bold text-[#fc4c02] hover:text-[#e34402] transition-colors flex items-center gap-1"
                  >
                    + Conectar Strava
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {!isStravaConnected ? (
                <div className="bg-zinc-950/50 rounded-xl p-4 text-center border border-zinc-800 border-dashed">
                  <p className="text-xs text-zinc-400 mb-3">Conecta tu cuenta de Strava para sincronizar tus entrenamientos automáticamente.</p>
                  <div className="flex justify-center flex-col items-center gap-2">
                    {authError && <p className="text-xs text-red-400 font-semibold mb-1">{authError}</p>}
                    <button
                      onClick={handleConnectStrava}
                      className="px-4 py-2 bg-[#fc4c02]/10 hover:bg-[#fc4c02]/20 text-[#fc4c02] border border-[#fc4c02]/30 text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                      </svg>
                      Conectar con Strava
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="pt-2 border-t border-zinc-800/80">
                <h4 className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Historial Reciente</h4>
                {!recentWorkouts || recentWorkouts.length === 0 ? (
                  <div className="text-center text-xs text-zinc-500 py-4 bg-zinc-950/30 rounded-lg">
                    No hay entrenamientos registrados hoy.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentWorkouts.map((workout: any, i: number) => (
                      <button
                        key={workout.id || i}
                        onClick={() => {
                          setEditingWorkout(workout);
                          setIsLogWorkoutModalOpen(true);
                        }}
                        className="w-full text-left flex justify-between items-center bg-zinc-950/40 border border-zinc-800/50 p-3 rounded-xl hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors group"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">{workout.notes || workout.sport}</span>
                          <span className="text-[10px] text-zinc-500 uppercase font-medium">
                            {workout.sport} • {workout.durationMin} min
                          </span>
                        </div>
                        <div className="text-sm font-bold text-[#fc4c02] flex items-center gap-1">
                          {workout.caloriesBurned ? Math.round(workout.caloriesBurned) : 0} <span className="text-[10px] text-zinc-500 font-normal">kcal</span>
                          {workout.distanceKm && workout.distanceKm > 0 && (
                            <span className="text-[10px] text-zinc-400 font-normal ml-1">({workout.distanceKm} km)</span>
                          )}
                          <Pencil className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Global Stats Widget
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-5 text-zinc-300">
              <Target className="w-4 h-4 text-yellow-500" />
              Estadísticas Globales
            </h3>
            <div className="space-y-5 flex flex-col">

              <div className="space-y-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Días Completados</span>
                  <span className="font-bold">{mockTotalDays}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 w-[65%]" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Racha Actual</span>
                  <span className="font-bold">{streak} días</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 w-[45%]" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Logros</span>
                  <span className="font-bold">3/6</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 w-[50%]" />
                </div>
              </div>
            </div>
          </div>
          */}

          {/* Total Metrics Widget */}
          {/* <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4 text-zinc-300">
              <Zap className="w-4 h-4 text-orange-400" />
              Métricas Totales
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center text-zinc-400">
                <span>Distancia Total</span>
                <span className="text-zinc-100 font-medium">{mockTotalDistance} km</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Tiempo Ejercicio</span>
                <span className="text-zinc-100 font-medium">{mockTotalHours} hrs</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Calorías Totales</span>
                <span className="text-zinc-100 font-medium">{mockTotalCals.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>IMC Actual</span>
                <span className="text-zinc-100 font-medium">{mockBMI}</span>
              </div>
            </div>
          </div> */}

        </div>
      </div>

      <AchievementsModal
        isOpen={isAchievementsModalOpen}
        onClose={() => setIsAchievementsModalOpen(false)}
        achievements={achievementsList}
      />

      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        onSaved={(updated) => {
          // Immediately sync auth store with the new values —
          // this triggers a re-render of every component that reads from useAuthStore()
          updateAuthUser({
            ...(updated.name !== undefined && { name: updated.name }),
            ...(updated.email !== undefined && { email: updated.email }),
            ...(updated.age !== undefined && { age: updated.age }),
            ...(updated.weight !== undefined && { weight: updated.weight }),
            ...(updated.targetWeight !== undefined && { targetWeight: updated.targetWeight }),
            ...(updated.height !== undefined && { height: updated.height }),
          });
          // Also re-fetch profile stats (weight history, achievements, etc.)
          fetchProfile();
        }}
        initialValues={{
          name: user.name,
          email: user.email,
          age: user.age ?? undefined,
          weight: user.weight ?? undefined,
          targetWeight: user.targetWeight ?? undefined,
          height: user.height ?? undefined,
        }}
      />

      <LogMealModal
        isOpen={isLogMealModalOpen}
        onClose={() => setIsLogMealModalOpen(false)}
        date={format(new Date(), 'yyyy-MM-dd')}
        onSaved={() => {
          // Re-fetch health stats specifically
          fetchProfile();
        }}
      />

      <EditMealModal
        isOpen={!!editingMeal}
        meal={editingMeal}
        date={format(new Date(), 'yyyy-MM-dd')}
        onClose={() => setEditingMeal(null)}
        onSaved={() => {
          fetchProfile();
          setEditingMeal(null);
        }}
      />

      <LogWorkoutModal
        isOpen={isLogWorkoutModalOpen}
        onClose={() => {
          setIsLogWorkoutModalOpen(false);
          setEditingWorkout(null);
        }}
        date={format(new Date(), 'yyyy-MM-dd')}
        initialData={editingWorkout}
        onDelete={(deletedId) => {
          setRecentWorkouts(prev => prev.filter(w => w.id !== deletedId));
          // Refetch to update totals
          fetchProfile();
        }}
        onSaved={() => {
          fetchProfile();
          setEditingWorkout(null);
        }}
      />
    </div>
  );
}

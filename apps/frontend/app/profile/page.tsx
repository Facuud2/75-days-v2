'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { userService, UserProfileResponse } from '@/lib/api/users';
import { healthService, DailyStats } from '@/lib/api/health';
import { format } from 'date-fns';
import { Trophy, Calendar, Scale, Award, Flame, Target, ChevronRight, CheckCircle2, Lock, Activity, BarChart3, Footprints, Clock, Zap, Pencil, PieChart as PieChartIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, Legend } from 'recharts';
import AchievementsModal from '@/components/AchievementsModal';
import EditProfileModal from '@/components/EditProfileModal';
import LogMealModal from '@/components/LogMealModal';

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

  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isLogMealModalOpen, setIsLogMealModalOpen] = useState(false);

  const fetchProfile = useCallback(() => {
    if (user) {
      const today = format(new Date(), 'yyyy-MM-dd');
      Promise.all([
        userService.getProfile(),
        healthService.getDailyStats(today).catch(() => null)
      ])
        .then(([profile, healthData]) => {
          setProfileData(profile);
          setDailyStats(healthData);
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
  }, [fetchProfile]);

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
                        <div key={meal.id} className="flex justify-between items-center bg-zinc-950/40 border border-zinc-800/50 p-3 rounded-xl">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-zinc-200">{meal.name}</span>
                            <span className="text-[10px] text-zinc-500 uppercase font-medium">{meal.mealType} • {meal.proteinG}g P, {meal.carbG}g C, {meal.fatG}g G</span>
                          </div>
                          <div className="text-sm font-bold text-orange-400">
                            {meal.calories} <span className="text-[10px] text-zinc-500 font-normal">kcal</span>
                          </div>
                        </div>
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

          {/* Recent Activity Widget
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-5 text-zinc-300">
              <BarChart3 className="w-4 h-4 text-rose-400" />
              Actividad Reciente
            </h3>

            Refactored Mock bar chart
            <div className="flex items-end justify-between h-20 mb-6 gap-1">
              {[40, 60, 45, 80, 50, 90, 100].map((height, i) => (
                <div key={i} className="flex-1 bg-rose-500/20 hover:bg-rose-500/40 transition-colors rounded-t-sm relative group cursor-pointer" style={{ height: `${height}%` }}>
                  <div className="absolute opacity-0 group-hover:opacity-100 -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-[10px] px-2 py-1 rounded shadow-lg transition-opacity whitespace-nowrap z-10">
                    Día {i + 1}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Esta Semana</span>
                </div>
                <span className="font-medium">{mockWeeklyWorkouts} entrenamientos</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Calorías</span>
                </div>
                <span className="font-medium">{mockWeeklyCals.toLocaleString()} kcal</span>
              </div>
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tiempo Total</span>
                </div>
                <span className="font-medium">{mockWeeklyHours} hrs</span>
              </div>
            </div>
          </div>
          */}

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
    </div>
  );
}

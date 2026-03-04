'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { format } from 'date-fns';
import { Trophy, Calendar, Scale, Award, Flame, Target, ChevronRight, CheckCircle2, Lock, Activity, BarChart3, Footprints, Clock, Zap } from 'lucide-react';

export default function Profile() {
  const { user } = useAuthStore();
  const {
    isActive,
    difficulty,
    streak,
    points,
    achievements,
    bestWeight,
    challengesCompleted,
    sideQuests
  } = useChallengeStore();

  if (!user) return null;

  // Mock data for new UI sections based on images
  const mockWeightLost = 12.5; // Example calculation
  const mockChallengesCount = 8;
  const mockTotalDays = challengesCompleted * 30 + streak; // Example

  const mockInitialWeight = user.weight || 85.0;
  const mockGoalWeight = 72.5;
  const mockCurrentWeight = bestWeight || 72.5;
  const mockToLose = Math.max(0, mockCurrentWeight - mockGoalWeight).toFixed(1);

  const mockWeeklyWorkouts = 7;
  const mockWeeklyCals = 3710;
  const mockWeeklyHours = 8.5;

  const mockTotalDistance = 385;
  const mockTotalHours = 124.5;
  const mockTotalCals = 52340;
  const mockBMI = 23.8;

  const mockCompletedChallenges = [
    { title: 'Enero Saludable', desc: '31 días de comida saludable y ejercicio diario', date: '31 Ene 2025', icon: '🥗', color: 'text-green-500' },
    { title: 'Reto Cardio 30', desc: '30 días consecutivos de ejercicio cardiovascular mínimo 30 min', date: '15 Dic 2024', icon: '💪', color: 'text-yellow-500' },
    { title: 'Hidratación Pro', desc: 'Beber 3 litros de agua diariamente por 21 días', date: '28 Nov 2024', icon: '💧', color: 'text-rose-500' },
    { title: 'Sin Azúcar', desc: '30 días sin consumir azúcar refinada', date: '10 Dic 2024', icon: '🚫', color: 'text-red-500' },
    { title: 'Meditación Diaria', desc: '15 minutos de meditación todos los días por 30 días', date: '22 Dic 2024', icon: '🧘', color: 'text-orange-400' },
  ];

  const mockAchievementsList = [
    { title: 'Primer Paso', desc: 'Completa tu primer día del desafío', date: '15 Nov 2024', icon: <Award className="w-6 h-6" />, color: 'bg-rose-500', unlocked: true },
    { title: 'Semana de Fuego', desc: 'Completa 7 días consecutivos', date: '22 Nov 2024', icon: <Flame className="w-6 h-6" />, color: 'bg-rose-400', unlocked: true },
    { title: 'Guerrero Incansable', desc: 'Alcanza 30 días de racha', date: '10 Dic 2024', icon: <Trophy className="w-6 h-6" />, color: 'bg-rose-300', unlocked: true },
    { title: 'Leyenda 75', desc: 'Completa el desafío de 75 días', progress: 42, total: 75, icon: <Lock className="w-6 h-6 text-zinc-500" />, color: 'bg-zinc-800', unlocked: false },
    { title: 'Maestro del Fitness', desc: 'Completa 100 entrenamientos', progress: 68, total: 100, icon: <Lock className="w-6 h-6 text-zinc-500" />, color: 'bg-zinc-800', unlocked: false },
    { title: 'Corazón de Acero', desc: 'Mantén tu frecuencia cardíaca en zona óptima', progress: 23, total: 50, icon: <Lock className="w-6 h-6 text-zinc-500" />, color: 'bg-zinc-800', unlocked: false },
  ];

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
                      style={{ width: `${Math.min(100, (streak / 75) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-end text-xs text-zinc-500 font-medium">
                    {streak}/75 días
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
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
            <div className="flex items-center text-zinc-100 justify-between mb-6 pb-4 border-b border-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500/20 p-2 rounded-lg">
                  <Award className="text-yellow-500 w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold leading-tight">Logros</h2>
                  <p className="text-sm text-zinc-400">3 de 6 desbloqueados</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold">50%</span>
                <p className="text-xs text-zinc-500">Completado</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockAchievementsList.map((ach, i) => (
                <div key={i} className={`p-4 rounded-xl border flex gap-4 ${ach.unlocked
                  ? 'bg-zinc-950/40 border-zinc-800'
                  : 'bg-zinc-950/20 border-zinc-800/40 opacity-70'
                  }`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${ach.color}`}>
                    {ach.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-sm">{ach.title}</h4>
                      {ach.unlocked && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">{ach.desc}</p>

                    {ach.unlocked ? (
                      <span className="text-[10px] text-rose-400 font-medium">Desbloqueado el {ach.date}</span>
                    ) : (
                      <div className="flex items-center gap-2 mt-auto">
                        <span className="text-[10px] text-zinc-500">Progreso</span>
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500/50 rounded-full"
                            style={{ width: `${(ach.progress! / ach.total!) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500">{ach.progress} / {ach.total}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column - Sidebar Widgets (Spans 1 col) */}
        <div className="space-y-6">

          {/* Weight Progress Widget */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4 text-zinc-300">
              <Scale className="w-4 h-4 text-green-400" />
              Progreso de Peso
            </h3>
            <div className="mb-6">
              <div className="text-3xl font-bold">{mockCurrentWeight} kg</div>
              <div className="text-sm text-green-400 font-medium mt-1">↓ {mockWeightLost} kg total</div>
            </div>

            {/* Simple graph line placeholder */}
            <div className="w-full h-8 flex items-end mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-rose-500/10 to-transparent"></div>
              <svg className="w-full h-full text-rose-500" preserveAspectRatio="none" viewBox="0 0 100 20">
                <polyline points="0,20 20,15 40,12 60,8 80,5 100,2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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

          {/* Recent Activity Widget */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-5 text-zinc-300">
              <BarChart3 className="w-4 h-4 text-rose-400" />
              Actividad Reciente
            </h3>

            {/* Mock bar chart */}
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

          {/* Global Stats Widget */}
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

          {/* Total Metrics Widget */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6">
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
          </div>

        </div>
      </div>
    </div>
  );
}

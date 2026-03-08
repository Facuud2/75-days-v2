'use client';

import React, { useEffect, useState } from 'react';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, getDay, isSameDay, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Utensils, Dumbbell, Sun, Droplet, Book, Camera, Target, ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DayDetailsModal from '@/components/DayDetailsModal';
import { DEFAULT_GOALS } from '@/lib/constants/plans';

const iconMap: Record<string, any> = {
  utensils: Utensils,
  dumbbell: Dumbbell,
  sun: Sun,
  droplet: Droplet,
  book: Book,
  camera: Camera,
  target: Target
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const {
    isActive,
    currentDay,
    logs,
    startDate,
    logDailyGoal,
    fetchCurrentChallenge,
    checkDailyReset,
    isLoading
  } = useChallengeStore();
  const router = useRouter();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLog = logs[todayStr];
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);
  const hasCheckedReset = React.useRef(false);

  useEffect(() => {
    if (!isActive) {
      router.push('/onboarding');
    } else {
      // Always run daily reset check when visiting dashboard if active, but only once per mount
      if (!hasCheckedReset.current) {
        hasCheckedReset.current = true;
        checkDailyReset().then(() => {
          // Fallback if logs are completely empty even after check
          if (Object.keys(useChallengeStore.getState().logs).length === 0) {
            fetchCurrentChallenge();
          }
        });
      }
    }
  }, [isActive, router, checkDailyReset, fetchCurrentChallenge]);

  // Loading state prevents returning generic null silently
  if (isLoading || (isActive && !todayLog)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-rose-500 animate-spin" />
        <p className="text-white/50 font-medium">Cargando tu desafío...</p>
      </div>
    );
  }

  if (!isActive) return null;

  const completedTasks = todayLog.goals.filter(g => g.completed).length;
  const totalTasks = todayLog.goals.length;
  const remainingTasks = totalTasks - completedTasks;
  const progress = Math.round((completedTasks / totalTasks) * 100);

  // Calendar logic
  const now = new Date();
  const monthStart = startOfMonth(currentMonthDate);
  const monthEnd = endOfMonth(currentMonthDate);
  const startDateObj = startDate ? new Date(startDate) : now;

  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const startDayOfWeek = getDay(monthStart); // 0 = Sunday

  const calendarDays = Array.from({ length: daysInMonth }).map((_, i) => {
    const date = addDays(monthStart, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const log = logs[dateStr];

    let status = 'future';
    if (log) {
      status = log.status;
    } else if (differenceInDays(now, date) > 0 && differenceInDays(date, startDateObj) >= 0) {
      status = 'fail';
    } else if (differenceInDays(date, startDateObj) < 0) {
      status = 'inactive';
    }

    return {
      date,
      dateStr,
      status,
      dayNum: i + 1,
      isToday: isSameDay(date, now)
    };
  });

  // Separate base plan goals from custom goals
  const allDefaultTitles = new Set(
    Object.values(DEFAULT_GOALS).flatMap(goals => goals.map(g => g.title.toLowerCase()))
  );

  const baseGoals = todayLog.goals.filter(g => allDefaultTitles.has(g.title.toLowerCase()));
  const customGoals = todayLog.goals.filter(g => !allDefaultTitles.has(g.title.toLowerCase()));

  // Determine current active plan name mapped to UI strings
  const currentPlanName = useChallengeStore.getState().difficulty || 'Activo';


  const renderGoalItem = (goal: any) => {
    const IconComponent = iconMap[goal.icon || 'target'] || Target;
    const isThisUpdating = updatingGoalId === goal.id;
    const isLocked = updatingGoalId !== null && !isThisUpdating;

    const handleClick = async () => {
      if (updatingGoalId !== null) return;
      setUpdatingGoalId(goal.id);
      try {
        await logDailyGoal(todayStr, goal.id, !goal.completed);
      } finally {
        setUpdatingGoalId(null);
      }
    };

    return (
      <div
        key={goal.id}
        onClick={handleClick}
        className={`group bg-rose-950/20 border rounded-2xl p-5 flex items-center gap-5 transition-all duration-300 ${isLocked
          ? 'border-[#361726] opacity-40 cursor-not-allowed select-none'
          : isThisUpdating
            ? 'border-rose-500/20 cursor-wait'
            : goal.completed
              ? 'border-rose-500/30 bg-rose-500/5 cursor-pointer'
              : 'border-[#361726] hover:border-rose-500/50 hover:bg-rose-950/40 cursor-pointer'
          }`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isThisUpdating
          ? 'bg-white/10 text-white/40'
          : goal.completed
            ? 'bg-rose-500/20 text-rose-500'
            : 'bg-rose-950/60 text-rose-500/70 group-hover:text-rose-500'
          }`}>
          {isThisUpdating
            ? <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            : <IconComponent size={24} strokeWidth={1.5} />
          }
        </div>

        <div className="flex-1">
          <h3 className={`font-bold text-lg mb-1 transition-colors ${goal.completed ? 'text-white/70 line-through' : 'text-white'}`}>
            {goal.title}
          </h3>
          <p className={`text-sm transition-colors ${goal.completed ? 'text-white/30' : 'text-white/50'}`}>
            {goal.description || 'Completar esta tarea para avanzar en el desafío.'}
          </p>
        </div>

        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isThisUpdating
          ? 'border-white/20'
          : goal.completed
            ? 'bg-rose-500 border-rose-500 scale-110 shadow-[0_0_15px_var(--color-rose-500)]'
            : 'border-rose-950/40 group-hover:border-rose-500/50'
          }`}>
          {goal.completed && !isThisUpdating && <Check size={16} className="text-white" strokeWidth={3} />}
        </div>
      </div>
    );
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 animate-in fade-in">

      {/* Left Column */}
      <div className="lg:col-span-4 space-y-6">

        {/* DÍA ACTUAL */}
        <div className="bg-rose-950/20 border border-rose-950/40 rounded-3xl p-6 shadow-lg">
          <h3 className="text-rose-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-4">Día Actual</h3>
          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-7xl font-bold text-white tracking-tighter">{currentDay}</span>
            <span className="text-2xl text-white/40 font-bold">/ 75</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-white/60 font-medium">
              <span>Progreso Total</span>
              <span>{Math.round((currentDay / 75) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-1000 ease-out"
                style={{ width: `${(currentDay / 75) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* ESTADO DIARIO */}
        <div className="bg-rose-950/20 border border-rose-950/40 rounded-3xl p-6 shadow-lg">
          <h3 className="text-rose-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-2">Estado Diario</h3>
          <h2 className="text-2xl font-bold uppercase tracking-tight mb-6 text-white">
            {progress === 100 ? 'Completado' : 'En Progreso'}
          </h2>

          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/5"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  className={`transition-all duration-1000 ease-out ${progress === 100 ? 'text-emerald-500' : 'text-rose-500'}`}
                  strokeDasharray={`${progress}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              <span className={`absolute text-sm font-bold ${progress === 100 ? 'text-emerald-500' : 'text-white'}`}>
                {progress}%
              </span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              {remainingTasks === 0
                ? '¡Todas las tareas completadas por hoy! Gran trabajo.'
                : `${remainingTasks} tareas restantes para terminar el día.`}
            </p>
          </div>
        </div>

        {/* MINI CALENDAR */}
        <div className="bg-rose-950/20 border border-rose-950/40 rounded-3xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}
              className="p-1 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-white font-bold text-lg capitalize">
              {format(currentMonthDate, 'MMMM yyyy', { locale: es })}
            </h3>
            <button
              onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}
              className="p-1 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-rose-500 tracking-wider">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {calendarDays.map((day) => {
              let bg = 'bg-transparent';
              let text = 'text-white/30';
              let border = 'border border-transparent';
              let dotColor = 'bg-rose-500';

              if (day.status === 'success') {
                bg = 'bg-emerald-500/20';
                border = 'border-emerald-500/50';
                text = 'text-emerald-500 font-bold';
                dotColor = 'bg-emerald-500';
              } else if (day.status === 'fail') {
                bg = 'bg-red-500/10';
                border = 'border-red-500/30';
                text = 'text-red-500 font-bold';
              } else if (day.status === 'pending') {
                text = 'text-white/80';
                border = 'border-white/5 hover:border-white/20';
              } else if (day.status === 'future') {
                text = 'text-white/20';
              }

              if (day.isToday && day.status !== 'success') {
                bg = 'bg-rose-500/20';
                border = 'border-rose-500/50';
                text = 'text-rose-500 font-bold';
              }

              return (
                <div
                  key={day.dateStr}
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={`relative aspect-square rounded-xl flex items-center justify-center text-xs transition-colors cursor-pointer ${bg} ${text} ${border}`}
                >
                  {day.dayNum}
                  {day.isToday && <div className={`absolute w-1 h-1 rounded-full bottom-1 ${dotColor}`} />}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5 text-[10px] text-white/50 font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" /> Completado
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" /> Fallido
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/20" /> Pendiente
            </div>
          </div>
        </div>

      </div>

      {/* Right Column */}
      <div className="lg:col-span-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
          <h2 className="text-2xl font-bold text-rose-500 tracking-tight">Tareas de Hoy</h2>
          <span className="text-white/50 text-sm font-medium capitalize">
            {format(now, "EEEE, d 'de' MMMM", { locale: es })}
          </span>
        </div>

        <div className="space-y-8">
          {currentPlanName === 'Custom' ? (
            /* PLAN CUSTOM: all goals are personal */
            <div>
              <h3 className="text-sm font-bold tracking-widest text-emerald-500 uppercase mb-4 opacity-80 flex items-center gap-2">
                <PlusCircle size={16} /> Metas Personalizadas
              </h3>
              <div className="space-y-3">
                {todayLog.goals.map(renderGoalItem)}
              </div>
            </div>
          ) : (
            <>
              {/* TAREAS DEL PLAN BASE (Soft / Medium / Hard) */}
              <div>
                <h3 className="text-sm font-bold tracking-widest text-rose-500 uppercase mb-4 opacity-80 flex items-center gap-2">
                  <Target size={16} /> Plan {currentPlanName}
                </h3>
                <div className="space-y-3">
                  {baseGoals.length > 0 ? (
                    baseGoals.map(renderGoalItem)
                  ) : (
                    <p className="text-white/40 text-sm italic p-4 bg-white/5 rounded-2xl border border-white/5">
                      No hay tareas base para este plan.
                    </p>
                  )}
                </div>
              </div>

              {/* METAS PERSONALIZADAS (extra goals on non-custom plans) */}
              {customGoals.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold tracking-widest text-emerald-500 uppercase mb-4 opacity-80 flex items-center gap-2">
                    <PlusCircle size={16} /> Metas Personalizadas
                  </h3>
                  <div className="space-y-3">
                    {customGoals.map(renderGoalItem)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedDate && (
        <DayDetailsModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

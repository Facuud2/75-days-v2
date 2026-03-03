'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { format } from 'date-fns';
import { Trophy, Calendar, Scale, Award, Flame, Target } from 'lucide-react';

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

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in">
      {/* Profile Header (Steam Style) */}
      <div className="bg-zinc-900 dark:bg-zinc-950 text-white rounded-3xl p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800/50 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-zinc-800/30 rounded-full blur-2xl -ml-24 -mb-24"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-zinc-800 border-4 border-zinc-700 rounded-2xl flex items-center justify-center text-4xl font-bold uppercase shadow-2xl">
            {user.name.charAt(0)}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{user.name}</h1>
            <p className="text-zinc-400 font-medium mb-4">
              Level {Math.floor(points / 100) + 1} Challenger
            </p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <span className="px-3 py-1 bg-zinc-800 rounded-lg text-sm font-medium flex items-center gap-2 border border-zinc-700">
                <Calendar size={14} className="text-zinc-400" />
                Joined {format(new Date(user.registeredAt), 'MMM yyyy')}
              </span>
              <span className="px-3 py-1 bg-zinc-800 rounded-lg text-sm font-medium flex items-center gap-2 border border-zinc-700">
                <Trophy size={14} className="text-yellow-500" />
                {points} XP
              </span>
              {isActive && (
                <span className="px-3 py-1 bg-orange-900/50 text-orange-400 rounded-lg text-sm font-medium flex items-center gap-2 border border-orange-800/50">
                  <Flame size={14} />
                  {streak} Day Streak
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats Column */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Target size={20} className="text-zinc-400" />
              Current Status
            </h2>
            {isActive ? (
              <div className="space-y-2">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Active Challenge</p>
                <p className="font-bold text-xl">{difficulty} Mode</p>
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400">Resting / No active challenge</p>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Scale size={20} className="text-zinc-400" />
              Best Metrics
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Lowest Weight</p>
                <p className="font-bold text-xl">{bestWeight ? `${bestWeight} kg` : '--'}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Challenges Completed</p>
                <p className="font-bold text-xl">{challengesCompleted}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Achievements & Quests Column */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Award size={20} className="text-zinc-400" />
              Achievements Showcase
            </h2>
            {achievements.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {achievements.map((ach, i) => (
                  <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full flex items-center justify-center">
                      <Trophy size={20} />
                    </div>
                    <span className="text-sm font-medium">{ach}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">No achievements yet. Keep pushing!</p>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Flame size={20} className="text-zinc-400" />
              Active Side Quests
            </h2>
            {sideQuests.length > 0 ? (
              <div className="space-y-3">
                {sideQuests.map(quest => (
                  <div key={quest.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                    <div>
                      <h3 className="font-semibold">{quest.title}</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {quest.progress} / {quest.durationDays} days completed
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${quest.completed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'}`}>
                      {quest.difficulty}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">No active side quests.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useChallengeStore } from '@/store/useChallengeStore';
import { format, addDays, differenceInDays } from 'date-fns';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { parseLocalDate } from '@/lib/utils/date';
import DayDetailsModal from '@/components/DayDetailsModal';
import { useState } from 'react';

export default function CalendarView() {
  const { isActive, startDate, logs } = useChallengeStore();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (!isActive || !startDate) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-20">
        <h2 className="text-2xl font-bold mb-4">No Active Challenge</h2>
        <p className="text-zinc-500 dark:text-zinc-400">Start a challenge to see your calendar.</p>
      </div>
    );
  }

  const start = parseLocalDate(startDate);
  const days = Array.from({ length: 75 }).map((_, i) => {
      const date = addDays(start, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const log = logs[dateStr];
    
    let status = 'future';
    if (log) {
      status = log.status;
    } else if (differenceInDays(new Date(), date) > 0) {
      status = 'fail'; // missed day
    }

    return {
      dayNumber: i + 1,
      date: dateStr,
      status,
      log
    };
  });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Journey Map</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Your 75 days at a glance</p>
      </header>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="grid grid-cols-7 gap-2 md:gap-4">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              {d}
            </div>
          ))}
          
          {/* Pad the start of the grid based on the day of the week of startDate */}
          {Array.from({ length: (start.getDay() + 6) % 7 }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square rounded-2xl bg-transparent" />
          ))}

          {days.map((day) => {
            let bgColor = 'bg-zinc-100 dark:bg-zinc-800/50';
            let textColor = 'text-zinc-400';
            let Icon = null;

            if (day.status === 'success') {
              bgColor = 'bg-green-100 dark:bg-green-900/30';
              textColor = 'text-green-600 dark:text-green-400';
              Icon = CheckCircle2;
            } else if (day.status === 'fail') {
              bgColor = 'bg-red-100 dark:bg-red-900/30';
              textColor = 'text-red-600 dark:text-red-400';
              Icon = XCircle;
            } else if (day.status === 'rest') {
              bgColor = 'bg-blue-100 dark:bg-blue-900/30';
              textColor = 'text-blue-600 dark:text-blue-400';
              Icon = MinusCircle;
            } else if (day.status === 'pending') {
              bgColor = 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500/50';
              textColor = 'text-orange-600 dark:text-orange-400';
            }

            return (
              <div 
                key={day.dayNumber} 
                 onClick={() => setSelectedDate(day.date)}
                 className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-1 relative group transition-all hover:scale-105 cursor-pointer ${bgColor}`}
                 title={format(parseLocalDate(day.date), 'MMM d, yyyy')}
              >
                <span className={`text-sm md:text-lg font-bold ${textColor}`}>
                  {day.dayNumber}
                </span>
                {Icon && (
                  <div className="absolute bottom-1 md:bottom-2">
                    <Icon size={12} className={textColor} />
                  </div>
                )}
                
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 bg-zinc-900 text-white text-xs rounded-xl p-3 z-10 shadow-xl">
                   <p className="font-bold mb-1">{format(parseLocalDate(day.date), 'MMMM d, yyyy')}</p>
                  <p>Status: <span className="capitalize">{day.status}</span></p>
                  {day.log?.weight && <p>Weight: {day.log.weight}kg</p>}
                  <p className="mt-2 font-semibold">Goals:</p>
                  <ul className="list-disc pl-4 mt-1">
                    {day.log?.goals.map(g => (
                      <li key={g.id} className={g.completed ? 'text-green-400' : 'text-zinc-400'}>
                        {g.title}
                      </li>
                    ))}
                    {!day.log && <li className="text-zinc-500">No data</li>}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selectedDate && (
        <DayDetailsModal date={selectedDate} onClose={() => setSelectedDate(null)} />
      )}
    </div>
  );
}

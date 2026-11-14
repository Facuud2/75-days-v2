'use client';

import { useEffect, useState } from 'react';

export default function HeaderCountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();

      setTimeLeft({
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden md:flex items-center gap-2 text-sm">
      <div className="flex gap-1">
        <span className="app-header-timer bg-white/5 border border-white/10 px-2 py-1 rounded text-rose-500 font-mono">
          {timeLeft.hours.toString().padStart(2, '0')}
        </span>
        :
        <span className="app-header-timer bg-white/5 border border-white/10 px-2 py-1 rounded text-rose-500 font-mono">
          {timeLeft.minutes.toString().padStart(2, '0')}
        </span>
        :
        <span className="app-header-timer bg-white/5 border border-white/10 px-2 py-1 rounded text-rose-500 font-mono">
          {timeLeft.seconds.toString().padStart(2, '0')}
        </span>
      </div>
      <span className="app-header-muted text-xs font-bold tracking-wider ml-2">HASTA RESET</span>
    </div>
  );
}

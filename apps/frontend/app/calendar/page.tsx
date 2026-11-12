'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Check, ChevronRight, Circle, Flame, LayoutGrid, List, Minus, X } from 'lucide-react';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useUIStore } from '@/store/useUIStore';
import { buildChallengeDays, getChallengeSummary, getDayLabel } from '@/lib/calendar/challengeDays';
import DayCell from '@/components/calendar/DayCell';
import DayDetailsSheet from '@/components/calendar/DayDetailsSheet';

type CalendarView = 'map' | 'agenda';

const statusLegend = [
  { key: 'success', label: 'Completado', Icon: Check },
  { key: 'pending', label: 'Pendiente', Icon: Circle },
  { key: 'fail', label: 'No cumplido', Icon: X },
  { key: 'rest', label: 'Descanso', Icon: Minus },
] as const;

export default function CalendarView() {
  const { isActive, startDate, logs, currentDay, streak, fetchCurrentChallenge, checkDailyReset, isLoading } = useChallengeStore();
  const [view, setView] = useState<CalendarView>('map');
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      await fetchCurrentChallenge();
      if (useChallengeStore.getState().isActive) await checkDailyReset();
    })();
  }, [checkDailyReset, fetchCurrentChallenge]);

  const days = useMemo(() => startDate ? buildChallengeDays(startDate, logs) : [], [logs, startDate]);
  const summary = useMemo(() => getChallengeSummary(days), [days]);
  const selectedDay = selectedDayNumber ? days[selectedDayNumber - 1] : undefined;
  const progress = Math.min(100, Math.round(((currentDay || summary.finished) / 75) * 100));

  if (isLoading && !days.length) return <CalendarLoading />;
  if (!isActive || !startDate) return <EmptyCalendar />;

  return (
    <div className="calendar-page">
      <header className="calendar-hero">
        <div className="calendar-hero__title-row"><div><p className="calendar-context-label"><CalendarDays size={15} aria-hidden="true" /> Tu recorrido</p><h1>Tu mapa de 75 días</h1></div><div className="calendar-streak"><Flame size={18} aria-hidden="true" /><strong>{streak}</strong><span>racha</span></div></div>
        <div className="calendar-progress-row"><div className="calendar-progress" role="progressbar" aria-valuemin={0} aria-valuemax={75} aria-valuenow={currentDay || summary.finished} aria-label="Progreso del reto"><span style={{ width: `${progress}%` }} /></div><strong>{currentDay || summary.finished}<span> / 75</span></strong></div>
        <p className="calendar-hero__meta">Día {currentDay || summary.finished} · {summary.completed} completados · {summary.failed} no cumplidos</p>
      </header>

      <div className="calendar-view-switcher" role="group" aria-label="Vista del calendario">
        <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}><LayoutGrid size={16} aria-hidden="true" /> Mapa</button>
        <button type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}><List size={16} aria-hidden="true" /> Agenda</button>
      </div>

      <section className="calendar-today-card" aria-labelledby="today-card-title">
        <div><p className="calendar-context-label">Hoy · Día {Math.min(currentDay || 1, 75)}</p><h2 id="today-card-title">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</h2><p>{days.find((day) => day.isToday)?.totalGoals ? `${days.find((day) => day.isToday)?.completedGoals} de ${days.find((day) => day.isToday)?.totalGoals} metas completadas` : 'Abre el día para añadir tu registro'}</p></div>
        <button type="button" onClick={() => setSelectedDayNumber(days.find((day) => day.isToday)?.dayNumber ?? currentDay ?? 1)} aria-label="Abrir el registro de hoy"><ChevronRight size={20} aria-hidden="true" /></button>
      </section>

      {view === 'map' ? <JourneyMap days={days} onSelect={setSelectedDayNumber} /> : <AgendaView days={days} onSelect={setSelectedDayNumber} />}

      <div className="calendar-legend" aria-label="Estados del calendario">{statusLegend.map(({ key, label, Icon }) => <span key={key} className={`calendar-legend__item calendar-legend__item--${key}`}><Icon size={13} aria-hidden="true" /> {label}</span>)}</div>

      {selectedDay && <DayDetailsSheet day={selectedDay} onClose={() => setSelectedDayNumber(null)} onPrevious={selectedDay.dayNumber > 1 ? () => setSelectedDayNumber(selectedDay.dayNumber - 1) : undefined} onNext={selectedDay.dayNumber < 75 ? () => setSelectedDayNumber(selectedDay.dayNumber + 1) : undefined} />}
    </div>
  );
}

function JourneyMap({ days, onSelect }: { days: ReturnType<typeof buildChallengeDays>; onSelect: (day: number) => void }) {
  const [keyboardDay, setKeyboardDay] = useState(1);
  const dayRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const firstDay = days[0]?.dateValue;
  const leadingDays = firstDay ? (firstDay.getDay() + 6) % 7 : 0;
  const moveFocus = (target: number) => {
    const bounded = Math.max(1, Math.min(days.length, target));
    setKeyboardDay(bounded);
    onSelect(bounded);
    requestAnimationFrame(() => dayRefs.current[bounded]?.focus());
  };
  return <section className="calendar-map" aria-labelledby="map-title"><div className="calendar-section-heading"><h2 id="map-title">Mapa del reto</h2><span>Usa las flechas para moverte</span></div><div className="calendar-weekdays" aria-hidden="true">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: leadingDays }).map((_, index) => <span key={`empty-${index}`} />)}{days.map((day) => <DayCell key={day.dayNumber} day={day} buttonRef={(element) => { dayRefs.current[day.dayNumber] = element; }} tabIndex={keyboardDay === day.dayNumber ? 0 : -1} onSelect={() => { setKeyboardDay(day.dayNumber); onSelect(day.dayNumber); }} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); moveFocus(day.dayNumber + 1); } if (event.key === 'ArrowLeft') { event.preventDefault(); moveFocus(day.dayNumber - 1); } if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(day.dayNumber + 7); } if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(day.dayNumber - 7); } if (event.key === 'Home') { event.preventDefault(); moveFocus(1); } if (event.key === 'End') { event.preventDefault(); moveFocus(days.length); } }} />)}</div></section>;
}

function AgendaView({ days, onSelect }: { days: ReturnType<typeof buildChallengeDays>; onSelect: (day: number) => void }) {
  const weeks = Array.from({ length: 11 }, (_, index) => days.slice(index * 7, index * 7 + 7)).filter((week) => week.length);
  return <section className="calendar-agenda" aria-labelledby="agenda-title"><div className="calendar-section-heading"><h2 id="agenda-title">Agenda del reto</h2><span>Revisión rápida</span></div>{weeks.map((week) => <div className="calendar-agenda__week" key={week[0].weekNumber}><p className="calendar-context-label">Semana {week[0].weekNumber}</p>{week.map((day) => <button type="button" aria-label={getDayLabel(day)} className={`calendar-agenda-row calendar-agenda-row--${day.status}`} key={day.dayNumber} onClick={() => onSelect(day.dayNumber)}><span className="calendar-agenda-row__day" aria-hidden="true"><strong>Día {day.dayNumber}</strong><small>{format(day.dateValue, 'EEE d MMM', { locale: es })}</small></span><span className="calendar-agenda-row__summary" aria-hidden="true">{day.totalGoals ? `${day.completedGoals}/${day.totalGoals} metas` : 'Sin registro'}<small>{day.log?.weight ? `${day.log.weight} kg` : ''}{day.log?.photoUrl ? ' · Foto' : ''}</small></span><span className="calendar-agenda-row__mark" aria-hidden="true"><StatusIcon status={day.status} /></span></button>)}</div>)}</section>;
}

function StatusIcon({ status }: { status: string }) { if (status === 'success') return <Check size={16} aria-hidden="true" />; if (status === 'fail') return <X size={16} aria-hidden="true" />; if (status === 'rest') return <Minus size={16} aria-hidden="true" />; return <Circle size={13} aria-hidden="true" />; }

function EmptyCalendar() { const openPlansModal = useUIStore((state) => state.openPlansModal); return <div className="calendar-page calendar-empty"><CalendarDays size={32} aria-hidden="true" /><h1>Tu calendario empieza con un reto</h1><p>Elige un plan para ver tus 75 días y empezar a construir tu racha.</p><button type="button" onClick={openPlansModal}>Elegir un plan</button></div>; }
function CalendarLoading() { return <div className="calendar-page" aria-busy="true"><div className="calendar-skeleton calendar-skeleton--hero" /><div className="calendar-skeleton calendar-skeleton--card" /><div className="calendar-skeleton calendar-skeleton--grid" /><span className="sr-only">Cargando calendario…</span></div>; }

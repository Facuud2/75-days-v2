'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Flame, LayoutGrid, List, Minus, X } from 'lucide-react';
import { useChallengeStore } from '@/store/useChallengeStore';
import type { DailyLog } from '@/store/useChallengeStore';
import { useUIStore } from '@/store/useUIStore';
import { buildChallengeDays, getChallengeSummary, getCurrentWeekIndex, getDayLabel, getDefaultWeekIndex, groupChallengeWeeks } from '@/lib/calendar/challengeDays';
import DayCell from '@/components/calendar/DayCell';
import { readDevDataset } from '@/components/dev/DevDatasetPicker';
import type { DevDataset } from '@/components/dev/DevDatasetPicker';

// Lazy-loaded sheet (vercel-react-best-practices: bundle-dynamic-imports)
const DayDetailsSheet = dynamic(() => import('@/components/calendar/DayDetailsSheet'), { ssr: false });

// Chrome de desarrollo: en producción el fragmento no se renderiza y el chunk
// del toggle no se referencia en el HTML servido.
const DevDatasetPicker = dynamic(() => import('@/components/dev/DevDatasetPicker'), { ssr: false });

const IS_DEV_BUILD = process.env.NODE_ENV === 'development';

type CalendarView = 'map' | 'agenda';

const statusLegend = [
  { key: 'success', label: 'Completado', Icon: Check },
  { key: 'pending', label: 'Pendiente', Icon: Circle },
  { key: 'fail', label: 'No cumplido', Icon: X },
  { key: 'rest', label: 'Descanso', Icon: Minus },
] as const;

/**
 * Fixtures de break-ui para el calendario. Se aplican al mismo límite de datos
 * que el store (`startDate` + `logs`), así que `buildChallengeDays` y todo lo
 * que cuelga de él no sabe si mira datos reales o un caso límite.
 */
const DEMO_START_DATE = '2026-01-05';

function buildDevCalendar(
  dataset: DevDataset,
  startDate: string,
  logs: Record<string, DailyLog>,
): { startDate: string; logs: Record<string, DailyLog> } {
  if (dataset === 'demo' && startDate) return { startDate, logs };

  // Sin reto real no hay calendario que romper: usamos un inicio plausible y
  // dejamos el estado `demo` intacto cuando sí existe.
  const effectiveStart = startDate || DEMO_START_DATE;
  if (dataset === 'demo') return { startDate: effectiveStart, logs };

  const realDays = buildChallengeDays(effectiveStart, logs);
  // `inactive` (día anterior al inicio) no es un estado de log válido.
  const logStatus = (day: (typeof realDays)[number]): DailyLog['status'] =>
    day.status === 'future' ? 'pending' : day.status === 'inactive' ? 'rest' : day.status;
  const goal = (title: string, completed = false, icon = 'droplet') => ({
    id: title,
    title,
    completed,
    icon,
  });

  const worstTitles = [
    'Beber 3,5 litros de agua antes de las 21:00 y registrar cada vaso en la aplicación',
    '<script>alert(1)</script>',
    '🦊 Meditar 10 minutos',
    'نور الهدى عبد الرحمن تسجيل البيانات',
  ];

  const nextLogs: Record<string, DailyLog> = {};
  realDays.forEach((day) => {
    if (dataset === 'empty') return;

    if (dataset === 'one') {
      nextLogs[day.date] = {
        date: day.date,
        goals: [goal('Lectura (10 págs)', true, 'book')],
        status: 'success',
      };
      return;
    }

    if (dataset === 'thousand') {
      nextLogs[day.date] = {
        date: day.date,
        status: logStatus(day),
        goals: Array.from({ length: 24 }, (_, index) =>
          goal(`Meta ${index + 1} del día ${day.dayNumber}`, index % 3 === 0),
        ),
        weight: day.dayNumber % 7 === 0 ? 1284.45 : undefined,
        notes: day.dayNumber % 5 === 0
          ? 'Nota con un texto bastante largo que debería truncarse sin empujar el resto de la fila de agenda'
          : undefined,
      };
      return;
    }

    nextLogs[day.date] = {
      date: day.date,
      status: logStatus(day),
      goals: worstTitles.map((title, index) => goal(title, index % 2 === 0)),
      weight: 1284.45,
      notes: "Seán O'Brien-Ó Súilleabháin · nota con diacríticos y longitud realista",
    };
  });

  return { startDate: effectiveStart, logs: nextLogs };
}

export default function CalendarView() {
  const { isActive, startDate, logs, currentDay, streak, fetchCurrentChallenge, checkDailyReset, isLoading } = useChallengeStore();
  const [view, setView] = useState<CalendarView>('map');
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);
  const [devDataset, setDevDataset] = useState<DevDataset>(() => readDevDataset());

  useEffect(() => {
    void (async () => {
      await fetchCurrentChallenge();
      if (useChallengeStore.getState().isActive) await checkDailyReset();
    })();
  }, [checkDailyReset, fetchCurrentChallenge]);

  // El fixture entra exactamente donde entra el store; el resto de la página
  // sigue leyendo `calendarStart` / `calendarLogs` sin saber de dónde vienen.
  const isDevDataset = IS_DEV_BUILD && devDataset !== 'demo';
  const { startDate: calendarStart, logs: calendarLogs } = useMemo(
    () => (IS_DEV_BUILD
      ? buildDevCalendar(devDataset, startDate ?? '', logs)
      : { startDate: startDate ?? '', logs }),
    [devDataset, startDate, logs],
  );

  const days = useMemo(
    () => (calendarStart ? buildChallengeDays(calendarStart, calendarLogs) : []),
    [calendarStart, calendarLogs],
  );
  const summary = useMemo(() => getChallengeSummary(days), [days]);
  const selectedDay = selectedDayNumber ? days[selectedDayNumber - 1] : undefined;
  const progress = Math.min(100, Math.round(((currentDay || summary.finished) / 75) * 100));

  const devToggle = IS_DEV_BUILD ? (
    <DevDatasetPicker
      selected={devDataset}
      onSelect={setDevDataset}
      positionClassName="bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6"
    />
  ) : null;

  if (isLoading && !days.length) return <><CalendarLoading />{devToggle}</>;
  // Con un fixture elegido mostramos el calendario aunque el reto no exista:
  // justo ése es el caso que hay que poder mirar.
  if (!isDevDataset && (!isActive || !startDate)) return <><EmptyCalendar />{devToggle}</>;
  if (!calendarStart) return <><EmptyCalendar />{devToggle}</>;

  // Skeleton loading cuando los datos aún no llegan
  if (isLoading && days.length === 0) return (
    <><CalendarLoading />{devToggle}</>
  );

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

      {/* U-05: Región aria-live para anunciar cambios de vista y selección de día */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedDay
          ? `Seleccionado: ${getDayLabel(selectedDay)}`
          : `Vista activa: ${view === 'map' ? 'Mapa del reto' : 'Agenda del reto'}`}
      </div>

      {view === 'map' ? <JourneyMap days={days} onSelect={setSelectedDayNumber} /> : <AgendaView days={days} currentDay={currentDay} onSelect={setSelectedDayNumber} />}

      <div className="calendar-legend" aria-label="Estados del calendario">{statusLegend.map(({ key, label, Icon }) => <span key={key} className={`calendar-legend__item calendar-legend__item--${key}`}><Icon size={13} aria-hidden="true" /> {label}</span>)}</div>

      {devToggle}

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

function AgendaView({ days, currentDay, onSelect }: { days: ReturnType<typeof buildChallengeDays>; currentDay?: number | null; onSelect: (day: number) => void }) {
  const weeks = useMemo(() => groupChallengeWeeks(days), [days]);
  const currentWeekIndex = useMemo(() => getCurrentWeekIndex(weeks, currentDay), [weeks, currentDay]);
  const [weekIndex, setWeekIndex] = useState(() => getDefaultWeekIndex(weeks, currentDay));
  // Si el usuario cambia de reto los días cambian bajo nuestros pies: ceñimos el
  // índice a la nueva lista en vez de mostrar una semana inexistente.
  const activeIndex = Math.min(weekIndex, weeks.length - 1);
  const week = weeks[activeIndex] ?? [];
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= weeks.length - 1;
  const isCurrentWeek = activeIndex === currentWeekIndex;
  const goToWeek = (target: number) => setWeekIndex(Math.max(0, Math.min(weeks.length - 1, target)));

  return (
    <section className="calendar-agenda" aria-labelledby="agenda-title">
      <div className="calendar-section-heading"><h2 id="agenda-title">Agenda del reto</h2><span>Revisión rápida</span></div>
      <div className="calendar-week-nav">
        <button type="button" className="calendar-week-nav__arrow" onClick={() => goToWeek(activeIndex - 1)} disabled={isFirst} aria-label="Semana anterior"><ChevronLeft size={18} aria-hidden="true" /></button>
        <div className="calendar-week-nav__label" aria-live="polite">
          <p className="calendar-context-label">Semana {week[0]?.weekNumber ?? activeIndex + 1} <span>de {weeks.length}</span></p>
          {week.length ? <span className={`calendar-week-nav__range${isCurrentWeek ? ' calendar-week-nav__range--current' : ''}`}>{isCurrentWeek ? <span className="calendar-week-nav__pill">Semana actual</span> : null}<span>{format(week[0].dateValue, "d MMM", { locale: es })} – {format(week[week.length - 1].dateValue, "d MMM", { locale: es })}</span></span> : null}
        </div>
        <button type="button" className="calendar-week-nav__arrow" onClick={() => goToWeek(activeIndex + 1)} disabled={isLast} aria-label="Semana siguiente"><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <div className={`calendar-agenda__week${isCurrentWeek ? ' calendar-agenda__week--current' : ''}`}>
        {week.map((day) => <button type="button" aria-label={getDayLabel(day)} aria-current={day.isToday ? 'date' : undefined} className={`calendar-agenda-row calendar-agenda-row--${day.status}${day.isToday ? ' calendar-agenda-row--today' : ''}`} key={day.dayNumber} onClick={() => onSelect(day.dayNumber)}><span className="calendar-agenda-row__day" aria-hidden="true"><strong>{day.isToday ? <span className="calendar-agenda-row__today">Hoy · Día {day.dayNumber}</span> : `Día ${day.dayNumber}`}</strong><small>{format(day.dateValue, 'EEE d MMM', { locale: es })}</small></span><span className="calendar-agenda-row__summary" aria-hidden="true">{day.totalGoals ? `${day.completedGoals}/${day.totalGoals} metas` : 'Sin registro'}<small>{day.log?.weight ? `${day.log.weight} kg` : ''}{day.log?.photoUrl ? ' · Foto' : ''}</small></span><span className="calendar-agenda-row__mark" aria-hidden="true"><StatusIcon status={day.status} /></span></button>)}
      </div>
    </section>
  );
}

function StatusIcon({ status }: { status: string }) { if (status === 'success') return <Check size={16} aria-hidden="true" />; if (status === 'fail') return <X size={16} aria-hidden="true" />; if (status === 'rest') return <Minus size={16} aria-hidden="true" />; return <Circle size={13} aria-hidden="true" />; }

function EmptyCalendar() { const openPlansModal = useUIStore((state) => state.openPlansModal); return <div className="calendar-page calendar-empty"><CalendarDays size={32} aria-hidden="true" /><h1>Tu calendario empieza con un reto</h1><p>Elige un plan para ver tus 75 días y empezar a construir tu racha.</p><button type="button" onClick={openPlansModal}>Elegir un plan</button></div>; }
function CalendarLoading() {
  return (
    <div className="calendar-page" aria-busy="true">
      <div className="calendar-skeleton" style={{ minHeight: '80px', marginBottom: '1rem' }} />
      <div className="calendar-skeleton" style={{ minHeight: '400px' }} />
      <div className="calendar-skeleton" style={{ minHeight: '300px' }} />
      <span className="sr-only">Cargando calendario…</span>
    </div>
  );
}

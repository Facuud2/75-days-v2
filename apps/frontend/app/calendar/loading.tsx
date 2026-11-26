'use client';

export default function CalendarLoading() {
  return (
    <div className="calendar-page" aria-busy="true" aria-label="Cargando calendario">
      <div className="calendar-skeleton mb-4 min-h-[80px]" />
      <div className="calendar-skeleton mb-4 min-h-[400px]" />
      <div className="calendar-skeleton min-h-[300px]" />
    </div>
  );
}

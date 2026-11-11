import { format } from 'date-fns';

/**
 * Fecha local en formato `YYYY-MM-DD`.
 *
 * `new Date().toISOString().split('T')[0]` devuelve la fecha UTC: en husos
 * negativos, después de las 21:00 registra el día siguiente (F-41).
 */
export function getLocalDateString(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

/** Parsea `YYYY-MM-DD` como fecha local, no como UTC. */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

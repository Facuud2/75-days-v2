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

/**
 * Parsea `YYYY-MM-DD` como fecha local, o un timestamp ISO global (UTC / offset)
 * convirtiéndolo al día calendario local del huso horario del usuario.
 */
export function parseLocalDate(dateStr: string): Date {
  const trimmed = dateStr.trim();
  if (/[T\s]\d{2}:\d{2}/.test(trimmed) || /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const instant = new Date(trimmed);
    if (!Number.isNaN(instant.getTime())) {
      return new Date(instant.getFullYear(), instant.getMonth(), instant.getDate());
    }
  }
  const [year, month, day] = trimmed.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

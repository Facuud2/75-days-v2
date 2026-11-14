import { format, subMinutes } from 'date-fns';

/**
 * Fecha local del usuario en formato `YYYY-MM-DD`.
 *
 * El servidor corre en UTC, pero el reto y sus `DailyLog` viven en el calendario
 * del usuario. Si se usa `format(new Date())` a secas, a las 21:00 de Argentina
 * (00:00 UTC) el día ya cambió en el servidor y el log se guarda con la fecha de
 * mañana: aparecen dos logs para el mismo "Día 1" y la tarjeta "HOY" no coincide
 * con el día marcado en el mapa.
 *
 * `timezoneOffset` es el que devuelve `Date.prototype.getTimezoneOffset()` en el
 * navegador (minutos a restar para llegar a UTC; Argentina = 180).
 */
export function localChallengeDate(timezoneOffset?: unknown, now: Date = new Date()): string {
  const offset = typeof timezoneOffset === 'number' && Number.isFinite(timezoneOffset)
    ? timezoneOffset
    : 0;
  // getTimezoneOffset() devuelve UTC - local (Argentina = 180), así que se resta
  // para pasar de UTC a la hora del usuario.
  return format(subMinutes(now, offset), 'yyyy-MM-dd');
}

/** Normaliza el offset recibido del cliente a un número válido en minutos. */
export function parseTimezoneOffset(value: unknown): number | undefined {
  const offset = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(offset)) return undefined;
  // getTimezoneOffset() está en el rango [-840, 720] (UTC+14 … UTC-12).
  if (offset < -840 || offset > 720) return undefined;
  return offset;
}

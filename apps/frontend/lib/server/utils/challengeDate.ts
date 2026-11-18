import { format, subMinutes } from 'date-fns';

export function localChallengeDate(timezoneOffset?: unknown, now: Date = new Date()): string {
  const offset =
    typeof timezoneOffset === 'number' && Number.isFinite(timezoneOffset)
      ? timezoneOffset
      : 0;
  return format(subMinutes(now, offset), 'yyyy-MM-dd');
}

export function parseTimezoneOffset(value: unknown): number | undefined {
  const offset = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(offset)) return undefined;
  if (offset < -840 || offset > 720) return undefined;
  return offset;
}

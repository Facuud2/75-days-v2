import { z } from 'zod';

const SAFE_IMAGE_URL_REGEX =
  /^(?:https?:\/\/[^\s]+|data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+)$/i;

export function isSafeImageUrl(value: string): boolean {
  if (!value) return true;
  return SAFE_IMAGE_URL_REGEX.test(value.trim());
}

export const safeImageUrlSchema = z
  .string()
  .max(2_000_000)
  .refine(isSafeImageUrl, {
    message: 'Image URL must be an http(s) URL or a valid base64 image data URI',
  });

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    !Number.isNaN(dt.getTime()) &&
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isValidYearMonth(monthStr: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return false;
  const [y, m] = monthStr.split('-').map(Number);
  return y >= 1970 && y <= 2100 && m >= 1 && m <= 12;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'External operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`${label} timed out after ${timeoutMs}ms`);
          (err as Error & { code?: string }).code = 'ETIMEDOUT';
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

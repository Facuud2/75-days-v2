import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const numberFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
});

/** Número finito o `null`. Evita que `NaN` / `Infinity` lleguen al render. */
export function safeNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value: unknown, fallback = '—'): string {
  const parsed = safeNumber(value);
  return parsed === null ? fallback : numberFormatter.format(parsed);
}

export function formatDecimal(value: unknown, fallback = '—'): string {
  const parsed = safeNumber(value);
  return parsed === null ? fallback : decimalFormatter.format(parsed);
}

export function formatInteger(value: unknown, fallback = '—'): string {
  const parsed = safeNumber(value);
  return parsed === null ? fallback : integerFormatter.format(Math.round(parsed));
}

export function clampPercent(value: unknown, max = 100): number {
  const parsed = safeNumber(value);
  if (parsed === null || max <= 0) return 0;
  return Math.min(100, Math.max(0, (parsed / max) * 100));
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatInteger(count)} ${count === 1 ? singular : plural}`;
}

/** Primera letra legible, incluso con emoji o nombres que empiezan con signos. */
export function getInitial(name: string | null | undefined): string {
  const clean = (name || '').trim();
  if (!clean) return '?';

  const firstWord = clean.split(/\s+/)[0];

  try {
    const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });
    const first = segmenter.segment(firstWord)[Symbol.iterator]().next();
    if (!first.done && first.value?.segment) {
      return first.value.segment.toUpperCase();
    }
  } catch {
    // Intl.Segmenter no está disponible en navegadores antiguos.
  }

  return Array.from(firstWord)[0]?.toUpperCase() || '?';
}

export function parseDisplayDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

/**
 * Arroba derivada del nombre, solo para la previsualización del perfil.
 *
 * No existe un campo `username` en el modelo, así que se aproxima con el
 * nombre: minúsculas, sin acentos, sin espacios y recortado a 15 caracteres
 * como en Twitter. Devuelve `null` cuando no queda nada legible.
 */
export function getNameHandle(name: string | null | undefined): string | null {
  const clean = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return clean ? clean.slice(0, 15) : null;
}

export function formatMemberSince(value: string | null | undefined): string | null {
  const parsed = parseDisplayDate(value);
  if (!parsed) return null;
  return format(parsed, 'MMM yyyy', { locale: es });
}

export function formatShortDate(value: string | null | undefined): string | null {
  const parsed = parseDisplayDate(value);
  if (!parsed) return null;
  return format(parsed, "d MMM", { locale: es });
}

/** El backend puede enviar fechas ISO, `MM-DD` o la etiqueta `Inicio`. */
export function formatWeightDate(value: string | null | undefined): string {
  if (!value) return '—';
  if (value === 'Inicio') return 'Inicio';

  const parsed = parseDisplayDate(value);
  if (parsed) return format(parsed, 'd MMM', { locale: es });

  if (/^\d{2}-\d{2}$/.test(value)) {
    const [month, day] = value.split('-').map(Number);
    const date = new Date(2020, month - 1, day);
    return isValid(date) ? format(date, 'd MMM', { locale: es }) : value;
  }

  return value;
}

export function difficultyLabel(value: string | null | undefined): string {
  switch ((value || '').toLowerCase()) {
    case 'soft':
    case 'easy':
      return 'Suave';
    case 'medium':
      return 'Medio';
    case 'hard':
      return 'Duro';
    case 'custom':
      return 'Personalizado';
    default:
      return value || 'Activo';
  }
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snack',
};

/** El backend envía `mealType` en inglés; la UI siempre muestra español. */
export function mealTypeLabel(value: string | null | undefined): string {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'Comida';
  const label = MEAL_TYPE_LABELS[normalized];
  if (label) return label;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

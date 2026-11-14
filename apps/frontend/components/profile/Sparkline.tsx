'use client';

import { formatDecimal, formatWeightDate } from '@/lib/utils/display';

export interface WeightPoint {
  date: string;
  weight: number;
}

interface SparklineProps {
  points: WeightPoint[];
  goal?: number | null;
  initial?: number | null;
  label?: string;
}

const WIDTH = 240;
const HEIGHT = 64;
const PAD = 4;

export default function Sparkline({ points, goal, initial, label = 'Tendencia de peso' }: SparklineProps) {
  const validPoints = (points || []).filter((point) => Number.isFinite(point.weight));
  const values = validPoints.map((point) => point.weight);

  if (values.length < 2) {
    return (
      <div className="pv2-inset flex h-16 items-center px-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        Registra al menos dos pesos para ver la tendencia.
      </div>
    );
  }

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const dataSpan = dataMax - dataMin;
  // La meta y el peso inicial solo entran en el dominio si están cerca de la
  // serie. Incluirlos siempre aplasta la tendencia (una meta de 78 kg contra
  // pesos de 124–132 kg convertía la línea en una recta).
  const nearThreshold = dataSpan > 0 ? dataSpan * 0.75 : 1;

  let min = dataMin;
  let max = dataMax;

  if (initial && Number.isFinite(initial) && initial >= dataMin - nearThreshold && initial <= dataMax + nearThreshold) {
    min = Math.min(min, initial);
    max = Math.max(max, initial);
  }

  const goalInRange =
    Boolean(goal) &&
    Number.isFinite(goal as number) &&
    (goal as number) >= dataMin - nearThreshold &&
    (goal as number) <= dataMax + nearThreshold;

  if (goalInRange) {
    min = Math.min(min, goal as number);
    max = Math.max(max, goal as number);
  }

  const padding = Math.max(0.4, (max - min) * 0.12);
  min -= padding;
  max += padding;
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;

  const xFor = (index: number) => PAD + (index / (values.length - 1)) * (WIDTH - PAD * 2);
  const yFor = (value: number) => PAD + ((max - value) / span) * (HEIGHT - PAD * 2);

  const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`).join(' ');
  const lastX = xFor(values.length - 1);
  const lastY = yFor(values[values.length - 1]);
  const first = validPoints[0];
  const last = validPoints[validPoints.length - 1];
  const goalY = goalInRange ? yFor(goal as number) : null;

  const sampled = validPoints
    .filter((_, index) => index % Math.max(1, Math.ceil(validPoints.length / 10)) === 0)
    .slice(0, 12);

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-16 w-full"
        role="img"
        aria-label={`${label}: de ${formatDecimal(first.weight)} a ${formatDecimal(last.weight)} kilogramos${
          goal
            ? `, meta ${formatDecimal(goal)} kilogramos${goalInRange ? '' : ' (fuera de la tendencia)'}`
            : ''
        }.`}
        preserveAspectRatio="none"
      >
        {goalY !== null ? (
          <>
            <rect
              x={0}
              y={Math.max(0, goalY - 3)}
              width={WIDTH}
              height={6}
              fill="var(--accent-fill)"
              opacity="0.08"
            />
            <line
              x1={0}
              x2={WIDTH}
              y1={goalY}
              y2={goalY}
              stroke="var(--accent-text)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity="0.5"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}

        <path
          d={path}
          fill="none"
          stroke="var(--accent-text)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Puntos como líneas de longitud cero: con preserveAspectRatio="none"
            un <circle> se deforma en elipse al estirarse el SVG. */}
        <line
          x1={PAD}
          y1={yFor(values[0])}
          x2={PAD}
          y2={yFor(values[0])}
          stroke="var(--text-muted)"
          strokeWidth={4}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={lastX}
          y1={lastY}
          x2={lastX}
          y2={lastY}
          stroke="var(--accent-text)"
          strokeWidth={6}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <figcaption className="pv2-sr-only">
        <span>
          {label}: inicio {formatDecimal(first.weight)} kg ({formatWeightDate(first.date)}), último{' '}
          {formatDecimal(last.weight)} kg ({formatWeightDate(last.date)}).
        </span>
        <ul>
          {sampled.map((point) => (
            <li key={`${point.date}-${point.weight}`}>
              {formatWeightDate(point.date)}: {formatDecimal(point.weight)} kg
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

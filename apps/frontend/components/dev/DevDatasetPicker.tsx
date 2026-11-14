'use client';

import { useRouter } from 'next/navigation';
import DatasetToggle, { type DatasetOption } from '@/components/dev/DatasetToggle';

export const DEV_DATASETS = ['demo', 'worst', 'empty', 'one', 'thousand'] as const;
export type DevDataset = (typeof DEV_DATASETS)[number];

export const DEV_DATASET_OPTIONS: DatasetOption[] = [
  { value: 'demo', label: 'Demo data' },
  { value: 'worst', label: 'Worst case (plausible extremes)' },
  { value: 'empty', label: 'Empty / no results' },
  { value: 'one', label: 'Just one row' },
  { value: 'thousand', label: '1,000 rows (performance stress)' },
];

/** Lee `?data=` al montar (cliente). Fuera de dev siempre devuelve 'demo'. */
export function readDevDataset(): DevDataset {
  if (process.env.NODE_ENV !== 'development') return 'demo';
  if (typeof window === 'undefined') return 'demo';
  const value = new URLSearchParams(window.location.search).get('data') as DevDataset | null;
  return value && DEV_DATASETS.includes(value) ? value : 'demo';
}

export function writeDevDataset(value: DevDataset) {
  const url = new URL(window.location.href);
  if (value === 'demo') url.searchParams.delete('data');
  else url.searchParams.set('data', value);
  window.history.replaceState({}, '', url);
}

/**
 * Chrome de desarrollo: monta el control y persiste el dataset en la URL.
 * El estado vive en la página; este componente sólo lo notifica.
 */
export default function DevDatasetPicker({
  selected,
  onSelect,
  positionClassName,
}: {
  selected: DevDataset;
  onSelect: (value: DevDataset) => void;
  positionClassName?: string;
}) {
  const router = useRouter();

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-40 flex justify-center ${
        positionClassName ?? 'bottom-4'
      }`}
    >
      <div className="pointer-events-auto">
        <DatasetToggle
          selected={selected}
          options={DEV_DATASET_OPTIONS}
          onSelect={(value) => {
            const next = value as DevDataset;
            onSelect(next);
            writeDevDataset(next);
            // Mantiene la URL del router sincronizada para que un reload o un
            // cambio de pestaña conserve la selección.
            const url = new URL(window.location.href);
            const query = url.searchParams.toString();
            router.replace(query ? `${url.pathname}?${query}` : url.pathname, { scroll: false });
          }}
        />
      </div>
    </div>
  );
}

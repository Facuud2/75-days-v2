'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export type DatasetOption = {
  value: string;
  label: string;
};

/**
 * Solo dev: alterna entre el fixture de demo y los casos límite de break-ui.
 * Es sólo el control: el estado vive en la página, que elige el fixture en el
 * límite de datos (fixture, mock o props) y nunca en el markup.
 *
 * Se posiciona con un wrapper externo, porque el panel puede necesitar más
 * ancho que el botón y un `transform` en el ancestro rompería el
 * posicionamiento `fixed` del contenedor.
 */
export default function DatasetToggle({
  selected,
  options,
  onSelect,
}: {
  selected: string;
  options: DatasetOption[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const activeLabel = options.find((option) => option.value === selected)?.label ?? selected;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="dataset-toggle-panel"
        aria-label={`Datos de prueba: ${activeLabel}`}
        onClick={() => setOpen((prev) => !prev)}
        className={`
          flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-lg
          transition-[background-color,border-color,color,box-shadow] duration-200 ease-out
          active:scale-[0.97]
          ${open
            ? 'border-rose-500 bg-zinc-900 text-white ring-2 ring-rose-500/40'
            : 'border-zinc-600 bg-zinc-900/95 text-zinc-300 hover:text-white'}
        `}
      >
        <AlertTriangle className="size-4 shrink-0 text-amber-400" />
        <span className="max-w-[60vw] truncate">{activeLabel}</span>
        <span
          aria-hidden
          className={`ml-1 text-[10px] text-zinc-400 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
        >
          ▲
        </span>
      </button>

      {open && (
        <div
          id="dataset-toggle-panel"
          role="region"
          aria-label="Casos de prueba"
          className="
            absolute bottom-[calc(100%+0.5rem)] left-1/2 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2
            origin-bottom rounded-2xl border border-white/10 bg-neutral-900/95 p-1.5 shadow-2xl backdrop-blur
            animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200 ease-out
          "
        >
          <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            break-ui · datos
          </p>
          {options.map((option) => {
            const active = option.value === selected;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                className={`
                  flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm
                  transition-colors duration-150 ease-out
                  ${active ? 'bg-white text-zinc-900 font-semibold' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}
                `}
              >
                {option.label}
                {active && <span aria-hidden className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Dumbbell, Flame, Footprints, Mail, ShieldAlert, Trophy, Utensils } from 'lucide-react';

type Dataset = 'demo' | 'worst' | 'empty' | 'one' | 'thousand';

type EdgeItem = {
  id: string;
  name: string;
  email: string;
  title: string;
  status: 'success' | 'pending' | 'fail' | 'rest' | 'error';
  count: number;
  value: number | null;
  detail?: string;
};

const demoItems: EdgeItem[] = [
  { id: 'demo-1', name: 'Ana García', email: 'ana@example.com', title: 'Entrenamiento', status: 'success', count: 4, value: 45, detail: 'Todo en orden' },
  { id: 'demo-2', name: 'Carlos Ruiz', email: 'carlos@example.com', title: 'Lectura', status: 'pending', count: 2, value: 10, detail: 'Pendiente para hoy' },
];

/**
 * Datos plausibles tomados del catálogo de break-ui. Se distribuyen entre
 * filas para que los fallos de ancho, wrapping, estados y valores aparezcan
 * simultáneamente en una sola vista.
 */
const worstItems: EdgeItem[] = [
  {
    id: 'worst-1',
    name: 'Aleksandra Wiśniewska-Kowalczyk',
    email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com',
    title: 'Senior Product Design Engineer, Platform Infrastructure',
    status: 'success',
    count: 1284,
    value: 12345678.9,
    detail: 'Seán O\'Brien-Ó Súilleabháin · Línea uno\nLínea dos',
  },
  {
    id: 'worst-2',
    name: '🦊 Fox',
    email: 'a@b.co',
    title: 'Benachrichtigungseinstellungen',
    status: 'fail',
    count: 1,
    value: -42.5,
    detail: 'Sin avatar · campo opcional ausente',
  },
  {
    id: 'worst-3',
    name: '王秀英',
    email: 'first.last+billing-notifications@example.com',
    title: '<script>alert(1)</script>',
    status: 'pending',
    count: 0,
    value: 0.30000000000000004,
    detail: 'Texto literal que no debe ejecutar HTML',
  },
  {
    id: 'worst-4',
    name: 'نور الهدى عبد الرحمن',
    email: 'ops@sub.department.region.example.co.uk',
    title: 'Paramètres de confidentialité et de sécurité',
    status: 'rest',
    count: 1000000,
    value: null,
    detail: 'RTL · valor nulo · descripción ausente',
  },
  {
    id: 'worst-5',
    name: 'Jo',
    email: '👩🏽‍💻.example@example.org',
    title: 'Q3 Board Deck — FINAL (revised) v12 [approved by legal].pdf',
    status: 'error',
    count: 1,
    value: Number.NaN,
    detail: 'Error de API simulado · URL/identificador extremo',
  },
];

function makeItems(dataset: Dataset): EdgeItem[] {
  if (dataset === 'demo') return demoItems;
  if (dataset === 'worst') return worstItems;
  if (dataset === 'empty') return [];
  if (dataset === 'one') return [worstItems[1]];
  return Array.from({ length: 1000 }, (_, index) => ({
    ...worstItems[index % worstItems.length],
    id: `row-${index + 1}`,
    name: `${worstItems[index % worstItems.length].name} #${index + 1}`,
  }));
}

const statusStyles: Record<EdgeItem['status'], string> = {
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  fail: 'bg-red-500/15 text-red-300 border-red-500/30',
  rest: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  error: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
};

function formatNumber(value: number | null): string {
  if (value === null) return '—';
  if (!Number.isFinite(value)) return 'NaN';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
}

export default function EdgeCasesPage() {
  const [dataset, setDataset] = useState<Dataset>(() => {
    if (typeof window === 'undefined') return 'demo';
    const value = new URLSearchParams(window.location.search).get('data');
    return value && ['demo', 'worst', 'empty', 'one', 'thousand'].includes(value)
      ? value as Dataset
      : 'demo';
  });

  const items = useMemo(() => makeItems(dataset), [dataset]);

  const selectDataset = (next: Dataset) => {
    setDataset(next);
    const url = new URL(window.location.href);
    url.searchParams.set('data', next);
    window.history.replaceState({}, '', url);
  };

  if (process.env.NODE_ENV !== 'development') {
    return <main className="p-8">Not available outside development.</main>;
  }

  return (
    <main dir="auto" className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-28 md:p-8 md:pb-28">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <ShieldAlert className="text-rose-400" />
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
              Solo desarrollo
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Edge-case laboratory</h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
            Datos extremos plausibles para probar nombres, emails, estados, números, listas, errores, RTL,
            campos faltantes y carga de 1.000 filas sin modificar la base de datos.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Stat icon={<Trophy />} label="Registros" value={items.length.toLocaleString('es-AR')} />
          <Stat icon={<Flame />} label="Estados cubiertos" value={new Set(items.map(item => item.status)).size.toString()} />
          <Stat icon={<Mail />} label="Emails extremos" value={items.filter(item => item.email.length > 35).length.toString()} />
          <Stat icon={<Clock3 />} label="Modo" value={dataset === 'thousand' ? 'Stress' : dataset} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
          <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[.03]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
              <div>
                <h2 className="font-bold">Daily challenge data</h2>
                <p className="text-sm text-zinc-500">Cada fila mezcla un caso problemático distinto.</p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                {items.length.toLocaleString('es-AR')} items
              </span>
            </div>

            {items.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="max-h-[720px] overflow-auto p-3">
                {items.map(item => (
                  <article key={item.id} className="grid min-w-0 gap-4 border-b border-white/5 p-4 last:border-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
                        {item.name.startsWith('🦊') ? '🦊' : item.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold leading-6">{item.name}</h3>
                        <p className="break-all text-xs leading-5 text-zinc-400">{item.email}</p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="break-words font-medium">{item.title}</p>
                      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-zinc-500">{item.detail}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                      <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[item.status]}`}>
                        {item.status}
                      </span>
                      <span className="tabular-nums whitespace-nowrap text-xs text-zinc-400">{item.count.toLocaleString('es-AR')} · {formatNumber(item.value)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="min-w-0 space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5">
              <h2 className="mb-4 font-bold">Other surfaces</h2>
              <div className="space-y-3">
                <Surface icon={<Utensils />} label="Meal" value="2,000 kcal · null macros · 1 serving" />
                <Surface icon={<Dumbbell />} label="Workout" value="walking · 1,284 min · — km" />
                <Surface icon={<Footprints />} label="Progress" value="-3% · 142% · NaN" />
                <Surface icon={<AlertTriangle />} label="API error" value="TypeError: logs is undefined" error />
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5">
              <h2 className="mb-3 font-bold">Manual checks</h2>
              <ul className="space-y-2 text-sm leading-6 text-zinc-400">
                <li>• 320px viewport y 200% zoom</li>
                <li>• dark mode y <code>dir=&quot;rtl&quot;</code></li>
                <li>• teclado: foco visible y botones alcanzables</li>
                <li>• alternar estados sin recargar</li>
                <li>• scroll de 1.000 filas</li>
              </ul>
            </section>
          </aside>
        </section>
      </div>

      <nav aria-label="Edge case dataset" className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap justify-center gap-1 rounded-2xl border border-zinc-700 bg-zinc-900/95 p-1.5 font-sans text-xs shadow-2xl backdrop-blur">
        {(['demo', 'worst', 'empty', 'one', 'thousand'] as Dataset[]).map(option => (
          <button
            key={option}
            type="button"
            onClick={() => selectDataset(option)}
            className={`rounded-xl px-3 py-2 capitalize transition-none ${dataset === option ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}
          >
            {option === 'thousand' ? '1,000 rows' : option === 'one' ? 'One' : option}
          </button>
        ))}
      </nav>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <span className="shrink-0 text-rose-300">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="tabular-nums break-words font-bold">{value}</p>
      </div>
    </div>
  );
}

function Surface({ icon, label, value, error = false }: { icon: React.ReactNode; label: string; value: string; error?: boolean }) {
  return (
    <div className={`flex min-w-0 items-start gap-3 rounded-2xl border p-3 ${error ? 'border-red-500/30 bg-red-500/10' : 'border-white/10 bg-black/10'}`}>
      <span className="shrink-0 text-zinc-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="break-words text-sm text-zinc-300">{value}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
      <CheckCircle2 className="text-zinc-600" />
      <h3 className="font-bold">No data</h3>
      <p className="text-sm text-zinc-500">La UI debe explicar el estado vacío sin dejar un panel roto.</p>
    </div>
  );
}

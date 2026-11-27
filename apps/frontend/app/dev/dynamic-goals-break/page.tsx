'use client';

import React, { useState } from 'react';
import { Check, Clock, Target, Trophy, CalendarRange, CalendarClock } from 'lucide-react';
import InlineMetricEditor from '@/components/InlineMetricEditor';

type DatasetMode = 'demo' | 'worst' | 'empty' | 'one';

interface MockGoal {
  id: string;
  title: string;
  description?: string | null;
  cadence: 'daily' | 'weekly' | 'monthly' | 'once';
  measurementType: 'boolean' | 'count' | 'numeric';
  currentValue: number;
  targetValue: number;
  targetUnit?: string | null;
  completed: boolean;
  failed?: boolean;
}

const DATASETS: Record<DatasetMode, MockGoal[]> = {
  demo: [
    {
      id: 'd1',
      title: 'Caminar 8.000 pasos',
      description: 'Completar caminata diaria antes de la medianoche.',
      cadence: 'daily',
      measurementType: 'numeric',
      currentValue: 4500,
      targetValue: 8000,
      targetUnit: 'pasos',
      completed: false,
    },
    {
      id: 'd2',
      title: 'Agua (3.7L)',
      description: 'Beber al menos 3.7 litros de agua.',
      cadence: 'daily',
      measurementType: 'numeric',
      currentValue: 3.7,
      targetValue: 3.7,
      targetUnit: 'L',
      completed: true,
    },
    {
      id: 'd3',
      title: 'Cocinar en casa',
      description: 'Preparar comidas saludables 4 veces por semana.',
      cadence: 'weekly',
      measurementType: 'count',
      currentValue: 2,
      targetValue: 4,
      targetUnit: 'veces',
      completed: false,
    },
    {
      id: 'd4',
      title: 'Correr 60 km al mes',
      description: 'Distancia acumulada en running outdoor o cinta.',
      cadence: 'monthly',
      measurementType: 'numeric',
      currentValue: 22.5,
      targetValue: 60,
      targetUnit: 'km',
      completed: false,
    },
  ],
  worst: [
    {
      id: 'w1',
      title: 'Entrenamiento cardiovascular interválico de alta intensidad al aire libre con registro en Strava y sincronización automática',
      description: 'Completar la distancia objetivo sin saltarse el calentamiento previo ni la elongación posterior; registrar también frecuencia cardíaca promedio y sensaciones.',
      cadence: 'daily',
      measurementType: 'numeric',
      currentValue: 98765.43,
      targetValue: 100000,
      targetUnit: 'pasos/día-acumulados',
      completed: false,
    },
    {
      id: 'w2',
      title: 'X',
      description: null,
      cadence: 'weekly',
      measurementType: 'count',
      currentValue: 1,
      targetValue: 1,
      targetUnit: 'vez',
      completed: true,
    },
    {
      id: 'w3',
      title: 'supercalifragilisticexpialidocious-unbreakable-metric-identifier-2026-challenge',
      description: 'https://strava.example.com/activities/very-long-unbreakable-url-that-should-not-overflow-the-mobile-card-container',
      cadence: 'monthly',
      measurementType: 'numeric',
      currentValue: 0,
      targetValue: 999999.99,
      targetUnit: 'kilocalorías',
      completed: false,
    },
    {
      id: 'w4',
      title: '🏃‍♂️🔥 Bajar 12.5 kg en 75 días manteniendo 180g de proteína diaria 💪🥗',
      description: 'Meta fallida de prueba con emojis y números decimales precisos.',
      cadence: 'once',
      measurementType: 'numeric',
      currentValue: 3.3333333,
      targetValue: 12.5,
      targetUnit: 'kg',
      completed: false,
      failed: true,
    },
    {
      id: 'w5',
      title: 'Sin unidad definida (solo número grande)',
      description: '',
      cadence: 'daily',
      measurementType: 'numeric',
      currentValue: 1284500,
      targetValue: 1000000,
      targetUnit: null,
      completed: true,
    },
  ],
  empty: [],
  one: [
    {
      id: 'o1',
      title: '1 sesión de movilidad',
      description: 'Única meta activa con valor 1.',
      cadence: 'weekly',
      measurementType: 'count',
      currentValue: 1,
      targetValue: 1,
      targetUnit: 'sesión',
      completed: true,
    },
  ],
};

const CADENCE_LABEL: Record<string, string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  monthly: 'Mensual',
  once: 'Única',
};

export default function DynamicGoalsBreakPage() {
  const [mode, setMode] = useState<DatasetMode>('demo');
  const [itemsByMode, setItemsByMode] = useState<Record<DatasetMode, MockGoal[]>>(DATASETS);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const items = itemsByMode[mode];

  const updateItem = (id: string, nextVal: number) => {
    setItemsByMode((prev) => ({
      ...prev,
      [mode]: prev[mode].map((item) =>
        item.id === id
          ? {
              ...item,
              currentValue: Math.max(0, nextVal),
              completed: Math.max(0, nextVal) >= item.targetValue,
            }
          : item
      ),
    }));
  };

  const calcPct = (list: MockGoal[]) => {
    if (list.length === 0) return 0;
    const sum = list.reduce(
      (acc, g) => acc + Math.min(1, g.targetValue > 0 ? g.currentValue / g.targetValue : 0),
      0
    );
    return Math.round((sum / list.length) * 100);
  };

  const dailyList = items.filter((i) => i.cadence === 'daily');
  const weeklyList = items.filter((i) => i.cadence === 'weekly');
  const monthlyList = items.filter((i) => i.cadence === 'monthly');

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] p-4 pb-24 max-w-2xl mx-auto space-y-5">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-rose-500">
          Break-UI Stress Harness (Dev Only)
        </p>
        <h1 className="text-xl font-bold break-words">
          Metas y Misiones Dinámicas — Stress Test
        </h1>
      </header>

      {/* Multi-horizon summary */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Progreso multi-horizonte
        </h2>
        {items.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Sin metas configuradas para mostrar.</p>
        ) : (
          <div className="space-y-2">
            {dailyList.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="font-medium text-[var(--text-secondary)]">Hoy (Diario)</span>
                  <span className="font-bold text-rose-400">{calcPct(dailyList)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface-inset)] overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${calcPct(dailyList)}%` }} />
                </div>
              </div>
            )}
            {weeklyList.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="inline-flex items-center gap-1 font-medium text-sky-400">
                    <CalendarRange size={12} /> Semanal
                  </span>
                  <span className="font-bold text-sky-400">{calcPct(weeklyList)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface-inset)] overflow-hidden">
                  <div className="h-full bg-sky-400 rounded-full" style={{ width: `${calcPct(weeklyList)}%` }} />
                </div>
              </div>
            )}
            {monthlyList.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="inline-flex items-center gap-1 font-medium text-violet-400">
                    <CalendarClock size={12} /> Mensual
                  </span>
                  <span className="font-bold text-violet-400">{calcPct(monthlyList)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface-inset)] overflow-hidden">
                  <div className="h-full bg-violet-400 rounded-full" style={{ width: `${calcPct(monthlyList)}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Goals list */}
      <section className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-8 text-center text-sm text-[var(--text-muted)]">
            No hay tareas activas en este escenario vacío.
          </div>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-4 transition-colors ${
                item.completed
                  ? 'border-emerald-500/35 bg-emerald-500/10'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                  {item.cadence === 'once' ? <Trophy size={16} /> : <Target size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <h3 className="font-semibold text-sm leading-snug [overflow-wrap:anywhere] min-w-0">
                      {item.title}
                    </h3>
                    <span
                      className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        item.completed
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-[var(--border-control)]'
                      }`}
                    >
                      {item.completed && <Check size={13} strokeWidth={3} />}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-xs text-[var(--text-secondary)] [overflow-wrap:anywhere]">
                      {item.description}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Clock size={11} className="shrink-0" />
                      {CADENCE_LABEL[item.cadence]}
                    </span>
                  </div>
                </div>
              </div>

              <InlineMetricEditor
                currentValue={item.currentValue}
                targetValue={item.targetValue}
                targetUnit={item.targetUnit}
                measurementType={item.measurementType}
                isCompleted={item.completed}
                isFailed={item.failed}
                compact
                onDelta={(delta) => updateItem(item.id, item.currentValue + delta)}
                onSetValue={(val) => updateItem(item.id, val)}
              />
            </article>
          ))
        )}
      </section>

      {/* Fixed Break-UI Toggle */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full bg-neutral-900/95 border border-neutral-700 p-1 shadow-xl text-xs font-medium"
        role="group"
        aria-label="Break-UI dataset selector"
      >
        {(
          [
            ['demo', 'Demo'],
            ['worst', 'Worst case'],
            ['empty', 'Empty'],
            ['one', 'One'],
          ] as Array<[DatasetMode, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap ${
              mode === key
                ? 'bg-white text-neutral-950 font-semibold'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </main>
  );
}

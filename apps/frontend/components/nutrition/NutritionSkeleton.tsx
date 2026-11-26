'use client';

/**
 * Skeleton fiel al layout real de /nutrition para transiciones instantáneas
 * y carga inicial sin parpadeos de "0 kcal".
 */
export default function NutritionSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando nutrición"
      className="mx-auto w-full max-w-3xl space-y-4 pb-6"
    >
      {/* Top Header + Date Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <div className="pv2-skeleton h-3 w-32 rounded" />
          <div className="pv2-skeleton h-8 w-36 rounded-lg" />
        </div>
        <div className="pv2-skeleton h-10 w-40 rounded-full" />
      </div>

      {/* Card 1: Calorías consumidas + Macros */}
      <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <div className="pv2-skeleton h-3 w-28 rounded" />
            <div className="pv2-skeleton h-8 w-44 rounded-lg" />
          </div>
          <div className="pv2-skeleton h-6 w-20 rounded-full" />
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-inset)]">
          <div className="pv2-skeleton h-full w-2/5 rounded-full" />
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="pv2-skeleton h-3 w-16 rounded" />
              <div className="pv2-skeleton h-1.5 w-full rounded-full" />
              <div className="pv2-skeleton h-3 w-12 rounded" />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <div className="pv2-skeleton h-11 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <div className="pv2-skeleton h-10 w-full rounded-xl" />
            <div className="pv2-skeleton h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* Card 2: Calorías por quemar */}
      <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1.5">
            <div className="pv2-skeleton h-3 w-28 rounded" />
            <div className="pv2-skeleton h-7 w-20 rounded-lg" />
          </div>
          <div className="pv2-skeleton h-10 w-10 rounded-full" />
        </div>
        <div className="pv2-skeleton h-2 w-full rounded-full" />
      </div>

      {/* Card 3: Plan de comidas */}
      <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="pv2-skeleton h-5 w-32 rounded" />
          <div className="flex gap-2">
            <div className="pv2-skeleton h-7 w-16 rounded-full" />
            <div className="pv2-skeleton h-7 w-20 rounded-full" />
          </div>
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="pv2-skeleton h-16 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

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

      {/* Card 1: Calorías consumidas + Macros (estilo BitePal) */}
      <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="pv2-skeleton h-4 w-36 rounded" />
            <div className="pv2-skeleton h-11 w-32 rounded-lg" />
          </div>
          <div className="pv2-skeleton h-[74px] w-[74px] shrink-0 rounded-full" />
        </div>

        <div className="grid grid-cols-3 gap-4 sm:gap-5">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <div className="pv2-skeleton h-3.5 w-16 rounded" />
              <div className="pv2-skeleton h-2 w-full rounded-full" />
              <div className="pv2-skeleton h-3 w-12 rounded" />
            </div>
          ))}
        </div>

        {/* Overlapping meal thumbnails placeholder */}
        <div className="flex items-center -space-x-3.5 pt-0.5">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="pv2-skeleton h-[68px] w-[68px] shrink-0 rounded-full border-[3px] border-[var(--surface-card)]"
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--divider)] pt-3">
          <div className="pv2-skeleton h-6 w-28 rounded-full" />
          <div className="flex gap-1.5">
            <div className="pv2-skeleton h-8 w-24 rounded-full" />
            <div className="pv2-skeleton h-8 w-28 rounded-full" />
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

'use client';

/**
 * Skeleton fiel al layout real de /fitness para transiciones instantáneas
 * y carga inicial sin saltos de layout.
 */
export default function FitnessSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando fitness"
      className="mx-auto w-full max-w-4xl space-y-5 pb-6"
    >
      {/* Top Header + History Icon */}
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1.5">
          <div className="pv2-skeleton h-3 w-36 rounded" />
          <div className="pv2-skeleton h-8 w-28 rounded-lg" />
        </div>
        <div className="pv2-skeleton h-11 w-11 rounded-full" />
      </div>

      {/* Meta de hoy + Primary CTA card */}
      <div className="rounded-3xl border border-zinc-800/90 bg-zinc-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="pv2-skeleton h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <div className="pv2-skeleton h-3 w-20 rounded" />
              <div className="pv2-skeleton h-5 w-28 rounded" />
            </div>
          </div>
          <div className="pv2-skeleton h-6 w-20 rounded-full" />
        </div>

        <div className="pv2-skeleton h-2 w-full rounded-full" />

        <div className="space-y-2.5 pt-1">
          <div className="pv2-skeleton h-14 w-full rounded-2xl" />
          <div className="pv2-skeleton h-12 w-full rounded-2xl" />
        </div>
      </div>

      {/* Rutinas listas para hoy */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="pv2-skeleton h-5 w-44 rounded" />
          <div className="pv2-skeleton h-8 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 space-y-3"
            >
              <div className="pv2-skeleton h-5 w-32 rounded" />
              <div className="space-y-1.5">
                <div className="pv2-skeleton h-3 w-full rounded" />
                <div className="pv2-skeleton h-3 w-3/4 rounded" />
              </div>
              <div className="pv2-skeleton h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

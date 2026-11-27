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
      {/* Compact Header */}
      <div className="space-y-1.5">
        <div className="pv2-skeleton h-3 w-28 rounded" />
        <div className="pv2-skeleton h-8 w-24 rounded-lg" />
      </div>

      {/* Hero Daily Balance Card (Ring + Primary CTA) */}
      <div className="rounded-[26px] border border-white/[0.08] bg-zinc-900/75 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="pv2-skeleton h-3 w-20 rounded" />
            <div className="pv2-skeleton h-8 w-32 rounded-lg" />
            <div className="pv2-skeleton h-5 w-24 rounded-full" />
          </div>
          <div className="pv2-skeleton h-[74px] w-[74px] shrink-0 rounded-full" />
        </div>
        <div className="pv2-skeleton h-12 w-full rounded-2xl" />
      </div>

      {/* 4 Quick Actions Row */}
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-zinc-900/55 p-2"
          >
            <div className="pv2-skeleton h-9 w-9 rounded-xl" />
            <div className="pv2-skeleton h-3 w-12 rounded" />
          </div>
        ))}
      </div>

      {/* Compact Routine Rows */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="pv2-skeleton h-4 w-32 rounded" />
          <div className="pv2-skeleton h-4 w-16 rounded" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-zinc-900/55 p-2.5"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="pv2-skeleton h-10 w-10 shrink-0 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <div className="pv2-skeleton h-4 w-36 rounded" />
                  <div className="pv2-skeleton h-3 w-28 rounded" />
                </div>
              </div>
              <div className="pv2-skeleton h-11 w-11 shrink-0 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

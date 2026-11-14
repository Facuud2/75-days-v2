'use client';

/**
 * F-02: Suspense boundary — Dashboard skeleton.
 * Muestra un esqueleto fiel al layout real mientras se cargan los datos.
 */
export default function DashboardLoading() {
  return (
    <div className="dashboard-page grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      {/* Left Column */}
      <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-4">
        {/* Resumen del día */}
        <div className="bg-rose-950/20 border border-rose-950/40 rounded-3xl p-4 sm:p-6 shadow-lg space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="pv2-skeleton h-3 w-20" />
              <div className="pv2-skeleton h-5 w-32" />
            </div>
            <div className="pv2-skeleton h-6 w-16" />
          </div>
          <div className="flex items-baseline gap-1">
            <div className="pv2-skeleton h-10 w-24" />
            <div className="pv2-skeleton h-5 w-20" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="pv2-skeleton h-3 w-24" />
              <div className="pv2-skeleton h-3 w-12" />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-rose-500/40 w-1/2" />
            </div>
          </div>
          <div className="pt-4 border-t border-white/10 space-y-2">
            <div className="flex items-center gap-2">
              <div className="pv2-skeleton h-5 w-5 rounded-full" />
              <div className="pv2-skeleton h-3 w-28" />
            </div>
          </div>
        </div>

        {/* Mini calendario */}
        <div className="dashboard-calendar-card bg-rose-950/20 border border-rose-950/40 rounded-3xl p-6 shadow-lg space-y-4">
          <div className="flex justify-between items-center">
            <div className="pv2-skeleton h-5 w-24" />
            <div className="flex gap-2">
              <div className="pv2-skeleton h-6 w-6 rounded-full" />
              <div className="pv2-skeleton h-6 w-6 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="pv2-skeleton h-4 w-full rounded" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="pv2-skeleton h-8 w-8 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="lg:col-span-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 sm:mb-8 gap-3">
          <div className="space-y-2">
            <div className="pv2-skeleton h-6 w-36" />
            <div className="pv2-skeleton h-4 w-40" />
          </div>
          <div className="pv2-skeleton h-10 w-full sm:w-48 rounded-xl" />
        </div>

        {/* Tareas */}
        <div className="space-y-3">
          <div className="pv2-skeleton h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="pv2-skeleton h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

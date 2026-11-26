'use client';

export default function SettingsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando ajustes"
      className="mx-auto w-full max-w-5xl px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:py-8"
    >
      <div className="mb-6 space-y-2">
        <div className="pv2-skeleton h-8 w-44" />
        <div className="pv2-skeleton h-4 w-64" />
      </div>
      <div className="space-y-4">
        <div className="pv2-skeleton h-20 w-full rounded-2xl" />
        <div className="pv2-skeleton h-36 w-full rounded-2xl" />
        <div className="pv2-skeleton h-28 w-full rounded-2xl" />
      </div>
    </div>
  );
}

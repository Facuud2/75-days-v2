'use client';

/**
 * F-02: Suspense boundary — Profile skeleton.
 * Muestra un esqueleto fiel al layout real mientras se cargan los datos.
 */
export default function ProfileLoading() {
  return (
    <div className="pv2-page mx-auto w-full max-w-6xl pb-6" aria-busy="true" aria-label="Cargando perfil">
      <span className="pv2-sr-only">Cargando perfil…</span>
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside>
          <div className="space-y-4 p-4">
            <div className="pv2-skeleton h-10 w-10 rounded-full" />
            <div className="pv2-skeleton h-5 w-32" />
            <div className="pv2-skeleton h-3 w-20" />
            <div className="pv2-skeleton h-3 w-24" />
          </div>
        </aside>
        <div className="mt-3 space-y-3 lg:mt-0">
          {['01', '02', '03'].map((index) => (
            <div key={index} className="pv2-section p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="pv2-skeleton h-3 w-6" />
                <div className="pv2-skeleton h-5 w-24" />
              </div>
              <div className="pv2-skeleton h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

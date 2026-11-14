'use client';

import ProfileHeader from './ProfileHeader';

const SKELETON_SECTIONS = [
  { id: 'retos', defaultOpen: true, titleWidth: 'w-16', summaryWidth: 'w-24' },
  { id: 'salud', defaultOpen: false, titleWidth: 'w-14', summaryWidth: 'w-28' },
  { id: 'logros', defaultOpen: false, titleWidth: 'w-16', summaryWidth: 'w-20' },
] as const;

const FOOTER_ROW_WIDTHS = ['w-24', 'w-16', 'w-28'] as const;

export default function ProfileSkeleton() {
  return (
    <div className="pv2-page mx-auto w-full max-w-6xl pb-6" aria-busy="true" aria-label="Cargando perfil">
      <span className="pv2-sr-only">Cargando perfil…</span>
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ProfileHeader
            name=""
            level={1}
            memberSince={null}
            onEdit={() => {}}
            onAvatar={() => {}}
            loading
          />
        </aside>

        <div className="mt-3 space-y-3 lg:mt-0">
          {SKELETON_SECTIONS.map((section) => (
            <section key={section.id} className="pv2-section">
              <div className="pv2-trigger lg:hidden" aria-hidden="true">
                <div className="pv2-skeleton h-3 w-7 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className={`pv2-skeleton h-4 ${section.titleWidth}`} />
                  <div className={`pv2-skeleton h-3.5 ${section.summaryWidth}`} />
                </div>
                <div className="pv2-skeleton h-4 w-4 shrink-0 rounded" />
              </div>

              <div className="hidden items-baseline gap-3 px-6 pb-3 pt-5 lg:flex" aria-hidden="true">
                <div className="pv2-skeleton h-3 w-7 shrink-0" />
                <div className={`pv2-skeleton h-5 ${section.titleWidth}`} />
                <div className={`pv2-skeleton ml-auto h-3.5 ${section.summaryWidth}`} />
              </div>

              {section.defaultOpen ? (
                <div className="space-y-4 px-4 pb-4 lg:px-6 lg:pb-6">
                  <div className="pv2-skeleton h-4 w-28" />
                  <div className="pv2-skeleton h-9 w-44" />
                  <div className="pv2-skeleton h-1 w-full" />
                  <div className="pv2-skeleton h-11 w-full" />
                  <div className="pv2-skeleton h-14 w-full" />
                </div>
              ) : (
                <div className="hidden space-y-4 px-6 pb-6 lg:block">
                  <div className="pv2-skeleton h-5 w-32" />
                  <div className="pv2-skeleton h-16 w-full" />
                  <div className="pv2-skeleton h-14 w-full" />
                </div>
              )}
            </section>
          ))}

          <footer className="pt-2">
            <div className="pv2-card overflow-hidden">
              {FOOTER_ROW_WIDTHS.map((widthClass, idx) => (
                <div
                  key={widthClass + idx}
                  className={`pv2-row ${idx < FOOTER_ROW_WIDTHS.length - 1 ? 'border-b' : ''}`}
                  style={idx < FOOTER_ROW_WIDTHS.length - 1 ? { borderColor: 'var(--divider)' } : undefined}
                >
                  <div className="pv2-skeleton h-4 w-4 shrink-0 rounded" />
                  <div className={`pv2-skeleton h-4 ${widthClass}`} />
                  <div className="pv2-skeleton ml-auto h-4 w-4 shrink-0 rounded" />
                </div>
              ))}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

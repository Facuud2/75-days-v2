'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Bell,
  Compass,
  Crown,
  Lock,
  Palette,
  RotateCcw,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useUIStore } from '@/store/useUIStore';
import { resetAndQueueTutorial } from '@/lib/tutorial';
import { readDevDataset } from '@/components/dev/DevDatasetPicker';
import type { DevDataset } from '@/components/dev/DevDatasetPicker';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSheet } from '@/components/settings/SettingsSheet';
import { ProfileHeroCard } from '@/components/settings/sections/ProfileHeroCard';
import { PasswordForm } from '@/components/settings/sections/PasswordForm';
import { AppearanceSection } from '@/components/settings/sections/AppearanceSection';
import {
  ChallengeMembershipDetails,
  ChallengeMembershipSummary,
} from '@/components/settings/sections/ChallengeMembershipSection';
import { NotificationsSection } from '@/components/settings/sections/NotificationsSection';

const DevDatasetPicker = dynamic(
  () => import('@/components/dev/DevDatasetPicker'),
  { ssr: false }
);

const IS_DEV_BUILD = process.env.NODE_ENV === 'development';

type DesktopCategory =
  | 'security'
  | 'membership'
  | 'appearance'
  | 'notifications'
  | 'guide';

type MobileSheet = 'password' | 'plans' | null;

const DESKTOP_CATEGORIES: {
  id: DesktopCategory;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    id: 'security',
    label: 'Seguridad',
    subtitle: 'Actualizá tu contraseña de acceso',
    icon: Lock,
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
  },
  {
    id: 'membership',
    label: 'Desafío y Membresía',
    subtitle: 'Programa activo y planes disponibles',
    icon: Crown,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-500',
  },
  {
    id: 'appearance',
    label: 'Apariencia',
    subtitle: 'Modo oscuro/claro y paleta de colores',
    icon: Palette,
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-[var(--accent-text)]',
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    subtitle: 'Recordatorios, rachas y resúmenes',
    icon: Bell,
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-[var(--status-info)]',
  },
  {
    id: 'guide',
    label: 'Guía y Tutorial',
    subtitle: 'Repetí el recorrido inicial por la app',
    icon: Compass,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isActive } = useChallengeStore();
  const { selectedPlan } = useSettingsStore();
  const { openTutorial } = useUIStore();

  const handleReplayTutorial = () => {
    resetAndQueueTutorial(user?.id);
    openTutorial();
    router.push('/dashboard');
  };

  const [activeCategory, setActiveCategory] =
    useState<DesktopCategory>('security');
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [devDataset, setDevDataset] = useState<DevDataset>(() =>
    readDevDataset()
  );

  const displayName =
    devDataset === 'worst'
      ? 'Alejandra María de los Ángeles Wiśniewska-Kowalczyk'
      : devDataset === 'one'
        ? 'Jo'
        : devDataset === 'empty'
          ? ''
          : user?.name ?? '';

  const displayEmail =
    devDataset === 'worst'
      ? 'bartholomew.fitzgerald@northwind-industries-holdings.example.com'
      : devDataset === 'one'
        ? 'jo@b.co'
        : devDataset === 'empty'
          ? ''
          : user?.email ?? '';

  const currentDesktopMeta =
    DESKTOP_CATEGORIES.find((c) => c.id === activeCategory) ??
    DESKTOP_CATEGORIES[0];

  return (
    <div className="settings-surface min-h-screen w-full bg-[var(--surface-page)] text-[var(--text-primary)] animate-in fade-in duration-200">
      <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:py-8">
        {/* ── iOS Large Title Header ── */}
        <header className="mb-5 lg:mb-7">
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Configuración
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Personalizá tu experiencia en 75 Days
          </p>
        </header>

        {/* ════════════════════════════════════════════════════════════════════
            MOBILE LAYOUT (< lg): iOS Inset Grouped + Bottom Sheets
           ════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-6 lg:hidden">
          <ProfileHeroCard
            name={displayName}
            email={displayEmail}
            avatarUrl={user?.avatarUrl}
            selectedPlan={selectedPlan}
            isActiveChallenge={isActive}
          />

          <SettingsGroup title="Seguridad">
            <SettingsRow
              icon={Lock}
              iconBgClass="bg-indigo-500/15"
              iconColorClass="text-indigo-400"
              title="Cambiar contraseña"
              onClick={() => setMobileSheet('password')}
            />
          </SettingsGroup>

          <ChallengeMembershipSummary
            onOpenPlansSheet={() => setMobileSheet('plans')}
          />

          <AppearanceSection />

          <NotificationsSection />

          <SettingsGroup title="Guía y Ayuda">
            <SettingsRow
              icon={Compass}
              iconBgClass="bg-emerald-500/15"
              iconColorClass="text-emerald-400"
              title="Repetir tutorial"
              subtitle="Volvé a ver el recorrido por el sitio"
              onClick={handleReplayTutorial}
            />
          </SettingsGroup>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            DESKTOP LAYOUT (>= lg): Master-Detail (System Settings style)
           ════════════════════════════════════════════════════════════════════ */}
        <div className="hidden lg:grid lg:grid-cols-[270px_minmax(0,1fr)] lg:items-start lg:gap-7">
          <aside className="sticky top-24 space-y-4">
            <ProfileHeroCard
              name={displayName}
              email={displayEmail}
              avatarUrl={user?.avatarUrl}
              selectedPlan={selectedPlan}
              isActiveChallenge={isActive}
              compact
            />

            <nav
              aria-label="Categorías de configuración"
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1.5 space-y-1"
            >
              {DESKTOP_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const active = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      active
                        ? 'bg-[var(--surface-inset)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-inset)]/60 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${category.iconBg}`}
                      aria-hidden="true"
                    >
                      <Icon className={`h-4 w-4 ${category.iconColor}`} />
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold">
                      {category.label}
                    </span>
                    {active && (
                      <span
                        aria-hidden="true"
                        className="h-4 w-1 rounded-full bg-[var(--accent-fill)]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 space-y-5">
            <div className="border-b border-[var(--divider)] pb-3">
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                {currentDesktopMeta.label}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                {currentDesktopMeta.subtitle}
              </p>
            </div>

            {activeCategory === 'security' && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                <PasswordForm />
              </div>
            )}

            {activeCategory === 'membership' && <ChallengeMembershipDetails />}

            {activeCategory === 'appearance' && <AppearanceSection />}

            {activeCategory === 'notifications' && <NotificationsSection />}

            {activeCategory === 'guide' && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      Recorrido inicial de 75 Days
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">
                      Repasá las funciones básicas: metas diarias, misiones secundarias, acciones rápidas y navegación por el sitio.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReplayTutorial}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-400 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>Repetir tutorial</span>
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE BOTTOM SHEETS
         ══════════════════════════════════════════════════════════════════════ */}
      <SettingsSheet
        isOpen={mobileSheet === 'password'}
        onClose={() => setMobileSheet(null)}
        title="Cambiar contraseña"
        subtitle="Ingresá tu contraseña actual y elegí una nueva"
      >
        <PasswordForm onSuccess={() => setMobileSheet(null)} />
      </SettingsSheet>

      <SettingsSheet
        isOpen={mobileSheet === 'plans'}
        onClose={() => setMobileSheet(null)}
        title="Desafío y Membresía"
        subtitle="Compará planes y gestioná tu suscripción"
      >
        <ChallengeMembershipDetails />
      </SettingsSheet>

      {/* break-ui · selector de datasets (sólo dev) */}
      {IS_DEV_BUILD && (
        <DevDatasetPicker
          selected={devDataset}
          onSelect={setDevDataset}
          positionClassName="bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6"
        />
      )}
    </div>
  );
}

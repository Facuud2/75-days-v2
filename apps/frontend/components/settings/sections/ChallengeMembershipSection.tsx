'use client';

import React from 'react';
import { Check, Crown, Infinity, Shield, Target, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useUIStore } from '@/store/useUIStore';
import { PlanId, useSettingsStore } from '@/store/useSettingsStore';
import { SettingsGroup } from '../SettingsGroup';
import { SettingsRow } from '../SettingsRow';

interface PlanDefinition {
  id: PlanId;
  name: string;
  price: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  badge: string | null;
  features: string[];
}

export const MEMBERSHIP_PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Gratuito',
    price: 'Gratis',
    icon: Shield,
    iconColor: 'text-[var(--text-muted)]',
    iconBg: 'bg-[var(--surface-inset)]',
    badge: null,
    features: [
      '1 desafío activo',
      '3 planes predefinidos',
      'Estadísticas básicas',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$4.99/mes',
    icon: Zap,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-500/15',
    badge: 'Popular',
    features: [
      'Desafíos ilimitados',
      'Plan personalizado',
      'Estadísticas avanzadas',
      'Sin anuncios',
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: '$9.99/mes',
    icon: Infinity,
    iconColor: 'text-[var(--accent-text)]',
    iconBg: 'bg-rose-500/15',
    badge: null,
    features: [
      'Todo lo de Pro',
      'Coach IA personalizado',
      'Exportar datos',
      'Acceso anticipado',
    ],
  },
];

export function ChallengeMembershipDetails() {
  const { isActive } = useChallengeStore();
  const { openPlansModal } = useUIStore();
  const { selectedPlan, setSelectedPlan } = useSettingsStore();

  const handleSelectPlan = (plan: PlanDefinition) => {
    setSelectedPlan(plan.id);
    toast.success(`Plan ${plan.name} seleccionado`);
  };

  return (
    <div className="space-y-6">
      <SettingsGroup
        title="Desafío"
        footer={
          isActive
            ? 'Si elegís un nuevo programa, tu progreso de días actual regresará a cero y empezarás desde el día 1.'
            : undefined
        }
      >
        <SettingsRow
          icon={Target}
          iconBgClass="bg-rose-500/15"
          iconColorClass="text-[var(--accent-text)]"
          title={isActive ? 'Cambiar o reiniciar plan' : 'Sin desafío activo'}
          subtitle={
            isActive
              ? 'Gestioná tu programa en curso'
              : 'Explorá y seleccioná un nuevo desafío para comenzar'
          }
          detail={isActive ? 'Explorar' : 'Ver planes'}
          onClick={openPlansModal}
        />
      </SettingsGroup>

      <div className="space-y-2">
        <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Membresía Premium
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MEMBERSHIP_PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-4 transition-all duration-150 ${
                  isCurrent
                    ? 'border-[var(--accent-fill)] bg-rose-500/10 shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'
                }`}
              >
                {plan.badge && !isCurrent && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-950 shadow-sm">
                    {plan.badge}
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-[var(--accent-fill)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--on-accent)] shadow-sm">
                    Actual
                  </span>
                )}

                <div
                  className={`${plan.iconBg} mb-3 flex h-9 w-9 items-center justify-center rounded-xl`}
                >
                  <Icon className={`h-4 w-4 ${plan.iconColor}`} />
                </div>

                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  {plan.name}
                </h4>
                <p
                  className={`mt-0.5 mb-3 text-lg font-extrabold ${
                    isCurrent
                      ? 'text-[var(--accent-text)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  {plan.price}
                </p>

                <ul className="mb-4 flex-1 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-xs text-[var(--text-secondary)]"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-success)]"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="min-h-[40px] flex items-center justify-center rounded-xl border border-[var(--accent-fill)]/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-[var(--accent-text)]">
                    Plan actual
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    className="min-h-[40px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    Elegir {plan.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="px-1 pt-1 text-center text-xs text-[var(--text-muted)]">
          Los pagos son procesados de forma segura. Podés cancelar en cualquier
          momento.
        </p>
      </div>
    </div>
  );
}

interface ChallengeMembershipSummaryProps {
  onOpenPlansSheet: () => void;
}

export function ChallengeMembershipSummary({
  onOpenPlansSheet,
}: ChallengeMembershipSummaryProps) {
  const { isActive } = useChallengeStore();
  const { openPlansModal } = useUIStore();
  const { selectedPlan } = useSettingsStore();

  const currentPlanLabel =
    MEMBERSHIP_PLANS.find((p) => p.id === selectedPlan)?.name ?? 'Gratuito';

  return (
    <SettingsGroup title="Desafío y Membresía">
      <SettingsRow
        icon={Target}
        iconBgClass="bg-rose-500/15"
        iconColorClass="text-[var(--accent-text)]"
        title={isActive ? 'Desafío actual' : 'Sin desafío activo'}
        subtitle={
          isActive ? 'Cambiar o reiniciar programa' : 'Explorá los desafíos'
        }
        detail={isActive ? 'Explorar' : 'Ver planes'}
        onClick={openPlansModal}
      />
      <SettingsRow
        icon={Crown}
        iconBgClass="bg-amber-500/15"
        iconColorClass="text-amber-500"
        title="Plan Premium"
        subtitle="Gestioná tu suscripción y beneficios"
        detail={currentPlanLabel}
        onClick={onOpenPlansSheet}
      />
    </SettingsGroup>
  );
}

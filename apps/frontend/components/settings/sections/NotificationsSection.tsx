'use client';

import React from 'react';
import { Award, Bell, Calendar, Flame } from 'lucide-react';
import { NotificationKey, useSettingsStore } from '@/store/useSettingsStore';
import { IOSSwitch } from '../IOSSwitch';
import { SettingsGroup } from '../SettingsGroup';
import { SettingsRow } from '../SettingsRow';

const NOTIFICATION_ITEMS: {
  key: NotificationKey;
  label: string;
  desc: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    key: 'daily',
    label: 'Recordatorio diario',
    desc: 'Recibí un aviso cada día para completar tus tareas',
    icon: Bell,
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-[var(--status-info)]',
  },
  {
    key: 'streak',
    label: 'Racha en peligro',
    desc: 'Alerta cuando tu racha esté por romperse',
    icon: Flame,
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-[var(--accent-text)]',
  },
  {
    key: 'achievements',
    label: 'Nuevos logros',
    desc: 'Enterate primero cuando desbloqueás un logro',
    icon: Award,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-[var(--status-warning)]',
  },
  {
    key: 'weekly',
    label: 'Resumen semanal',
    desc: 'Un recap de tu progreso cada domingo',
    icon: Calendar,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-[var(--status-success)]',
  },
];

export function NotificationsSection() {
  const { notifications, setNotification } = useSettingsStore();

  return (
    <SettingsGroup
      title="Notificaciones"
      footer="Tus preferencias de alertas se guardan automáticamente en este dispositivo."
    >
      {NOTIFICATION_ITEMS.map((item) => (
        <SettingsRow
          key={item.key}
          icon={item.icon}
          iconBgClass={item.iconBg}
          iconColorClass={item.iconColor}
          title={item.label}
          subtitle={item.desc}
          showChevron={false}
          rightElement={
            <IOSSwitch
              checked={notifications[item.key]}
              onCheckedChange={(checked) => setNotification(item.key, checked)}
              ariaLabel={item.label}
            />
          }
        />
      ))}
    </SettingsGroup>
  );
}

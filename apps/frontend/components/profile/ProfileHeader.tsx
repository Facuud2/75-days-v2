'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { getInitial } from '@/lib/utils/display';

interface ProfileHeaderProps {
  name: string;
  avatarUrl?: string | null;
  level: number;
  memberSince: string | null;
  quote?: string | null;
  onEdit: () => void;
  onAvatar: () => void;
  loading?: boolean;
}

export default function ProfileHeader({
  name,
  avatarUrl,
  level,
  memberSince,
  quote,
  onEdit,
  onAvatar,
  loading = false,
}: ProfileHeaderProps) {
  // Guardamos la URL que falló, no un booleano: si llega una foto nueva, el
  // render vuelve a intentar la carga sin necesitar un efecto de reseteo.
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  if (loading) {
    return (
      <section className="pv2-card p-4 sm:p-5" aria-busy="true" aria-label="Cargando identidad">
        <div className="flex items-start justify-between gap-3">
          <div className="pv2-skeleton h-14 w-14 shrink-0 rounded-full" />
          <div className="pv2-skeleton h-9 w-9 rounded-full" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="pv2-skeleton h-5 w-40 max-w-full" />
          <div className="pv2-skeleton h-3.5 w-28" />
        </div>
      </section>
    );
  }

  const showImage = Boolean(avatarUrl) && avatarUrl !== failedAvatarUrl;

  return (
    <section className="pv2-card p-4 sm:p-5" aria-labelledby="profile-heading">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onAvatar}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border text-lg font-semibold uppercase"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--surface-inset)',
            color: 'var(--accent-text)',
          }}
          aria-label={`Cambiar foto de perfil de ${name || 'usuario'}`}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl || ''}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setFailedAvatarUrl(avatarUrl || null)}
            />
          ) : (
            getInitial(name)
          )}
        </button>

        <button type="button" onClick={onEdit} className="pv2-ghost shrink-0 px-3" aria-label="Editar perfil">
          <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="hidden sm:inline">Editar</span>
        </button>
      </div>

      <div className="mt-4 min-w-0">
        <h1
          id="profile-heading"
          className="text-xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]"
          style={{ color: 'var(--text-primary)' }}
        >
          {name || 'Tu perfil'}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="pv2-chip" style={{ color: 'var(--accent-text)' }}>
            Nivel {level}
          </span>
          {memberSince ? (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Miembro desde {memberSince}
            </span>
          ) : null}
        </div>

        {quote ? (
          <p
            className="mt-3 line-clamp-2 text-sm leading-relaxed [overflow-wrap:anywhere]"
            style={{ color: 'var(--text-secondary)' }}
            title={quote}
          >
            {quote}
          </p>
        ) : null}
      </div>
    </section>
  );
}

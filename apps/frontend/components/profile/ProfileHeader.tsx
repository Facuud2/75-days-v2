'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { getInitial } from '@/lib/utils/display';

interface ProfileHeaderProps {
  name: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  level: number;
  memberSince: string | null;
  quote?: string | null;
  onEdit: () => void;
  onAvatar: () => void;
  onBanner?: () => void;
  loading?: boolean;
}

export default function ProfileHeader({
  name,
  avatarUrl,
  bannerUrl,
  level,
  memberSince,
  quote,
  onEdit,
  onAvatar,
  onBanner,
  loading = false,
}: ProfileHeaderProps) {
  // Guardamos la URL que falló, no un booleano: si llega una foto nueva, el
  // render vuelve a intentar la carga sin necesitar un efecto de reseteo.
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [failedBannerUrl, setFailedBannerUrl] = useState<string | null>(null);

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
  const showBanner = Boolean(bannerUrl) && bannerUrl !== failedBannerUrl;

  const bannerImage = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={bannerUrl || ''}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailedBannerUrl(bannerUrl || null)}
    />
  );

  return (
    <section className="pv2-card overflow-hidden" aria-labelledby="profile-heading">
      {showBanner ? (
        onBanner ? (
          <button
            type="button"
            onClick={onBanner}
            className="relative block h-[116px] w-full overflow-hidden lg:h-[96px]"
            style={{ backgroundColor: 'var(--surface-inset)' }}
            aria-label={`Cambiar portada de ${name || 'usuario'}`}
          >
            {bannerImage}
          </button>
        ) : (
          <div
            className="relative h-[116px] w-full overflow-hidden lg:h-[96px]"
            style={{ backgroundColor: 'var(--surface-inset)' }}
          >
            {bannerImage}
          </div>
        )
      ) : null}

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onAvatar}
            className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-semibold uppercase ${
              showBanner ? '-mt-11 border-2 sm:-mt-12' : 'border'
            }`}
            style={{
              borderColor: showBanner ? 'var(--surface-card)' : 'var(--border-subtle)',
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
            <Pencil size={16} strokeWidth={2} aria-hidden="true" />
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
      </div>
    </section>
  );
}

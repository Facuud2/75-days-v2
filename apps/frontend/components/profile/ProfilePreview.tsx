'use client';

import { useEffect, useState } from 'react';
import { LayoutTemplate, UserRound } from 'lucide-react';
import { formatMemberSince, getNameHandle, getInitial } from '@/lib/utils/display';
import { resolveImagePreview } from '@/lib/utils/image';

export interface ProfilePreviewValues {
  name: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  profileQuote?: string | null;
  level: number;
  registeredAt?: string | null;
}

interface ProfilePreviewProps {
  values: ProfilePreviewValues;
  /** `mobile` imita la tarjeta de identidad; `desktop` la barra lateral de 300 px. */
  variant: 'mobile' | 'desktop';
  /** Alto del banner en píxeles; también decide el recorte de la imagen. */
  bannerHeight: number;
  /** Muestra un rayado donde todavía no hay portada. */
  placeholders?: boolean;
  className?: string;
}

// La imagen se recorta una sola vez por URL y tamaño: el banner se re-renderiza
// con cada tecla del formulario y no conviene decodificarla de nuevo.
const previewCache = new Map<string, string | null>();
const PREVIEW_CACHE_LIMIT = 40;

function useImagePreview(src: string | null | undefined, width: number, height: number) {
  const sourceKey = src ? `${width}x${height}|${src}` : null;
  // El estado guarda la clave ya procesada: si cambia la imagen se ignora el
  // resultado anterior sin necesidad de resetear con un efecto.
  const [resolved, setResolved] = useState<{ key: string; value: string | null } | null>(
    sourceKey && previewCache.has(sourceKey) ? { key: sourceKey, value: previewCache.get(sourceKey) ?? null } : null,
  );

  // Depender solo de `sourceKey` dejaría al efecto sin volver a correr cuando
  // la imagen se resuelve después del montaje (el avatar se quedaba sin foto).
  const isResolved = sourceKey ? previewCache.has(sourceKey) : true;

  useEffect(() => {
    if (!sourceKey || !src || previewCache.has(sourceKey)) return;

    let cancelled = false;
    resolveImagePreview(src, width, height).then((result) => {
      if (cancelled) return;
      if (previewCache.size >= PREVIEW_CACHE_LIMIT) {
        const oldestKey = previewCache.keys().next().value;
        if (oldestKey) previewCache.delete(oldestKey);
      }
      previewCache.set(sourceKey, result);
      setResolved({ key: sourceKey, value: result });
    });

    return () => {
      cancelled = true;
    };
  }, [sourceKey, src, width, height, isResolved]);

  if (!sourceKey) return null;
  if (previewCache.has(sourceKey)) return previewCache.get(sourceKey) ?? null;

  return resolved?.key === sourceKey ? resolved.value : null;
}

/**
 * Vista previa de la portada del perfil.
 *
 * Reproduce la identidad real de `/profile` sin campos editables: banner,
 * avatar, nombre, arroba, frase, nivel y antigüedad. No lee ni escribe datos:
 * recibe las URLs que el formulario tiene en ese momento, así sirve tanto para
 * una foto recién elegida como para la ya guardada.
 */
export default function ProfilePreview({
  values,
  variant,
  bannerHeight,
  placeholders = false,
  className = '',
}: ProfilePreviewProps) {
  const isDesktop = variant === 'desktop';
  const avatarSize = isDesktop ? 96 : 80;
  const bannerWidth = isDesktop ? 600 : 720;

  const bannerPreview = useImagePreview(values.bannerUrl, Math.round(bannerWidth * 2), bannerHeight * 2);
  const avatarPreview = useImagePreview(values.avatarUrl, avatarSize * 2, avatarSize * 2);

  const handle = getNameHandle(values.name);
  const memberSince = formatMemberSince(values.registeredAt);
  const quote = (values.profileQuote || '').trim();
  // El avatar se monta sobre el banner solo cuando hay imagen recortable; si
  // no, queda un círculo con la inicial sobre la superficie de la tarjeta.
  const hasAvatar = Boolean(values.avatarUrl) && avatarPreview !== null;

  return (
    <section
      className={`pv2-card overflow-hidden ${className}`}
      aria-label={`Vista previa de tu perfil en ${isDesktop ? 'la computadora' : 'el móvil'}`}
    >
      <p className="pv2-label flex items-center gap-2 px-3 pb-3 pt-3">
        {isDesktop ? (
          <LayoutTemplate size={14} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <UserRound size={14} strokeWidth={1.5} aria-hidden="true" />
        )}
        Vista previa · {isDesktop ? 'escritorio' : 'móvil'}
      </p>

      <div
        className="relative w-full overflow-hidden"
        style={{
          height: bannerHeight,
          backgroundColor: 'var(--surface-inset)',
          backgroundImage:
            placeholders && !values.bannerUrl
              ? `repeating-linear-gradient(135deg, transparent, transparent 6px, color-mix(in srgb, var(--text-muted) 14%, transparent) 6px, color-mix(in srgb, var(--text-muted) 14%, transparent) 12px)`
              : undefined,
        }}
      >
        {values.bannerUrl ? (
          <>
            {/*
              Sobre el fondo se muestra la imagen completa sin cortar (como el
              lienzo de edición), y encima el recorte exacto que se verá en el
              perfil. Así una foto 4:3 o vertical no "desaparece" al previsualizar.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerPreview || values.bannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-20 blur-[2px]"
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerPreview || values.bannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            {bannerPreview ? (
              <span
                className="absolute bottom-1.5 right-2 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: 'rgb(0 0 0 / 0.45)', color: '#fff' }}
                aria-hidden="true"
              >
                Recorte del perfil
              </span>
            ) : null}
          </>
        ) : (
          <p
            className="flex h-full items-center justify-center px-4 text-center text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Tu portada aparece acá
          </p>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end gap-3">
          <div
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-semibold uppercase ${
              hasAvatar ? 'border-2' : 'border'
            }`}
            style={{
              height: avatarSize,
              width: avatarSize,
              borderColor: hasAvatar ? 'var(--surface-card)' : 'var(--border-subtle)',
              backgroundColor: 'var(--surface-inset)',
              color: 'var(--accent-text)',
              marginBlockStart: hasAvatar ? -avatarSize / 2 - 2 : 0,
              position: 'relative',
              zIndex: 1,
            }}
            aria-hidden="true"
          >
            {hasAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview || ''} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitial(values.name)
            )}
          </div>

          {quote ? (
            <p
              className="min-w-0 flex-1 pt-2 line-clamp-2 text-xs sm:text-sm leading-snug [overflow-wrap:anywhere]"
              style={{ color: 'var(--text-secondary)' }}
              title={quote}
            >
              {quote}
            </p>
          ) : null}
        </div>

        <div className="mt-2 min-w-0">
          <p
            className={`truncate font-semibold leading-tight ${isDesktop ? 'text-lg' : 'text-xl'}`}
            style={{ color: 'var(--text-primary)' }}
          >
            {values.name.trim() || 'Tu nombre'}
          </p>
          {handle ? (
            <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
              @{handle}
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="pv2-chip" style={{ color: 'var(--accent-text)' }}>
            Nivel {values.level}
          </span>
          {memberSince ? (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Miembro desde {memberSince}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}


'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { motion, useDragControls, useReducedMotion } from 'motion/react';
import { Check, Crop, Eye, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { userService, UpdateProfilePayload } from '@/lib/api/users';
import toast from 'react-hot-toast';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import ProfilePreview from '@/components/profile/ProfilePreview';
import ProfilePreviewOverlay from '@/components/profile/ProfilePreviewOverlay';
import ImageCropperModal from '@/components/profile/ImageCropperModal';

export type ProfileEditMode = 'avatar' | 'banner' | 'name' | 'quote';

interface EditProfileSheetProps {
  mode: ProfileEditMode;
  onClose: () => void;
  onSaved: (updated: UpdateProfilePayload) => void;
  initialValues: {
    name: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    profileQuote?: string | null;
    /** Nivel y fecha de alta: solo alimentan la previsualización. */
    level?: number;
    registeredAt?: string | null;
  };
}

const STOCK_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=320&h=320&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=320&h=320&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&h=320&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=320&h=320&fit=crop&crop=faces',
];

const STOCK_BANNERS = [
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=500&fit=crop',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=500&fit=crop',
  'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&h=500&fit=crop',
  'https://images.unsplash.com/photo-1517964603305-11c0f6f66012?w=1200&h=500&fit=crop',
];

const copy: Record<ProfileEditMode, { title: string; description: string }> = {
  avatar: { title: 'Foto de perfil', description: 'Elegí una imagen de tu galería o una foto stock.' },
  banner: { title: 'Banner del perfil', description: 'Elegí una imagen para acompañar tu perfil.' },
  name: { title: 'Nombre de usuario', description: 'Este nombre se mostrará en tu perfil.' },
  quote: { title: 'Frase de perfil', description: 'Escribí una frase que represente tu constancia.' },
};

/** Alto del banner en el preview inline, según el layout real de cada dispositivo. */
const PREVIEW_BANNER_HEIGHT = { mobile: 116, desktop: 96 };

export default function EditProfileSheet({ mode, onClose, onSaved, initialValues }: EditProfileSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(mode === 'avatar' ? initialValues.avatarUrl || '' : mode === 'banner' ? initialValues.bannerUrl || '' : mode === 'name' ? initialValues.name : initialValues.profileQuote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [rawSourceUrl, setRawSourceUrl] = useState<string | null>(null);
  const [isDragOverFile, setIsDragOverFile] = useState(false);
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();
  const isImage = mode === 'avatar' || mode === 'banner';
  const stock = mode === 'avatar' ? STOCK_AVATARS : STOCK_BANNERS;
  const hasCurrentImage = Boolean(mode === 'avatar' ? initialValues.avatarUrl : initialValues.bannerUrl);

  // Liberar el object URL temporal si el usuario cargó una foto desde la galería.
  useEffect(() => {
    return () => {
      if (rawSourceUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(rawSourceUrl);
      }
    };
  }, [rawSourceUrl]);

  // La variante del preview sigue al ancho real de la ventana: al rotar el
  // teléfono o redimensionar el navegador se re-renderiza sin recargar.
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const previewVariant = isDesktop ? 'desktop' : 'mobile';

  // El preview refleja lo que el formulario tiene ahora: la imagen recién
  // elegida o, para los otros campos, los valores ya guardados. Así abrir la
  // edición del nombre también muestra cómo queda la portada.
  const previewValues = {
    name: mode === 'name' ? value : initialValues.name,
    avatarUrl: mode === 'avatar' ? value || null : initialValues.avatarUrl,
    bannerUrl: mode === 'banner' ? value || null : initialValues.bannerUrl,
    profileQuote: mode === 'quote' ? value : initialValues.profileQuote,
    level: initialValues.level ?? 1,
    registeredAt: initialValues.registeredAt,
  };

  // Escape cierra primero la previsualización a pantalla completa.
  useEffect(() => {
    if (!isPreviewOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsPreviewOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

  const processImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Seleccioná un archivo de imagen válido.');
      return;
    }
    setError('');
    const objectUrl = URL.createObjectURL(file);
    setRawSourceUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    setCropSrc(objectUrl);
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    processImageFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOverFile(false);
    processImageFile(event.dataTransfer.files?.[0]);
  };

  const handleOpenCropper = () => {
    const source = rawSourceUrl || value;
    if (!source) return;
    setError('');
    setCropSrc(source);
  };

  const handleSave = () => {
    if (!value.trim() && !isImage) {
      setError(mode === 'quote' ? 'Escribí una frase o dejá la frase actual.' : 'Elegí una opción antes de guardar.');
      return;
    }
    if (mode === 'name' && value.trim().length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return; }
    setError('');
    const previousPayload: UpdateProfilePayload = mode === 'avatar'
      ? { avatarUrl: initialValues.avatarUrl ?? null }
      : mode === 'banner'
        ? { bannerUrl: initialValues.bannerUrl ?? null }
        : mode === 'name'
          ? { name: initialValues.name }
          : { profileQuote: initialValues.profileQuote ?? null };
    const payload: UpdateProfilePayload = mode === 'avatar'
      ? { avatarUrl: value || null }
      : mode === 'banner'
        ? { bannerUrl: value || null }
        : mode === 'name'
          ? { name: value.trim() }
          : { profileQuote: value.trim() };

    // 0ms Optimistic UI: aplica el cambio y cierra el sheet al instante
    onSaved(payload);
    toast.success('El cambio se guardó correctamente.');
    onClose();
    void userService.updateProfile(payload).catch((err: any) => {
      onSaved(previousPayload);
      toast.error(err.message || 'No se pudieron guardar los cambios.');
    });
  };

  const handleRemoveImage = () => {
    setError('');
    const previousPayload: UpdateProfilePayload = mode === 'avatar'
      ? { avatarUrl: initialValues.avatarUrl ?? null }
      : { bannerUrl: initialValues.bannerUrl ?? null };
    const payload: UpdateProfilePayload = mode === 'avatar' ? { avatarUrl: null } : { bannerUrl: null };

    // 0ms Optimistic UI: quita la imagen y cierra el sheet al instante
    onSaved(payload);
    toast.success(`${mode === 'avatar' ? 'Foto de perfil' : 'Banner'} quitado correctamente.`);
    onClose();
    void userService.updateProfile(payload).catch((err: any) => {
      onSaved(previousPayload);
      toast.error(err.message || 'No se pudo quitar la imagen.');
    });
  };

  const enterTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end bg-black/60 backdrop-blur-[2px]"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-sheet-title"
        initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0, transition: enterTransition }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.42 }}
        dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
        onDragEnd={(_, info) => {
          if (shouldDismissSheet(info.offset.y, info.velocity.y)) onClose();
        }}
        className="max-h-[calc(100dvh-0.5rem)] w-full overflow-y-auto overscroll-contain rounded-t-[24px] border border-zinc-800 bg-zinc-950 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl sm:mx-auto sm:max-w-xl"
      >
        <div
          className="mx-auto mb-4 h-1.5 w-12 cursor-grab touch-none rounded-full bg-zinc-700 active:cursor-grabbing"
          aria-hidden="true"
          onPointerDown={(event) => dragControls.start(event)}
        />
        <header className="flex items-start justify-between">
          <div><h2 id="profile-sheet-title" className="text-xl font-bold tracking-tight text-zinc-100">{copy[mode].title}</h2><p className="mt-1 text-sm text-zinc-500">{copy[mode].description}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"><X className="h-5 w-5" /></button>
        </header>

        {isImage ? <div className="mt-5 space-y-5">
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p id="profile-preview-caption" className="pv2-label">
                Así se verá tu perfil en {isDesktop ? 'la computadora' : 'el móvil'}
              </p>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Previsualizar
              </button>
            </div>
            <div aria-describedby="profile-preview-caption">
              <ProfilePreview
                values={previewValues}
                variant={previewVariant}
                bannerHeight={PREVIEW_BANNER_HEIGHT[previewVariant]}
                placeholders
              />
            </div>
          </div>

          <div
            className={`flex flex-col gap-2.5 rounded-2xl border border-dashed p-2 transition-colors sm:flex-row ${isDragOverFile ? 'border-rose-400 bg-rose-500/10 shadow-[0_0_24px_rgba(244,63,94,0.22)]' : 'border-transparent p-0'}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragOverFile(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isDragOverFile) setIsDragOverFile(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDragOverFile(false);
              }
            }}
            onDrop={handleFileDrop}
          >
            <motion.button
              type="button"
              onClick={() => inputRef.current?.click()}
              animate={reduceMotion ? undefined : { scale: isDragOverFile ? 1.03 : 1 }}
              transition={{ type: 'spring', bounce: 0.25, duration: 0.28 }}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-400 px-4 py-3 text-sm font-bold text-zinc-950 hover:bg-rose-300"
            >
              <Upload className="h-4 w-4" /> {isDragOverFile ? 'Soltá la imagen acá' : 'Cargar o arrastrar imagen'}
            </motion.button>
            {(value || rawSourceUrl) && (
              <button
                type="button"
                onClick={handleOpenCropper}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
              >
                <Crop className="h-4 w-4 text-rose-300" />
                Ajustar recorte
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} className="sr-only" />
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Fotos stock</p>
            <div className="grid grid-cols-4 gap-3">
              {stock.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    setRawSourceUrl(null);
                    setValue(url);
                  }}
                  className={`relative aspect-square overflow-hidden rounded-xl border-2 ${value === url ? 'border-rose-400' : 'border-transparent'}`}
                  aria-pressed={value === url}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Foto stock" className="h-full w-full object-cover" />
                  {value === url && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-rose-400 p-1 text-zinc-950">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          {value && <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3"><ImagePlus className="h-4 w-4 text-rose-300" /><span className="text-xs text-zinc-400">Vista previa lista para guardar</span></div>}
          {hasCurrentImage && <button type="button" onClick={handleRemoveImage} disabled={saving} className="w-full rounded-xl border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-400 transition hover:border-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Quitando...' : `Quitar ${mode === 'avatar' ? 'foto de perfil' : 'banner'}`}</button>}
        </div> : <div className="mt-5">
          <label className="block text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">{mode === 'name' ? 'Nombre' : 'Tu frase'}</label>
          {mode === 'name' ? <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} maxLength={40} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-rose-400" /> : <textarea autoFocus value={value} onChange={(event) => setValue(event.target.value)} maxLength={120} rows={3} className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-rose-400" placeholder="Ej.: Un día a la vez." />}
          <p className="mt-2 text-right text-xs text-zinc-600">{value.length}/120</p>
        </div>}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <footer className="sticky bottom-0 mt-5 flex justify-end gap-3 border-t border-zinc-800 bg-zinc-950 pb-1 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-100">Cancelar</button><button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-rose-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-rose-300 disabled:opacity-60">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar'}</button></footer>
      </motion.section>

      <ProfilePreviewOverlay
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        values={previewValues}
        isDesktop={isDesktop}
      />

      {isImage && (
        <ImageCropperModal
          open={Boolean(cropSrc)}
          src={cropSrc}
          mode={mode === 'avatar' ? 'avatar' : 'banner'}
          onCancel={() => setCropSrc(null)}
          onApply={(croppedDataUrl) => {
            setValue(croppedDataUrl);
            setCropSrc(null);
            setError('');
          }}
        />
      )}
    </motion.div>
  );
}

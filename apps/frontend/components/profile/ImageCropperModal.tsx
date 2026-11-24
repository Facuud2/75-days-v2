'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  clamp,
  clampOffset,
  getCoverScale,
  MAX_ZOOM,
  MIN_ZOOM,
  renderCroppedImage,
} from '@/lib/utils/cropImage';

export type CropMode = 'avatar' | 'banner';

interface ImageCropperModalProps {
  open: boolean;
  src: string | null;
  mode: CropMode;
  onCancel: () => void;
  onApply: (croppedDataUrl: string) => void;
}

const CROP_CONFIG: Record<
  CropMode,
  {
    title: string;
    aspect: number;
    outputWidth: number;
    outputHeight: number;
    isCircle: boolean;
  }
> = {
  avatar: {
    title: 'Editar foto de perfil',
    aspect: 1,
    outputWidth: 512,
    outputHeight: 512,
    isCircle: true,
  },
  banner: {
    title: 'Editar portada',
    aspect: 3,
    outputWidth: 1200,
    outputHeight: 400,
    isCircle: false,
  },
};

interface PointerPoint {
  x: number;
  y: number;
}

function getDistance(a: PointerPoint, b: PointerPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function ImageCropperModal(props: ImageCropperModalProps) {
  if (!props.open || !props.src || typeof document === 'undefined') return null;
  return (
    <ImageCropperModalContent
      key={`${props.src}::${props.mode}`}
      src={props.src}
      mode={props.mode}
      onCancel={props.onCancel}
      onApply={props.onApply}
    />
  );
}

function ImageCropperModalContent({
  src,
  mode,
  onCancel,
  onApply,
}: Omit<ImageCropperModalProps, 'open' | 'src'> & { src: string }) {
  const config = CROP_CONFIG[mode];
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef<Map<number, PointerPoint>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(MIN_ZOOM);

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [applying, setApplying] = useState(false);

  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);

  // Calcular dimensiones exactas del marco de recorte según el espacio disponible
  const cropBox = (() => {
    const { width: sw, height: sh } = stageSize;
    if (sw <= 0 || sh <= 0) return { width: 0, height: 0 };

    if (mode === 'avatar') {
      const size = Math.max(120, Math.min(sw - 32, sh - 32, 340));
      return { width: size, height: size };
    }

    const maxW = Math.min(sw - 24, 640);
    const maxH = Math.max(80, sh - 32);
    let w = maxW;
    let h = w / config.aspect;
    if (h > maxH) {
      h = maxH;
      w = h * config.aspect;
    }
    return { width: Math.round(w), height: Math.round(h) };
  })();

  // Cargar imagen cuando se monta el modal para este `src`
  useEffect(() => {
    imageRef.current = null;
    pointersRef.current.clear();
    pinchStartDistRef.current = null;

    let cancelled = false;
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (cancelled) return;
      imageRef.current = img;
      setNaturalSize({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    };
    img.onerror = () => {
      if (cancelled) return;
      setLoadError('No se pudo cargar la imagen para recortar.');
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Medir el área disponible con ResizeObserver
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Bloquear scroll del body y cerrar con Escape
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onCancel]);

  const applyZoom = useCallback(
    (nextZoom: number) => {
      const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      setZoom(clampedZoom);

      if (naturalSize && cropBox.width > 0 && cropBox.height > 0) {
        setOffset((prev) => {
          const clamped = clampOffset(prev.x, prev.y, {
            imageWidth: naturalSize.width,
            imageHeight: naturalSize.height,
            cropWidth: cropBox.width,
            cropHeight: cropBox.height,
            zoom: clampedZoom,
          });
          return { x: clamped.offsetX, y: clamped.offsetY };
        });
      }
    },
    [naturalSize, cropBox.width, cropBox.height],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setIsInteracting(true);

    if (pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      pinchStartDistRef.current = getDistance(p1, p2);
      pinchStartZoomRef.current = zoom;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || !pointersRef.current.has(event.pointerId)) return;
    const prevPoint = pointersRef.current.get(event.pointerId)!;
    const nextPoint = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, nextPoint);

    if (pointersRef.current.size === 2 && pinchStartDistRef.current) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = getDistance(p1, p2);
      const scaleFactor = dist / pinchStartDistRef.current;
      applyZoom(pinchStartZoomRef.current * scaleFactor);
      return;
    }

    if (pointersRef.current.size === 1) {
      const dx = nextPoint.x - prevPoint.x;
      const dy = nextPoint.y - prevPoint.y;
      setOffset((prev) => {
        const clamped = clampOffset(prev.x + dx, prev.y + dy, {
          imageWidth: naturalSize.width,
          imageHeight: naturalSize.height,
          cropWidth: cropBox.width,
          cropHeight: cropBox.height,
          zoom,
        });
        return { x: clamped.offsetX, y: clamped.offsetY };
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStartDistRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      setIsInteracting(false);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!naturalSize) return;
    event.preventDefault();
    const delta = -event.deltaY * 0.0025;
    applyZoom(zoom + delta);
  };

  const handleReset = () => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  };

  const handleConfirm = async () => {
    if (!imageRef.current || !naturalSize || cropBox.width <= 0 || cropBox.height <= 0) return;
    setApplying(true);
    setLoadError('');
    try {
      const dataUrl = await renderCroppedImage(
        imageRef.current,
        {
          imageWidth: naturalSize.width,
          imageHeight: naturalSize.height,
          cropWidth: cropBox.width,
          cropHeight: cropBox.height,
          zoom,
          offsetX: offset.x,
          offsetY: offset.y,
        },
        config.outputWidth,
        config.outputHeight,
      );
      onApply(dataUrl);
    } catch {
      setLoadError(
        'No se pudo recortar esta imagen. Si es una imagen externa, probá subir una desde tu galería.',
      );
    } finally {
      setApplying(false);
    }
  };

  const baseScale = naturalSize
    ? getCoverScale(naturalSize.width, naturalSize.height, cropBox.width, cropBox.height)
    : 1;
  const renderedWidth = naturalSize ? naturalSize.width * baseScale * zoom : 0;
  const renderedHeight = naturalSize ? naturalSize.height * baseScale * zoom : 0;
  const hasChanges = zoom > MIN_ZOOM + 0.01 || Math.abs(offset.x) > 1 || Math.abs(offset.y) > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex flex-col bg-black text-zinc-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-cropper-title"
    >
      {/* Header estilo X */}
      <header
        className="flex items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar recorte"
            className="rounded-full p-2 text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 id="image-cropper-title" className="truncate text-base font-bold text-zinc-100">
            {config.title}
          </h2>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!naturalSize || applying || Boolean(loadError)}
          className="flex items-center gap-1.5 rounded-full bg-rose-400 px-4 py-1.5 text-sm font-bold text-zinc-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {applying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Aplicando...
            </>
          ) : (
            'Aplicar'
          )}
        </button>
      </header>

      {/* Lienzo interactivo */}
      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="relative flex flex-1 cursor-grab items-center justify-center overflow-hidden bg-black touch-none select-none active:cursor-grabbing"
      >
        {loadError ? (
          <div className="mx-6 max-w-sm rounded-2xl border border-red-500/30 bg-zinc-900 p-5 text-center">
            <p className="text-sm text-red-400">{loadError}</p>
            <button
              type="button"
              onClick={onCancel}
              className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
            >
              Volver
            </button>
          </div>
        ) : !naturalSize ? (
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
            <span className="text-xs">Cargando imagen...</span>
          </div>
        ) : (
          <div
            className="relative"
            style={{
              width: cropBox.width,
              height: cropBox.height,
            }}
          >
            {/* Imagen posicionada exactamente según zoom y offset */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Imagen para recortar"
              draggable={false}
              className="pointer-events-none absolute max-w-none max-h-none select-none"
              style={{
                width: renderedWidth,
                height: renderedHeight,
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />

            {/* Máscara oscura exterior + borde del recorte */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 border-2 border-rose-400/90 ${
                config.isCircle ? 'rounded-full' : 'rounded-sm'
              }`}
              style={{
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
              }}
            />

            {/* Grilla de tercios al arrastrar o hacer zoom */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-150 ${
                config.isCircle ? 'rounded-full' : 'rounded-sm'
              } ${isInteracting ? 'opacity-65' : 'opacity-20'}`}
            >
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/60" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/60" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/60" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/60" />
            </div>
          </div>
        )}
      </div>

      {/* Controles inferiores de zoom y reinicio */}
      <footer
        className="border-t border-zinc-800/80 bg-zinc-950/95 px-5 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => applyZoom(zoom - 0.2)}
              disabled={!naturalSize || zoom <= MIN_ZOOM}
              aria-label="Alejar"
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(event) => applyZoom(parseFloat(event.target.value))}
              disabled={!naturalSize}
              aria-label="Nivel de zoom"
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-rose-400"
            />

            <button
              type="button"
              onClick={() => applyZoom(zoom + 0.2)}
              disabled={!naturalSize || zoom >= MAX_ZOOM}
              aria-label="Acercar"
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                aria-label="Restablecer recorte"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restablecer
              </button>
            )}
          </div>

          <p className="text-center text-xs text-zinc-500">
            Arrastrá para encuadrar · Pellizcá o usá el deslizador para hacer zoom
          </p>
        </div>
      </footer>
    </div>,
    document.body,
  );
}

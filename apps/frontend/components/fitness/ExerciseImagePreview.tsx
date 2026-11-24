'use client';

import { useEffect, useState } from 'react';
import { Dumbbell, Pause, Play } from 'lucide-react';
import { resolveExerciseImageUrl } from '@/lib/api/exerciseCatalog';

interface ExerciseImagePreviewProps {
  images?: string[];
  imageBaseUrl?: string;
  alt: string;
  animate?: boolean;
  showControls?: boolean;
  className?: string;
}

/**
 * Displays the public-domain exercise imagery from free-exercise-db / Cloudflare R2.
 * When `animate` is enabled and two movement frames exist (0.jpg & 1.jpg), alternates
 * gently between start and peak contraction positions (respecting prefers-reduced-motion).
 */
export default function ExerciseImagePreview({
  images = [],
  imageBaseUrl,
  alt,
  animate = false,
  showControls = false,
  className = 'h-16 w-16 rounded-xl',
}: ExerciseImagePreviewProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(animate);
  const [hasError, setHasError] = useState(false);

  const resolvedUrls = images
    .map((img) => resolveExerciseImageUrl(img, imageBaseUrl))
    .filter((url): url is string => Boolean(url));

  const hasMultipleFrames = resolvedUrls.length > 1;

  useEffect(() => {
    setHasError(false);
    setFrameIndex(0);
    setIsPlaying(animate);
  }, [images, animate]);

  useEffect(() => {
    if (!isPlaying || !hasMultipleFrames) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % resolvedUrls.length);
    }, 1150);

    return () => window.clearInterval(timer);
  }, [isPlaying, hasMultipleFrames, resolvedUrls.length]);

  const currentUrl = resolvedUrls[frameIndex] || resolvedUrls[0];

  if (!currentUrl || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-900/90 border border-zinc-800 text-zinc-500 shrink-0 ${className}`}
        aria-hidden="true"
      >
        <Dumbbell className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-zinc-900 border border-zinc-800/80 shrink-0 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className="h-full w-full object-cover transition-opacity duration-200"
      />

      {showControls && hasMultipleFrames && (
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
          <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm tabular-nums">
            {frameIndex + 1}/{resolvedUrls.length}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPlaying((prev) => !prev);
            }}
            aria-label={isPlaying ? 'Pausar demostración' : 'Reproducir demostración'}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm transition-transform active:scale-95 hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

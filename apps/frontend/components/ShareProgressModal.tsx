'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Moon,
  Share2,
  Smartphone,
  Square,
  Sun,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useChallengeStore, type Goal } from '@/store/useChallengeStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  buildChallengeSharePayload,
  buildDailySharePayload,
  type ShareCardFormat,
  type ShareCardKind,
  type ShareCardTheme,
} from '@/lib/utils/shareCardData';
import {
  canCopyImageToClipboard,
  canvasToPngBlob,
  copyPngBlobToClipboard,
  downloadPngBlob,
  renderChallengeShareCard,
  renderDailyShareCard,
  sharePngBlob,
} from '@/lib/utils/shareCardRenderer';

export interface DailyShareSource {
  date: string;
  dayNumber: number;
  goals: Goal[];
}

interface ShareProgressModalProps {
  open: boolean;
  onClose: () => void;
  initialKind?: ShareCardKind;
  dailySource?: DailyShareSource;
}

export default function ShareProgressModal({
  open,
  onClose,
  initialKind = 'daily',
  dailySource,
}: ShareProgressModalProps) {
  const difficulty = useChallengeStore((s) => s.difficulty);
  const currentDay = useChallengeStore((s) => s.currentDay);
  const streak = useChallengeStore((s) => s.streak);
  const startDate = useChallengeStore((s) => s.startDate);
  const logs = useChallengeStore((s) => s.logs);
  const points = useChallengeStore((s) => s.points);
  const periodGoals = useChallengeStore((s) => s.periodGoals);
  const userName = useAuthStore((s) => s.user?.name);

  const hasDaily = Boolean(dailySource);
  const [kind, setKind] = useState<ShareCardKind>(
    initialKind === 'daily' && !hasDaily ? 'challenge' : initialKind
  );
  const [format, setFormat] = useState<ShareCardFormat>('story');
  const [theme, setTheme] = useState<ShareCardTheme>('dark');
  const [showGoalTitles, setShowGoalTitles] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const dailyPayload = useMemo(() => {
    if (!dailySource) return null;
    return buildDailySharePayload({
      date: dailySource.date,
      dayNumber: dailySource.dayNumber,
      difficulty,
      goals: dailySource.goals,
      streak,
      userName,
    });
  }, [dailySource, difficulty, streak, userName]);

  const challengePayload = useMemo(() => {
    return buildChallengeSharePayload({
      currentDay,
      difficulty,
      streak,
      startDate,
      logs,
      points,
      periodGoals,
      userName,
    });
  }, [currentDay, difficulty, streak, startDate, logs, points, periodGoals, userName]);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    if (kind === 'daily' && dailyPayload) {
      renderDailyShareCard(canvasRef.current, dailyPayload, {
        format,
        theme,
        showGoalTitles,
      });
    } else {
      renderChallengeShareCard(canvasRef.current, challengePayload, {
        format,
        theme,
      });
    }
  }, [open, kind, format, theme, showGoalTitles, dailyPayload, challengePayload]);

  const getFilename = useCallback(() => {
    if (kind === 'daily' && dailyPayload) {
      return `75-days-dia-${dailyPayload.dayNumber}-${format}.png`;
    }
    return `75-days-progreso-${challengePayload.currentDay}-de-75-${format}.png`;
  }, [kind, format, dailyPayload, challengePayload.currentDay]);

  const getShareText = useCallback(() => {
    if (kind === 'daily' && dailyPayload) {
      return `Día ${dailyPayload.dayNumber}/75 · ${dailyPayload.progressPercent}% completado (${dailyPayload.completedCount}/${dailyPayload.totalCount} tareas)`;
    }
    return `Día ${challengePayload.currentDay}/75 (${challengePayload.progressPercent}%) en 75 Days Challenge`;
  }, [kind, dailyPayload, challengePayload]);

  const handleShare = async () => {
    if (!canvasRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      const result = await sharePngBlob(
        blob,
        getFilename(),
        '75 Days Challenge',
        getShareText()
      );
      if (result === 'downloaded') {
        toast.success('Imagen guardada (tu navegador no soporta el menú nativo aquí)');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error('No se pudo compartir la imagen');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    if (!canvasRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      downloadPngBlob(blob, getFilename());
      toast.success('Imagen descargada');
    } catch {
      toast.error('No se pudo descargar la imagen');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!canvasRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      await copyPngBlobToClipboard(blob);
      setCopied(true);
      toast.success('Imagen copiada al portapapeles');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar la imagen');
    } finally {
      setIsExporting(false);
    }
  };

  if (!open) return null;

  const clipboardSupported = canCopyImageToClipboard();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#120b0e] text-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-rose-400 uppercase">
              Compartir progreso
            </p>
            <h2 id="share-modal-title" className="text-base font-bold text-white">
              Generar tarjeta de estado
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de compartir"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="shrink-0 space-y-2.5 border-b border-white/10 px-5 py-3">
          {hasDaily && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setKind('daily')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  kind === 'daily'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Estado del día
              </button>
              <button
                type="button"
                onClick={() => setKind('challenge')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  kind === 'challenge'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Reto completo
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Format selector: Story (9:16) vs Post (4:5) */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setFormat('story')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  format === 'story'
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                Story 9:16
              </button>
              <button
                type="button"
                onClick={() => setFormat('post')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  format === 'post'
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                Post 4:5
              </button>
            </div>

            <div className="flex items-center gap-2">
              {kind === 'daily' && (
                <button
                  type="button"
                  onClick={() => setShowGoalTitles((prev) => !prev)}
                  title={showGoalTitles ? 'Ocultar nombres de tareas' : 'Mostrar nombres de tareas'}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    showGoalTitles
                      ? 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                      : 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                  }`}
                >
                  {showGoalTitles ? (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Tareas</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Privado</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
              >
                {theme === 'dark' ? (
                  <>
                    <Moon className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
                    <span>Oscuro</span>
                  </>
                ) : (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    <span>Claro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Preview */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <canvas
            ref={canvasRef}
            className="max-h-[38dvh] w-auto max-w-full rounded-2xl border border-white/15 shadow-2xl sm:max-h-[46vh]"
            aria-label="Vista previa de la imagen para compartir"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 bg-[#120b0e] px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Guardar</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            disabled={isExporting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-600 active:scale-[0.98] disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            <span>Compartir</span>
          </button>

          {clipboardSupported && (
            <button
              type="button"
              onClick={handleCopy}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm font-semibold text-white/90 transition-all hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
              aria-label="Copiar imagen al portapapeles"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <span>Copiada</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';
/* eslint-disable @next/next/no-img-element -- local compressed data URI preview is not a remote LCP image. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useDragControls, useReducedMotion } from 'motion/react';
import { CalendarDays, Camera, Check, ChevronLeft, ChevronRight, FileText, Scale, Share2, Upload, Utensils, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ChallengeDay } from '@/lib/calendar/challengeDays';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useHealthStore } from '@/store/useHealthStore';
import { mealTypeLabel } from '@/lib/utils/display';
import toast from 'react-hot-toast';
import {
  REDUCED_MOTION_TRANSITION,
  SHEET_ENTER_SPRING,
  SHEET_EXIT_TRANSITION,
  shouldDismissSheet,
} from '@/lib/motion/sheetPhysics';

const ShareProgressModal = dynamic(() => import('@/components/ShareProgressModal'), { ssr: false });

const statusText = { success: 'Completado', fail: 'No cumplido', rest: 'Descanso', pending: 'Pendiente', future: 'Futuro', inactive: 'Fuera del reto' } as const;

export default function DayDetailsSheet({ day, onClose, onPrevious, onNext }: { day: ChallengeDay; onClose: () => void; onPrevious?: () => void; onNext?: () => void }) {
  const { logDailyGoal, logDailyMetrics } = useChallengeStore();
  const dayNutrition = useHealthStore((s) => s.dailyStatsByDate[day.date]);
  const fetchProfileBundle = useHealthStore((s) => s.fetchProfileBundle);
  const log = day.log;
  const [weight, setWeight] = useState(log?.weight?.toString() ?? '');
  const [photoUrl, setPhotoUrl] = useState(log?.photoUrl ?? '');
  const [notes, setNotes] = useState(log?.notes ?? '');
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onPreviousRef = useRef(onPrevious);
  const onNextRef = useRef(onNext);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isDragOverPhoto, setIsDragOverPhoto] = useState(false);
  const [justDroppedPhoto, setJustDroppedPhoto] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const shareOpenRef = useRef(shareOpen);
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();
  const reduceMotionRef = useRef(reduceMotion);

  useEffect(() => {
    onCloseRef.current = onClose;
    onPreviousRef.current = onPrevious;
    onNextRef.current = onNext;
    shareOpenRef.current = shareOpen;
    reduceMotionRef.current = reduceMotion;
  });

  useEffect(() => {
    if (day.status !== 'future') {
      void fetchProfileBundle(day.date, { skipCoreProfile: true });
    }
  }, [day.date, day.status, fetchProfileBundle]);

  const dismiss = useCallback(() => {
    // Keep this guard and callbacks in refs so parent re-renders (e.g. store
    // updates from saving metrics) never change `dismiss` identity or cancel
    // the close timer before `onClose` unmounts the sheet.
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onCloseRef.current();
    }, reduceMotionRef.current ? 110 : 200);
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !shareOpenRef.current) dismiss();
      if (event.key === 'ArrowLeft') onPreviousRef.current?.();
      if (event.key === 'ArrowRight') onNextRef.current?.();
      if (event.key === 'Tab') {
        const dialog = document.querySelector<HTMLElement>('.calendar-sheet');
        const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')) : [];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dismiss]);

  const processImageFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    // Fase 3 (Patrón imageProcessing.ts de appManifestV2): ObjectURL + revocación inmediata + WebP compacto
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(image.width || 1, image.height || 1));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const webpUrl = canvas.toDataURL('image/webp', 0.76);
        const finalUrl = webpUrl.startsWith('data:image/webp')
          ? webpUrl
          : canvas.toDataURL('image/jpeg', 0.72);
        setPhotoUrl(finalUrl);
        setJustDroppedPhoto(true);
        window.setTimeout(() => setJustDroppedPhoto(false), 500);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    processImageFile(event.target.files?.[0]);
  };

  const handlePhotoDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOverPhoto(false);
    processImageFile(event.dataTransfer.files?.[0]);
  };

  const save = () => {
    const metrics: { weight?: number; photoUrl?: string; notes?: string } = {};
    if (weight) metrics.weight = Number(weight);
    if (photoUrl) metrics.photoUrl = photoUrl;
    if (notes) metrics.notes = notes;
    if (Object.keys(metrics).length) {
      void logDailyMetrics(day.date, metrics).catch(() => {
        toast.error('No se pudo sincronizar el registro.');
      });
    }
    toast.success(day.status === 'success' ? 'Registro guardado. Hoy cumpliste con vos.' : 'Registro guardado');
    dismiss();
  };

  const enterTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING;
  const exitTransition = reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_EXIT_TRANSITION;

  return (
    <motion.div
      className="calendar-sheet-backdrop"
      role="presentation"
      style={isClosing ? { pointerEvents: 'none' } : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
      onPointerDown={(event) => event.target === event.currentTarget && dismiss()}
    >
      <motion.section
        className="calendar-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-sheet-title"
        initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
        animate={
          isClosing
            ? reduceMotion
              ? { opacity: 0, transition: exitTransition }
              : { y: '100%', transition: exitTransition }
            : reduceMotion
              ? { opacity: 1, transition: enterTransition }
              : { y: 0, transition: enterTransition }
        }
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.42 }}
        dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
        onDragEnd={(_, info) => {
          if (shouldDismissSheet(info.offset.y, info.velocity.y)) dismiss();
        }}
      >
        <div
          className="calendar-sheet__handle"
          aria-hidden="true"
          onPointerDown={(event) => dragControls.start(event)}
        />
        <header className="calendar-sheet__header">
          <div>
            <p className="calendar-context-label"><CalendarDays size={14} aria-hidden="true" /> Día {day.dayNumber} de 75</p>
            <h2 id="calendar-sheet-title">{format(day.dateValue, "EEEE, d 'de' MMMM", { locale: es })}</h2>
          </div>
          <div className="flex items-center gap-2">
            {day.status !== 'future' && day.status !== 'inactive' && (
              <button
                type="button"
                className="calendar-icon-button"
                onClick={() => setShareOpen(true)}
                aria-label="Compartir estado de este día"
                title="Compartir día"
              >
                <Share2 size={18} />
              </button>
            )}
            <button ref={closeRef} type="button" className="calendar-icon-button" onClick={dismiss} aria-label="Cerrar detalle del día"><X size={20} /></button>
          </div>
        </header>

        <div className="calendar-sheet__body">
          <div className={`calendar-status calendar-status--${day.status}`}><span className="calendar-status__mark" aria-hidden="true" />{statusText[day.status]}{day.totalGoals ? ` · ${day.completedGoals}/${day.totalGoals} metas` : ''}</div>

          {log?.goals?.length ? (
            <section className="calendar-sheet__section" aria-labelledby="goals-title">
              <div className="calendar-section-heading"><h3 id="goals-title">Metas del día</h3><span>{day.completedGoals}/{day.totalGoals}</span></div>
              <div className="calendar-goals-list">
                {log.goals.map((goal) => (
                  <button type="button" key={goal.id} disabled={day.status === 'future'} onClick={() => void logDailyGoal(day.date, goal.id, !goal.completed)} className={`calendar-goal ${goal.completed ? 'calendar-goal--done' : ''}`} aria-pressed={goal.completed}>
                    <span className="calendar-goal__check">{goal.completed && <Check size={14} aria-hidden="true" />}</span>
                    <span>{goal.title}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : <p className="calendar-empty-note">Todavía no hay metas registradas para este día.</p>}

          {day.status !== 'future' ? (
            <section className="calendar-sheet__section" aria-labelledby="meals-day-title">
              <div className="calendar-section-heading">
                <h3 id="meals-day-title">
                  Comidas del día
                  {dayNutrition && dayNutrition.consumed > 0
                    ? ` · ${Math.round(dayNutrition.consumed)} kcal`
                    : ''}
                </h3>
                <Link
                  href={`/nutrition?date=${day.date}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)]"
                >
                  <Utensils size={13} aria-hidden="true" />
                  Abrir Nutrición
                </Link>
              </div>

              {dayNutrition && dayNutrition.meals.length > 0 ? (
                <div className="divide-y divide-[var(--divider)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]">
                  {dayNutrition.meals.map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--text-primary)]">
                          {meal.name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] tabular-nums">
                          {mealTypeLabel(meal.mealType)} · P {Math.round(meal.proteinG)}g · C{' '}
                          {Math.round(meal.carbG)}g · G {Math.round(meal.fatG)}g
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-[var(--text-primary)] tabular-nums">
                        {Math.round(meal.calories)} kcal
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="calendar-empty-note">
                  Sin comidas registradas en esta fecha.
                </p>
              )}
            </section>
          ) : null}

          <section className="calendar-sheet__section" aria-labelledby="notes-title">
            <div className="calendar-section-heading"><h3 id="notes-title">Registro personal</h3><FileText size={16} aria-hidden="true" /></div>
            <label className="calendar-field"><span><Scale size={15} aria-hidden="true" /> Peso (kg)</span><input inputMode="decimal" type="number" min="0" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="—" /></label>
            <label className="calendar-field"><span><FileText size={15} aria-hidden="true" /> Nota</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="¿Cómo te sentiste hoy?" /></label>
            <div
              className="calendar-field"
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragOverPhoto(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isDragOverPhoto) setIsDragOverPhoto(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setIsDragOverPhoto(false);
                }
              }}
              onDrop={handlePhotoDrop}
            >
              <span><Camera size={15} aria-hidden="true" /> Foto de progreso</span>
              {photoUrl ? (
                <motion.button
                  type="button"
                  className={`calendar-photo-preview transition-shadow ${isDragOverPhoto ? 'ring-2 ring-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.3)]' : ''}`}
                  animate={
                    reduceMotion
                      ? undefined
                      : { scale: isDragOverPhoto ? 1.03 : justDroppedPhoto ? [1.08, 0.96, 1] : 1 }
                  }
                  transition={{ type: 'spring', bounce: 0.28, duration: 0.36 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <img src={photoUrl} alt="Vista previa del progreso" />
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  className={`calendar-upload transition-colors ${isDragOverPhoto ? '!border-rose-400 !bg-rose-500/10 !text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.22)]' : ''}`}
                  animate={reduceMotion ? undefined : { scale: isDragOverPhoto ? 1.03 : 1 }}
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.28 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} aria-hidden="true" /> {isDragOverPhoto ? 'Soltá la foto acá' : 'Subir o arrastrar foto'}
                </motion.button>
              )}
              <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" onChange={handleImageUpload} />
            </div>
          </section>
        </div>

        <footer className="calendar-sheet__footer"><button type="button" onClick={onPrevious} disabled={!onPrevious} className="calendar-nav-button" aria-label="Día anterior"><ChevronLeft size={18} /></button><button type="button" onClick={() => void save()} disabled={isSaving} className="calendar-save-button">{isSaving ? 'Guardando…' : 'Guardar registro'}</button><button type="button" onClick={onNext} disabled={!onNext} className="calendar-nav-button" aria-label="Día siguiente"><ChevronRight size={18} /></button></footer>
      </motion.section>
      {shareOpen && (
        <ShareProgressModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          initialKind="daily"
          dailySource={{
            date: day.date,
            dayNumber: Math.max(1, day.dayNumber),
            goals: log?.goals || [],
          }}
        />
      )}
    </motion.div>
  );
}

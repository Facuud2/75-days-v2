'use client';
/* eslint-disable @next/next/no-img-element -- local compressed data URI preview is not a remote LCP image. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Camera, Check, ChevronLeft, ChevronRight, FileText, Scale, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ChallengeDay } from '@/lib/calendar/challengeDays';
import { useChallengeStore } from '@/store/useChallengeStore';
import toast from 'react-hot-toast';

const statusText = { success: 'Completado', fail: 'No cumplido', rest: 'Descanso', pending: 'Pendiente', future: 'Futuro', inactive: 'Fuera del reto' } as const;

export default function DayDetailsSheet({ day, onClose, onPrevious, onNext }: { day: ChallengeDay; onClose: () => void; onPrevious?: () => void; onNext?: () => void }) {
  const { logDailyGoal, logDailyMetrics } = useChallengeStore();
  const log = day.log;
  const [weight, setWeight] = useState(log?.weight?.toString() ?? '');
  const [photoUrl, setPhotoUrl] = useState(log?.photoUrl ?? '');
  const [notes, setNotes] = useState(log?.notes ?? '');
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startY = useRef<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isClosingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const dismiss = useCallback(() => {
    // Keep this guard in a ref. Using `isClosing` here made the effect below
    // change identity after setIsClosing(), which cleaned up the timer before
    // onClose could unmount the backdrop.
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    closeTimer.current = setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
      if (event.key === 'ArrowLeft') onPrevious?.();
      if (event.key === 'ArrowRight') onNext?.();
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
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [dismiss, onNext, onPrevious]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startY.current = event.clientY;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startY.current === null || isClosing) return;
    setOffsetY(Math.max(0, event.clientY - startY.current));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const distance = event.clientY - startY.current;
    startY.current = null;
    setIsDragging(false);
    if (distance > 96) { setOffsetY(0); dismiss(); }
    else setOffsetY(0);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const width = Math.min(image.width, 800);
        canvas.width = width;
        canvas.height = Math.round(image.height * (width / image.width));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.7));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setIsSaving(true);
    const metrics: { weight?: number; photoUrl?: string; notes?: string } = {};
    if (weight) metrics.weight = Number(weight);
    if (photoUrl) metrics.photoUrl = photoUrl;
    if (notes) metrics.notes = notes;
    if (Object.keys(metrics).length) await logDailyMetrics(day.date, metrics);
    toast.success(day.status === 'success' ? 'Registro guardado. Hoy cumpliste con vos.' : 'Registro guardado');
    setIsSaving(false);
    dismiss();
  };

  return (
    <div className={`calendar-sheet-backdrop ${isClosing ? 'calendar-sheet-backdrop--closing' : ''}`} role="presentation" onPointerDown={(event) => event.target === event.currentTarget && dismiss()}>
      <section className={`calendar-sheet ${isClosing ? 'calendar-sheet--closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="calendar-sheet-title" style={offsetY ? { transform: `translateY(${offsetY}px)`, transition: isDragging ? 'none' : undefined } : undefined}>
        <div className="calendar-sheet__handle" aria-hidden="true" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={() => { startY.current = null; setIsDragging(false); setOffsetY(0); }} />
        <header className="calendar-sheet__header">
          <div>
            <p className="calendar-context-label"><CalendarDays size={14} aria-hidden="true" /> Día {day.dayNumber} de 75</p>
            <h2 id="calendar-sheet-title">{format(day.dateValue, "EEEE, d 'de' MMMM", { locale: es })}</h2>
          </div>
          <button ref={closeRef} type="button" className="calendar-icon-button" onClick={dismiss} aria-label="Cerrar detalle del día"><X size={20} /></button>
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

          <section className="calendar-sheet__section" aria-labelledby="notes-title">
            <div className="calendar-section-heading"><h3 id="notes-title">Registro personal</h3><FileText size={16} aria-hidden="true" /></div>
            <label className="calendar-field"><span><Scale size={15} aria-hidden="true" /> Peso (kg)</span><input inputMode="decimal" type="number" min="0" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="—" /></label>
            <label className="calendar-field"><span><FileText size={15} aria-hidden="true" /> Nota</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="¿Cómo te sentiste hoy?" /></label>
            <div className="calendar-field"><span><Camera size={15} aria-hidden="true" /> Foto de progreso</span>{photoUrl ? <button type="button" className="calendar-photo-preview" onClick={() => fileInputRef.current?.click()}><img src={photoUrl} alt="Vista previa del progreso" /></button> : <button type="button" className="calendar-upload" onClick={() => fileInputRef.current?.click()}><Upload size={18} aria-hidden="true" /> Subir foto</button>}<input ref={fileInputRef} className="sr-only" type="file" accept="image/*" onChange={handleImageUpload} /></div>
          </section>
        </div>

        <footer className="calendar-sheet__footer"><button type="button" onClick={onPrevious} disabled={!onPrevious} className="calendar-nav-button" aria-label="Día anterior"><ChevronLeft size={18} /></button><button type="button" onClick={() => void save()} disabled={isSaving} className="calendar-save-button">{isSaving ? 'Guardando…' : 'Guardar registro'}</button><button type="button" onClick={onNext} disabled={!onNext} className="calendar-nav-button" aria-label="Día siguiente"><ChevronRight size={18} /></button></footer>
      </section>
    </div>
  );
}

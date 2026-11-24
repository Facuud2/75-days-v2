'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { CustomExerciseRecord, healthService } from '@/lib/api/health';
import { BODY_ZONE_CHIPS, EQUIPMENT_CHIPS } from '@/lib/constants/fitness';

interface CustomExerciseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (exercise: CustomExerciseRecord) => void;
}

const MUSCLE_BY_ZONE: Record<string, string> = {
  chest: 'chest',
  back: 'lats',
  legs: 'quadriceps',
  shoulders: 'shoulders',
  arms: 'biceps',
  core: 'abdominals',
  cardio: 'quadriceps',
};

export default function CustomExerciseSheet({
  isOpen,
  onClose,
  onCreated,
}: CustomExerciseSheetProps) {
  const [name, setName] = useState('');
  const [bodyZone, setBodyZone] = useState('cardio');
  const [equipment, setEquipment] = useState('none');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('Escribe un nombre de al menos 2 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const created = await healthService.createCustomExercise({
        name: trimmed,
        bodyZone,
        primaryMuscle: MUSCLE_BY_ZONE[bodyZone] || 'chest',
        equipment,
        category: bodyZone === 'cardio' ? 'cardio' : 'strength',
        metValue: bodyZone === 'cardio' ? 8.0 : 5.0,
        notes: notes.trim() || null,
      });
      toast.success('Ejercicio personalizado creado');
      setName('');
      setNotes('');
      onCreated(created);
      onClose();
    } catch {
      toast.error('No se pudo crear el ejercicio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/75 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-exercise-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-4">
          <h2 id="custom-exercise-title" className="text-base font-bold text-white">
            Nuevo ejercicio propio
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label
              htmlFor="custom-ex-name"
              className="mb-1.5 block text-xs font-semibold text-zinc-400"
            >
              Nombre del ejercicio
            </label>
            <input
              id="custom-ex-name"
              type="text"
              required
              autoFocus
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Press inclinado en máquina convergente"
              className="min-h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-zinc-400">
              Zona muscular
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BODY_ZONE_CHIPS.filter((z) => z.key !== 'all').map((zone) => (
                <button
                  key={zone.key}
                  type="button"
                  onClick={() => {
                    setBodyZone(zone.key);
                    if (zone.key === 'cardio') setEquipment('none');
                  }}
                  className={`min-h-9 cursor-pointer rounded-xl border px-3 text-xs font-semibold transition-colors active:scale-95 ${
                    bodyZone === zone.key
                      ? 'border-rose-600 bg-rose-600/15 text-rose-700 dark:text-rose-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  {zone.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-zinc-400">
              Equipamiento
            </span>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_CHIPS.filter((eq) => eq.key !== 'all').map((eq) => (
                <button
                  key={eq.key}
                  type="button"
                  onClick={() => setEquipment(eq.key)}
                  className={`min-h-9 cursor-pointer rounded-xl border px-3 text-xs font-semibold transition-colors active:scale-95 ${
                    equipment === eq.key
                      ? 'border-rose-600 bg-rose-600/15 text-rose-700 dark:text-rose-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="custom-ex-notes"
              className="mb-1.5 block text-xs font-semibold text-zinc-400"
            >
              Notas o pista técnica (opcional)
            </label>
            <textarea
              id="custom-ex-notes"
              rows={2}
              maxLength={400}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Asiento en posición 4, pausa de 1s abajo."
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          <div className="flex gap-2.5 pt-1 pb-[env(safe-area-inset-bottom,0px)]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 flex-1 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-12 flex-[2] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-rose-500 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition-transform active:scale-[0.98] hover:bg-rose-600 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Crear ejercicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

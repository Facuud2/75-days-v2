'use client';

import { useState, useRef } from 'react';
import { useChallengeStore } from '@/store/useChallengeStore';
import { X, Camera, Scale, AlignLeft, Calendar, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DayDetailsModal({ date, onClose }: { date: string, onClose: () => void }) {
  const { logs, logDailyMetrics } = useChallengeStore();
  const log = logs[date] || { weight: '', photoUrl: '', notes: '', status: 'future' };

  const [weight, setWeight] = useState(log.weight?.toString() || '');
  const [photoUrl, setPhotoUrl] = useState(log.photoUrl || '');
  const [notes, setNotes] = useState(log.notes || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress to base64 jpeg
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setPhotoUrl(base64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const metrics: any = {};
    if (weight) metrics.weight = parseFloat(weight);
    if (photoUrl) metrics.photoUrl = photoUrl;
    if (notes) metrics.notes = notes;

    if (Object.keys(metrics).length > 0) {
      logDailyMetrics(date, metrics);
    }
    onClose();
  };

  // Parse YYYY-MM-DD safely in local timezone to avoid off-by-one errors
  const [year, month, day] = date.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  const formattedDate = format(localDate, "EEEE, d 'de' MMMM, yyyy", { locale: es });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1c0f16] border border-[#361726] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Calendar className="text-[#f43f5e]" />
            <h2 className="text-xl font-bold text-white tracking-tight capitalize">{formattedDate}</h2>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Weight */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white/70">
              <Scale size={16} className="text-[#f43f5e]" />
              Peso (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Ej. 75.5"
              className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#361726] text-white outline-none focus:border-[#f43f5e] transition-colors"
            />
          </div>

          {/* Photo */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm font-medium text-white/70">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#f43f5e]" />
                Foto de Progreso
              </div>
              {photoUrl && (
                <button
                  onClick={() => setPhotoUrl('')}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  Eliminar
                </button>
              )}
            </label>

            {!photoUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 rounded-xl border-2 border-dashed border-[#361726] hover:border-[#f43f5e]/50 bg-[#050505] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-white/50 hover:text-[#f43f5e]"
              >
                <Upload size={24} />
                <span className="text-sm font-medium">Subir Imagen</span>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 rounded-xl overflow-hidden border border-[#361726] aspect-video relative cursor-pointer group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Progreso" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-medium flex items-center gap-2">
                    <Camera size={20} /> Cambiar Foto
                  </span>
                </div>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white/70">
              <AlignLeft size={16} className="text-[#f43f5e]" />
              Notas del Día
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="¿Cómo te sentiste hoy? ¿Algún obstáculo?"
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#361726] text-white outline-none focus:border-[#f43f5e] transition-colors resize-none"
            />
          </div>

        </div>

        <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-[#050505]">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-[#f43f5e] text-white rounded-xl font-bold hover:bg-[#e11d48] transition-colors shadow-[0_0_15px_rgba(244,63,94,0.3)]"
          >
            Guardar
          </button>
        </div>

      </div>
    </div>
  );
}

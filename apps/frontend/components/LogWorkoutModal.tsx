import React, { useState } from 'react';
import { healthService } from '@/lib/api/health';
import { X, Activity, Clock, Flame, Footprints } from 'lucide-react';

interface LogWorkoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string; // YYYY-MM-DD
    onSaved: () => void;
    initialData?: any;
    onDelete?: (id: string) => void;
}

const SPORT_OPTIONS = [
    { value: 'strength', label: 'Fuerza (Gimnasio)' },
    { value: 'running', label: 'Running / Correr' },
    { value: 'cycling', label: 'Ciclismo' },
    { value: 'swimming', label: 'Natación' },
    { value: 'yoga', label: 'Yoga / Flexibilidad' },
    { value: 'walking', label: 'Caminata' },
    { value: 'other', label: 'Otro' }
];

const INTENSITY_OPTIONS = [
    { value: 'low', label: 'Baja' },
    { value: 'medium', label: 'Media' },
    { value: 'high', label: 'Alta' }
];

export default function LogWorkoutModal({ isOpen, onClose, date, onSaved, initialData, onDelete }: LogWorkoutModalProps) {
    const [sport, setSport] = useState('strength');
    const [durationMin, setDurationMin] = useState(45);
    const [intensity, setIntensity] = useState('medium');
    const [caloriesBurned, setCaloriesBurned] = useState<string>('');
    const [distanceKm, setDistanceKm] = useState<string>('');
    const [notes, setNotes] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setSport(initialData.sport || 'strength');
                setDurationMin(initialData.durationMin || 45);
                setIntensity(initialData.intensity || 'medium');
                setCaloriesBurned(initialData.isManualCalories && initialData.caloriesBurned ? String(initialData.caloriesBurned) : '');
                setDistanceKm(initialData.distanceKm ? String(initialData.distanceKm) : '');
                setNotes(initialData.notes || '');
            } else {
                setSport('strength');
                setDurationMin(45);
                setIntensity('medium');
                setCaloriesBurned('');
                setDistanceKm('');
                setNotes('');
            }
            setError(null);
        }
    }, [isOpen, initialData]);

    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            if (durationMin <= 0) {
                throw new Error('La duración debe ser mayor a 0 minutos');
            }

            const payload = {
                date,
                sport,
                durationMin,
                intensity,
                notes: notes || undefined,
                caloriesBurned: caloriesBurned ? Number(caloriesBurned) : undefined,
                distanceKm: distanceKm && Number(distanceKm) > 0 ? Number(distanceKm) : undefined,
            };

            if (initialData?.id) {
                await healthService.updateWorkout(initialData.id, payload);
            } else {
                await healthService.logWorkout(payload);
            }

            onSaved();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al guardar el entrenamiento');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!initialData?.id || !onDelete) return;
        if (!confirm('¿Estás seguro de que deseas eliminar este entrenamiento?')) return;

        setIsSubmitting(true);
        try {
            await healthService.deleteWorkout(initialData.id);
            onDelete(initialData.id);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al eliminar el entrenamiento');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="workout-modal-title">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-t-[2rem] sm:rounded-2xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[92dvh] sm:max-h-none">

                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-900 bg-zinc-900/50">
                    <h2 id="workout-modal-title" className="text-lg font-bold flex items-center gap-2">
                        <Footprints className="w-5 h-5 text-[#fc4c02]" />
                        {initialData ? 'Editar Actividad' : 'Registrar Actividad'}
                    </h2>
                    <button
                        aria-label="Cerrar registro de entrenamiento"
                        onClick={onClose}
                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-4 sm:p-5 max-h-[70dvh] sm:max-h-[75vh] overflow-y-auto overscroll-contain">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form id="workout-form" onSubmit={handleSubmit} className="space-y-4">

                        {/* Sport Select */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">
                                Deporte
                            </label>
                            <div className="relative">
                                <select
                                    value={sport}
                                    onChange={(e) => setSport(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-[#fc4c02]/50 text-white font-medium"
                                >
                                    {SPORT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                    <Activity className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* Duration */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">
                                    Duración (min)
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={durationMin}
                                        onChange={(e) => setDurationMin(Number(e.target.value))}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#fc4c02]/50"
                                    />
                                </div>
                            </div>

                            {/* Intensity */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">
                                    Intensidad
                                </label>
                                <select
                                    value={intensity}
                                    onChange={(e) => setIntensity(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-[#fc4c02]/50"
                                >
                                    {INTENSITY_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Optional Fields Toggle Area */}
                        <div className="pt-2 border-t border-zinc-900/50 space-y-4">

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {/* Calories Override */}
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1 flex items-center justify-between">
                                        <span>Calorías (Opcional)</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                            <Flame className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="Auto"
                                            value={caloriesBurned}
                                            onChange={(e) => setCaloriesBurned(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#fc4c02]/50 placeholder:text-zinc-600"
                                        />
                                    </div>
                                </div>

                                {/* Distance */}
                                {sport !== 'strength' && sport !== 'yoga' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1 flex items-center justify-between">
                                            <span>Distancia (km) (Opcional)</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0.1"
                                            placeholder="0.0"
                                            value={distanceKm}
                                            onChange={(e) => setDistanceKm(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#fc4c02]/50 placeholder:text-zinc-600"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">
                                    Notas
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ej: Series de piernas, Carrera a paso ligero..."
                                    rows={2}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#fc4c02]/50 resize-none"
                                />
                            </div>

                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-5 border-t border-zinc-900 bg-zinc-900/50 flex gap-3">
                    {initialData && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            className="py-3 px-4 rounded-xl border border-red-500/30 text-red-500 font-semibold hover:bg-red-500/10 transition flex items-center justify-center disabled:opacity-50"
                        >
                            Eliminar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl border border-zinc-700 bg-zinc-800 text-white font-semibold hover:bg-zinc-700 transition flex items-center justify-center"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="workout-form"
                        disabled={isSubmitting}
                        className="flex-[2] py-3 px-4 rounded-xl bg-[#fc4c02] text-white font-bold hover:bg-[#e34402] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#fc4c02]/20"
                    >
                        {isSubmitting ? (
                            <span className="animate-pulse">Guardando...</span>
                        ) : (
                            <>{initialData ? 'Actualizar' : 'Guardar'}</>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}

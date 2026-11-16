'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2, Edit3, Trash2 } from 'lucide-react';
import { Meal, LogMealPayload } from '@/lib/api/health';
import { useHealthStore } from '@/store/useHealthStore';
import toast from 'react-hot-toast';

interface EditMealModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    meal: Meal | null;
    date: string;
}

function buildInitialFormData(meal: Meal | null) {
    return {
        name: meal?.name ?? '',
        calories: meal ? meal.calories.toString() : '',
        proteinG: meal ? meal.proteinG.toString() : '',
        carbG: meal ? meal.carbG.toString() : '',
        fatG: meal ? meal.fatG.toString() : '',
    };
}

export default function EditMealModal({ isOpen, onClose, onSaved, meal, date }: EditMealModalProps) {
    const { updateMealOptimistic, deleteMealOptimistic } = useHealthStore();
    const isSaving = false;
    const isDeleting = false;
    const currentMealKey = isOpen && meal ? meal.id : null;
    const [prevMealKey, setPrevMealKey] = useState<string | null>(currentMealKey);
    const [formData, setFormData] = useState(() => buildInitialFormData(meal));

    if (currentMealKey !== prevMealKey) {
        setPrevMealKey(currentMealKey);
        if (isOpen && meal) {
            setFormData(buildInitialFormData(meal));
        }
    }

    if (!isOpen || !meal) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.calories) return;

        const payload: LogMealPayload = {
            date: date,
            mealType: meal.mealType as any,
            name: formData.name,
            calories: Number(formData.calories),
            proteinG: Number(formData.proteinG) || 0,
            carbG: Number(formData.carbG) || 0,
            fatG: Number(formData.fatG) || 0
        };

        // 0ms Optimistic UI: actualiza el store y cierra el modal al instante
        onSaved();
        onClose();
        void updateMealOptimistic(meal.id, payload).catch(() => {
            toast.error('No se pudieron guardar los cambios del alimento.');
        });
    };

    const handleDelete = () => {
        if (!meal || !window.confirm('¿Estás seguro de que deseas eliminar este alimento?')) return;

        const mealId = meal.id;
        // 0ms Optimistic UI: elimina del store y cierra el modal al instante
        onSaved();
        onClose();
        void deleteMealOptimistic(mealId, date).catch(() => {
            toast.error('Error al eliminar el alimento.');
        });
    };

    return (
        <div
            className="mobile-sheet-root fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="mobile-sheet-panel bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
                    <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                        <Edit3 className="w-5 h-5 text-orange-400" />
                        Editar Alimento
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDelete}
                            disabled={isSaving || isDeleting}
                            className="text-red-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                            title="Eliminar alimento"
                        >
                            {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors p-2 rounded-lg hover:bg-zinc-800"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <form id="edit-meal-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-zinc-400 mb-1 block">Nombre del Registro *</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-zinc-400 mb-1 block">Calorías Totales *</label>
                            <input
                                required
                                type="number"
                                min="0"
                                value={formData.calories}
                                onChange={e => setFormData({ ...formData, calories: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
                            />
                        </div>

                        <div className="pt-2 border-t border-zinc-800">
                            <p className="text-xs text-zinc-500 mb-3">Macronutrientes (Gramos)</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-blue-400 mb-1 block">Proteínas</label>
                                    <input type="number" min="0" step="any" value={formData.proteinG} onChange={e => setFormData({ ...formData, proteinG: e.target.value })} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-center text-zinc-200 focus:border-blue-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-yellow-400 mb-1 block">Carbos</label>
                                    <input type="number" min="0" step="any" value={formData.carbG} onChange={e => setFormData({ ...formData, carbG: e.target.value })} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-center text-zinc-200 focus:border-yellow-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-red-400 mb-1 block">Grasas</label>
                                    <input type="number" min="0" step="any" value={formData.fatG} onChange={e => setFormData({ ...formData, fatG: e.target.value })} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-center text-zinc-200 focus:border-red-500 focus:outline-none" />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 shrink-0">
                    <button
                        type="submit"
                        form="edit-meal-form"
                        disabled={isSaving || !formData.name || !formData.calories}
                        className="w-full flex justify-center items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                    >
                        {isSaving ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                        ) : (
                            <><CheckCircle2 className="w-5 h-5" /> Guardar Cambios</>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { X, Search, Utensils, Loader2, CheckCircle2, ChevronRight, ArrowLeft } from 'lucide-react';
import { healthService, FatSecretFoodItem, FatSecretFoodDetails, FatSecretFoodServing } from '@/lib/api/health';

interface LogMealModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    date: string; // YYYY-MM-DD
}

type Step = 'SEARCH' | 'DETAILS';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function LogMealModal({ isOpen, onClose, onSaved, date }: LogMealModalProps) {
    const [step, setStep] = useState<Step>('SEARCH');
    const [mealType, setMealType] = useState<MealType>('lunch');

    // Search state
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<FatSecretFoodItem[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Detail state
    const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
    const [foodDetails, setFoodDetails] = useState<FatSecretFoodDetails | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [selectedServing, setSelectedServing] = useState<FatSecretFoodServing | null>(null);
    const [quantity, setQuantity] = useState<number>(1);

    // Submission
    const [isSaving, setIsSaving] = useState(false);

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setStep('SEARCH');
            setQuery('');
            setSearchResults([]);
            setHasSearched(false);
            setFoodDetails(null);
            setSelectedFoodId(null);
            setQuantity(1);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        setHasSearched(true);
        try {
            const res = await healthService.searchFood(query);
            setSearchResults(res.results || []);
        } catch (error) {
            console.error('Failed to search food:', error);
            // Could add toast or alert here
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectFood = async (id: string) => {
        setSelectedFoodId(id);
        setStep('DETAILS');
        setIsLoadingDetails(true);
        try {
            const details = await healthService.getFoodDetails(id);
            setFoodDetails(details);
            if (details.servings && details.servings.length > 0) {
                // Pre-select the first serving option
                setSelectedServing(details.servings[0]);
            }
        } catch (error) {
            console.error('Failed to get food details:', error);
            setStep('SEARCH'); // Go back on error
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleSaveMeal = async () => {
        if (!foodDetails || !selectedServing) return;

        setIsSaving(true);
        try {
            const payload = {
                date,
                mealType,
                name: foodDetails.name,
                calories: selectedServing.calories * quantity,
                proteinG: selectedServing.protein * quantity,
                carbG: selectedServing.carbohydrates * quantity,
                fatG: selectedServing.fat * quantity
            };

            await healthService.logMeal(payload);
            onSaved();
            onClose();
        } catch (error) {
            console.error('Failed to save meal:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
                    <div className="flex items-center gap-3">
                        {step === 'DETAILS' && (
                            <button onClick={() => setStep('SEARCH')} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div>
                            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                                <Utensils className="w-5 h-5 text-orange-400" />
                                {step === 'SEARCH' ? 'Registrar Comida' : 'Detalles de la Composición'}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">

                    {step === 'SEARCH' && (
                        <div className="space-y-6">
                            {/* Meal Type Selector */}
                            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800/50">
                                {([
                                    { id: 'breakfast', label: 'Desayuno' },
                                    { id: 'lunch', label: 'Almuerzo' },
                                    { id: 'snack', label: 'Snack' },
                                    { id: 'dinner', label: 'Cena' }
                                ] as const).map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setMealType(type.id)}
                                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${mealType === type.id
                                                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>

                            {/* Search Input */}
                            <form onSubmit={handleSearch} className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-zinc-500" />
                                </div>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="block w-full pl-10 pr-12 py-3 border border-zinc-700 rounded-xl leading-5 bg-zinc-950 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 sm:text-sm transition-colors"
                                    placeholder="Buscar alimento (ej: Manzana, Pollo...)"
                                />
                                <button
                                    type="submit"
                                    disabled={!query.trim() || isSearching}
                                    className="absolute inset-y-1 right-1 px-3 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                                >
                                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : 'Buscar'}
                                </button>
                            </form>

                            {/* Results List */}
                            <div className="space-y-2">
                                {!hasSearched && !isSearching && (
                                    <div className="text-center py-10 text-sm text-zinc-500">
                                        Busca un alimento para agregarlo a tu registro nutricional de hoy.
                                    </div>
                                )}

                                {hasSearched && searchResults.length === 0 && !isSearching && (
                                    <div className="text-center py-10 text-sm text-zinc-500">
                                        No se encontraron resultados para "{query}".
                                    </div>
                                )}

                                {searchResults.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelectFood(item.id)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/30 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all text-left group"
                                    >
                                        <div>
                                            <div className="font-semibold text-sm text-zinc-200 group-hover:text-orange-400 transition-colors">
                                                {item.name} {item.brand && <span className="text-xs text-zinc-500 font-normal">({item.brand})</span>}
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-1 line-clamp-1">
                                                {item.description}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-orange-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'DETAILS' && (
                        <div className="space-y-6">
                            {isLoadingDetails || !foodDetails ? (
                                <div className="py-20 flex flex-col items-center justify-center text-zinc-500 space-y-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                                    <span className="text-sm">Obteniendo macros...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Food Header */}
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold text-zinc-100">{foodDetails.name}</h3>
                                        {foodDetails.brand && <p className="text-sm text-zinc-500">{foodDetails.brand}</p>}
                                    </div>

                                    {/* Serving Selector */}
                                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                                                Tamaño de Porción
                                            </label>
                                            <select
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-orange-500 transition-colors"
                                                value={selectedServing?.id || ''}
                                                onChange={(e) => {
                                                    const serving = foodDetails.servings.find(s => s.id === e.target.value);
                                                    if (serving) setSelectedServing(serving);
                                                }}
                                            >
                                                {foodDetails.servings.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.description} {s.metricAmount ? `(${s.metricAmount}${s.metricUnit})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                                                Cantidad (Multiplicador)
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="range"
                                                    min="0.5"
                                                    max="5"
                                                    step="0.5"
                                                    value={quantity}
                                                    onChange={(e) => setQuantity(parseFloat(e.target.value))}
                                                    className="flex-1 accent-orange-500"
                                                />
                                                <div className="bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-md text-sm font-bold min-w-[3rem] text-center">
                                                    {quantity}x
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Macros Preview */}
                                    {selectedServing && (
                                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                                            <div className="text-center mb-4">
                                                <span className="text-3xl font-black text-white">{(selectedServing.calories * quantity).toFixed(0)}</span>
                                                <span className="text-xs text-zinc-500 ml-1 font-bold uppercase">kcal</span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-center">
                                                    <div className="text-[10px] text-blue-400 uppercase font-semibold mb-1">Proteínas</div>
                                                    <div className="font-bold text-zinc-100">{(selectedServing.protein * quantity).toFixed(1)}g</div>
                                                </div>
                                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 text-center">
                                                    <div className="text-[10px] text-yellow-400 uppercase font-semibold mb-1">Carbos</div>
                                                    <div className="font-bold text-zinc-100">{(selectedServing.carbohydrates * quantity).toFixed(1)}g</div>
                                                </div>
                                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-center">
                                                    <div className="text-[10px] text-red-400 uppercase font-semibold mb-1">Grasas</div>
                                                    <div className="font-bold text-zinc-100">{(selectedServing.fat * quantity).toFixed(1)}g</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                {step === 'DETAILS' && foodDetails && selectedServing && !isLoadingDetails && (
                    <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 shrink-0">
                        <button
                            onClick={handleSaveMeal}
                            disabled={isSaving}
                            className="w-full flex justify-center items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                        >
                            {isSaving ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                            ) : (
                                <><CheckCircle2 className="w-5 h-5" /> Agregar al Registro</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

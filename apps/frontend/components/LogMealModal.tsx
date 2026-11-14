'use client';

import { useState, useEffect } from 'react';
import { X, Search, Utensils, Loader2, CheckCircle2, ChevronRight, ArrowLeft, Plus, Bookmark, Flame } from 'lucide-react';
import { healthService, FatSecretFoodItem, FatSecretFoodDetails, FatSecretFoodServing, CustomFood, Ingredient } from '@/lib/api/health';

interface LogMealModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    date: string; // YYYY-MM-DD
}

type Tab = 'SEARCH' | 'CUSTOM';
type Step = 'MAIN' | 'DETAILS' | 'CREATE_CUSTOM';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_SUGGESTIONS: Record<MealType, string[]> = {
    breakfast: ['Avena', 'Huevo', 'Pan Integral', 'Café', 'Plátano', 'Leche'],
    lunch: ['Pechuga de Pollo', 'Arroz', 'Fideos', 'Atún', 'Ensalada'],
    snack: ['Yogur', 'Almendras', 'Manzana', 'Proteína en Polvo', 'Barrita'],
    dinner: ['Pescado', 'Pollo', 'Huevo', 'Ensalada', 'Sopa']
};

export default function LogMealModal({ isOpen, onClose, onSaved, date }: LogMealModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('SEARCH');
    const [step, setStep] = useState<Step>('MAIN');
    const [mealType, setMealType] = useState<MealType>('lunch');

    // Search state (Online)
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<FatSecretFoodItem[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Custom Foods / Recipe Builder state
    const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
    const [systemIngredients, setSystemIngredients] = useState<Ingredient[]>([]);
    const [isLoadingCustom, setIsLoadingCustom] = useState(false);

    // New Recipe Builder State
    const [newCustomFood, setNewCustomFood] = useState({
        name: '',
        description: '',
        servingSize: ''
    });
    const [recipeIngredients, setRecipeIngredients] = useState<{ ingredientId: string; weightGrams: number, ingredient?: Ingredient }[]>([]);
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [isSelectingIngredient, setIsSelectingIngredient] = useState(false);
    const [ingredientSearchResults, setIngredientSearchResults] = useState<FatSecretFoodItem[]>([]);
    const [isSearchingIngredient, setIsSearchingIngredient] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

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
            setActiveTab('SEARCH');
            setStep('MAIN');
            setQuery('');
            setSearchResults([]);
            setHasSearched(false);
            setFoodDetails(null);
            setSelectedFoodId(null);
            setQuantity(1);
            setRecipeIngredients([]);
            setIsSelectingIngredient(false);
            setIngredientSearch('');
            setIngredientSearchResults([]);
            fetchCustomFoods();
            fetchSystemIngredients();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const fetchSystemIngredients = async () => {
        try {
            const ingredients = await healthService.getSystemIngredients();
            setSystemIngredients(ingredients);
        } catch (error) {
            console.error('Failed to load system ingredients:', error);
        }
    };

    const fetchCustomFoods = async () => {
        setIsLoadingCustom(true);
        try {
            const foods = await healthService.getCustomFoods();
            setCustomFoods(foods);
        } catch (error) {
            console.error('Failed to load custom foods:', error);
        } finally {
            setIsLoadingCustom(false);
        }
    };

    if (!isOpen) return null;

    const handleSearch = async (e?: React.FormEvent, directQuery?: string) => {
        if (e) e.preventDefault();
        const searchTerm = directQuery || query;
        if (!searchTerm.trim()) return;

        if (directQuery) {
            setQuery(directQuery);
        }

        setIsSearching(true);
        setHasSearched(true);
        try {
            const res = await healthService.searchFood(searchTerm);
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
            setStep('MAIN'); // Go back on error
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // Recipe Builder Handlers
    const handleIngredientSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!ingredientSearch.trim()) return;

        setIsSearchingIngredient(true);
        try {
            const res = await healthService.searchFood(ingredientSearch);
            setIngredientSearchResults(res.results || []);
        } catch (error) {
            console.error('Failed to search ingredients:', error);
        } finally {
            setIsSearchingIngredient(false);
        }
    };

    const handleSelectIngredientFromSearch = async (item: FatSecretFoodItem) => {
        setIsImporting(true);
        try {
            const ingredient = await healthService.importFatSecretFood(item.id);
            addIngredientToRecipe(ingredient);
            setIngredientSearchResults([]);
        } catch (error) {
            console.error('Failed to import ingredient:', error);
        } finally {
            setIsImporting(false);
        }
    };

    const addIngredientToRecipe = (ingredient: Ingredient) => {
        setRecipeIngredients(prev => [...prev, { ingredientId: ingredient.id, weightGrams: 100, ingredient }]);
        setIsSelectingIngredient(false);
        setIngredientSearch('');
    };

    const updateIngredientWeight = (index: number, weightGrams: number) => {
        setRecipeIngredients(prev => {
            const next = [...prev];
            next[index].weightGrams = weightGrams;
            return next;
        });
    };

    const removeIngredient = (index: number) => {
        setRecipeIngredients(prev => prev.filter((_, i) => i !== index));
    };

    const currentRecipeMacros = recipeIngredients.reduce((acc, item) => {
        if (!item.ingredient) return acc;
        const mult = item.weightGrams / 100;
        return {
            cals: acc.cals + item.ingredient.caloriesPer100g * mult,
            p: acc.p + item.ingredient.proteinPer100g * mult,
            c: acc.c + item.ingredient.carbPer100g * mult,
            f: acc.f + item.ingredient.fatPer100g * mult,
        };
    }, { cals: 0, p: 0, c: 0, f: 0 });

    const handleCreateCustomFood = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCustomFood.name || recipeIngredients.length === 0) return;

        setIsSaving(true);
        try {
            await healthService.createCustomFood({
                name: newCustomFood.name,
                description: newCustomFood.description || null,
                servingSize: newCustomFood.servingSize || null,
                ingredients: recipeIngredients.map(i => ({ ingredientId: i.ingredientId, weightGrams: i.weightGrams }))
            });
            await fetchCustomFoods();
            setStep('MAIN');
            setNewCustomFood({ name: '', description: '', servingSize: '' });
            setRecipeIngredients([]);
        } catch (error) {
            console.error('Failed to create custom food:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogCustomFood = async (food: CustomFood) => {
        setIsSaving(true);
        try {
            const payload = {
                date,
                mealType,
                name: food.name,
                calories: food.calories,
                proteinG: food.proteinG,
                carbG: food.carbG,
                fatG: food.fatG
            };
            await healthService.logMeal(payload);
            onSaved();
            onClose();
        } catch (error) {
            console.error('Failed to log custom food:', error);
        } finally {
            setIsSaving(false);
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
            className="mobile-sheet-root fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meal-modal-title"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="mobile-sheet-panel bg-zinc-900 border border-zinc-800 rounded-t-[2rem] sm:rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 sm:px-6 border-b border-zinc-800 shrink-0">
                    <div className="flex items-center gap-3">
                        {step !== 'MAIN' && (
                            <button onClick={() => setStep('MAIN')} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div>
                            <h2 id="meal-modal-title" className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                                <Utensils className="w-5 h-5 text-orange-400" />
                                {step === 'MAIN' ? 'Registrar Comida' :
                                    step === 'DETAILS' ? 'Detalles de la Composición' : 'Crear Plato Personalizado'}
                            </h2>
                        </div>
                    </div>
                    <button
                        aria-label="Cerrar registro de comida"
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">

                    {step === 'MAIN' && (
                        <div className="space-y-6">

                            {/* Tabs */}
                            <div className="flex border-b border-zinc-800">
                                <button
                                    onClick={() => setActiveTab('SEARCH')}
                                    className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'SEARCH'
                                        ? 'text-orange-400 border-orange-400'
                                        : 'text-zinc-500 border-transparent hover:text-zinc-300'
                                        }`}
                                >
                                    Buscador Online
                                </button>
                                <button
                                    onClick={() => setActiveTab('CUSTOM')}
                                    className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'CUSTOM'
                                        ? 'text-orange-400 border-orange-400'
                                        : 'text-zinc-500 border-transparent hover:text-zinc-300'
                                        }`}
                                >
                                    <Bookmark className="w-4 h-4" /> Mis Comidas
                                </button>
                            </div>

                            {/* Meal Type Selector (Shared) */}
                            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800/50">
                                {([
                                    { id: 'breakfast', label: 'Desayuno' },
                                    { id: 'lunch', label: 'Almuerzo' },
                                    { id: 'snack', label: 'Snack' },
                                    { id: 'dinner', label: 'Cena' }
                                ] as const).map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => {
                                            setMealType(type.id);
                                            setQuery('');
                                            setSearchResults([]);
                                            setHasSearched(false);
                                        }}
                                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${mealType === type.id
                                            ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>

                            {activeTab === 'SEARCH' && (
                                <div className="space-y-4">
                                    {/* Search Input */}
                                    <form onSubmit={handleSearch} className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-4 w-4 text-zinc-500" />
                                        </div>
                                        <input
                                            type="text"
                                            value={query}
                                            onChange={(e) => {
                                                setQuery(e.target.value);
                                                if (e.target.value === '') {
                                                    setSearchResults([]);
                                                    setHasSearched(false);
                                                }
                                            }}
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
                                            <div className="py-6">
                                                 <p className="text-xs text-zinc-500 font-semibold mb-3 text-center">
                                                    Sugerencias rápidas para {mealType === 'breakfast' ? 'Desayuno' : mealType === 'lunch' ? 'Almuerzo' : mealType === 'dinner' ? 'Cena' : 'Snack'}
                                                </p>
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    {MEAL_SUGGESTIONS[mealType].map(item => (
                                                        <button
                                                            key={item}
                                                            type="button"
                                                            onClick={() => handleSearch(undefined, item)}
                                                            className="px-3 py-1.5 bg-zinc-950/50 border border-zinc-800 text-zinc-400 text-xs font-semibold rounded-lg hover:bg-zinc-800 hover:text-orange-400 transition-colors"
                                                        >
                                                            {item}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {hasSearched && searchResults.length === 0 && !isSearching && (
                                            <div className="text-center py-10 text-sm text-zinc-500">
                                                No se encontraron resultados para &quot;{query}&quot;.
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

                            {activeTab === 'CUSTOM' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                         <p className="text-xs text-zinc-400 font-semibold">Tus recetas frecuentes</p>
                                        <button
                                            onClick={() => setStep('CREATE_CUSTOM')}
                                            className="text-xs bg-orange-500/10 text-orange-400 font-bold px-3 py-1.5 rounded-lg hover:bg-orange-500/20 transition-colors flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" /> Nuevo
                                        </button>
                                    </div>

                                    {isLoadingCustom ? (
                                        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
                                    ) : customFoods.length === 0 ? (
                                        <div className="text-center py-10 text-sm text-zinc-500 bg-zinc-950/50 rounded-xl border border-dashed border-zinc-800">
                                            Aún no tienes platillos personalizados creados.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {customFoods.map(food => (
                                                <button
                                                    key={food.id}
                                                    onClick={() => handleLogCustomFood(food)}
                                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/30 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all text-left group"
                                                >
                                                    <div>
                                                        <div className="font-bold text-sm text-zinc-200 group-hover:text-orange-400 transition-colors">
                                                            {food.name}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 mt-1 flex gap-2">
                                                             <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400" /> {food.calories}kcal</span>
                                                            <span className="text-zinc-700">|</span>
                                                            <span>P: {food.proteinG}g</span>
                                                            <span>C: {food.carbG}g</span>
                                                            <span>G: {food.fatG}g</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-orange-500/20 text-orange-500 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

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
                                             <label className="text-xs font-semibold text-zinc-400 mb-2 block">
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
                                             <label className="text-xs font-semibold text-zinc-400 mb-2 block">
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
                                                 <span className="text-xs text-zinc-500 ml-1 font-bold">kcal</span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-center">
                                                     <div className="text-[10px] text-blue-400 font-semibold mb-1">Proteínas</div>
                                                    <div className="font-bold text-zinc-100">{(selectedServing.protein * quantity).toFixed(1)}g</div>
                                                </div>
                                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 text-center">
                                                     <div className="text-[10px] text-yellow-400 font-semibold mb-1">Carbos</div>
                                                    <div className="font-bold text-zinc-100">{(selectedServing.carbohydrates * quantity).toFixed(1)}g</div>
                                                </div>
                                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-center">
                                                     <div className="text-[10px] text-red-400 font-semibold mb-1">Grasas</div>
                                                    <div className="font-bold text-zinc-100">{(selectedServing.fat * quantity).toFixed(1)}g</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </>
                            )}
                        </div>
                    )}

                    {step === 'CREATE_CUSTOM' && (
                        <div className="space-y-6">
                            {/* Recipe Form */}
                            <form id="create-custom-form" onSubmit={handleCreateCustomFood} className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-zinc-400 mb-1 block">Nombre del Platillo *</label>
                                    <input
                                        required
                                        type="text"
                                        value={newCustomFood.name}
                                        onChange={e => setNewCustomFood({ ...newCustomFood, name: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
                                        placeholder="Ej: Avena Mágica"
                                    />
                                </div>

                                {/* Ingredients Section */}
                                <div className="pt-2 border-t border-zinc-800">
                                    <div className="flex justify-between items-center mb-3">
                                         <p className="text-xs font-semibold text-zinc-400">Ingredientes</p>
                                        {!isSelectingIngredient && (
                                            <button
                                                type="button"
                                                onClick={() => setIsSelectingIngredient(true)}
                                                className="text-orange-400 hover:text-orange-300 text-xs font-bold flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" /> Añadir
                                            </button>
                                        )}
                                    </div>

                                    {/* Selected Ingredients List */}
                                    {recipeIngredients.length > 0 ? (
                                        <div className="space-y-2 mb-4">
                                            {recipeIngredients.map((item, index) => (
                                                <div key={`${item.ingredientId}-${index}`} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950/50 border border-zinc-800">
                                                    <div className="flex-1">
                                                        <p className="text-sm text-zinc-200 font-semibold">{item.ingredient?.name}</p>
                                                        <p className="text-[10px] text-zinc-500">{(item.ingredient!.caloriesPer100g * (item.weightGrams / 100)).toFixed(0)} kcal</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.weightGrams}
                                                                onChange={(e) => updateIngredientWeight(index, Number(e.target.value))}
                                                                className="w-16 bg-zinc-900 border border-zinc-700 rounded-md py-1 pl-2 pr-6 text-xs text-right text-zinc-200 focus:border-orange-500 focus:outline-none"
                                                            />
                                                            <span className="absolute right-2 top-1.5 text-xs text-zinc-500 pointer-events-none">g</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeIngredient(index)}
                                                            className="p-1 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-red-400"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center p-3 mt-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                                <div>
                                                     <p className="text-[10px] text-orange-400 font-bold">Total Estimado</p>
                                                     <p className="text-lg font-black text-white">{currentRecipeMacros.cals.toFixed(0)} <span className="text-xs text-zinc-500 font-bold">kcal</span></p>
                                                </div>
                                                <div className="flex gap-3 text-xs text-zinc-400">
                                                     <span className="flex flex-col items-center"><span className="text-blue-400 font-bold text-[9px]">P</span>{currentRecipeMacros.p.toFixed(1)}g</span>
                                                     <span className="flex flex-col items-center"><span className="text-yellow-400 font-bold text-[9px]">C</span>{currentRecipeMacros.c.toFixed(1)}g</span>
                                                     <span className="flex flex-col items-center"><span className="text-red-400 font-bold text-[9px]">G</span>{currentRecipeMacros.f.toFixed(1)}g</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        !isSelectingIngredient && (
                                            <div className="text-center py-6 text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/30">
                                                <Utensils className="w-5 h-5 mx-auto mb-2 text-zinc-600" />
                                                Empieza añadiendo ingredientes<br />para calcular los macros.
                                            </div>
                                        )
                                    )}

                                    {/* Ingredient Picker Overlay */}
                                    {isSelectingIngredient && (
                                        <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded-xl p-3 shadow-lg">
                                            <div className="flex justify-between items-center mb-2">
                                                <p className="text-xs text-zinc-400 font-bold">Buscar ingrediente base</p>
                                                <button type="button" onClick={() => setIsSelectingIngredient(false)}><X className="w-4 h-4 text-zinc-500 hover:text-white" /></button>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={ingredientSearch}
                                                    onChange={e => {
                                                        setIngredientSearch(e.target.value);
                                                        if (e.target.value === '') setIngredientSearchResults([]);
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleIngredientSearch();
                                                        }
                                                    }}
                                                    placeholder="Ej: Huevo, Pollo..."
                                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 mb-2 focus:border-orange-500 focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleIngredientSearch}
                                                    disabled={isSearchingIngredient || !ingredientSearch.trim()}
                                                    className="mb-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
                                                >
                                                    {isSearchingIngredient ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : <Search className="w-4 h-4 text-zinc-400" />}
                                                </button>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-zinc-700">
                                                {isImporting ? (
                                                    <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>
                                                ) : ingredientSearchResults.length > 0 ? (
                                                    ingredientSearchResults.map(item => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => handleSelectIngredientFromSearch(item)}
                                                            className="w-full text-left p-2 hover:bg-zinc-800 rounded-lg flex flex-col group overflow-hidden"
                                                        >
                                                            <span className="text-sm font-semibold text-zinc-300 group-hover:text-white truncate w-full">{item.name} {item.brand && <span className="text-xs text-zinc-500 font-normal">({item.brand})</span>}</span>
                                                            <span className="text-xs text-zinc-500 truncate w-full">{item.description}</span>
                                                        </button>
                                                    ))
                                                ) : ingredientSearch ? (
                                                    <div className="text-xs text-center text-zinc-500 py-2">Busca para ver resultados de FatSecret</div>
                                                ) : (
                                                    <div className="text-xs text-center text-zinc-600 py-2">Ingresa el nombre del alimento y busca</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                {step === 'CREATE_CUSTOM' && (
                    <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-zinc-800 bg-zinc-950/50 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10">
                        <button
                            type="submit"
                            form="create-custom-form"
                            disabled={isSaving || !newCustomFood.name || recipeIngredients.length === 0}
                             className="w-full flex justify-center items-center gap-2 bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-orange-500/20"
                        >
                            {isSaving ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Creando Platillo...</>
                            ) : (
                                <><Utensils className="w-5 h-5" /> Guardar Platillo</>
                            )}
                        </button>
                    </div>
                )}
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

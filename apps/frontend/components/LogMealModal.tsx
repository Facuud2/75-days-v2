'use client';

import { useState, useEffect } from 'react';
import { X, Search, Utensils, Loader2, CheckCircle2, ChevronRight, ArrowLeft, Plus, Bookmark, Flame } from 'lucide-react';
import { healthService, FatSecretFoodItem, FatSecretFoodDetails, FatSecretFoodServing, CustomFood, Ingredient } from '@/lib/api/health';
import { useHealthStore } from '@/store/useHealthStore';
import MealPhotoAnalyzer, { AnalyzerStage } from '@/components/MealPhotoAnalyzer';
import toast from 'react-hot-toast';

interface LogMealModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    date: string; // YYYY-MM-DD
    initialTab?: 'AI' | 'SEARCH' | 'CUSTOM';
    initialMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

type Tab = 'AI' | 'SEARCH' | 'CUSTOM';
type Step = 'MAIN' | 'DETAILS' | 'CREATE_CUSTOM';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

function inferDefaultMealType(): MealType {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    if (hour < 19) return 'snack';
    return 'dinner';
}

const MEAL_SUGGESTIONS: Record<MealType, string[]> = {
    breakfast: ['Avena', 'Huevo', 'Pan Integral', 'Café', 'Plátano', 'Leche'],
    lunch: ['Pechuga de Pollo', 'Arroz', 'Fideos', 'Atún', 'Ensalada'],
    snack: ['Yogur', 'Almendras', 'Manzana', 'Proteína en Polvo', 'Barrita'],
    dinner: ['Pescado', 'Pollo', 'Huevo', 'Ensalada', 'Sopa']
};

export default function LogMealModal(props: LogMealModalProps) {
    if (!props.isOpen) return null;
    return (
        <LogMealModalContent
            onClose={props.onClose}
            onSaved={props.onSaved}
            date={props.date}
            initialTab={props.initialTab}
            initialMealType={props.initialMealType}
        />
    );
}

function LogMealModalContent({ onClose, onSaved, date, initialTab, initialMealType }: Omit<LogMealModalProps, 'isOpen'>) {
    const activeTab: Tab = initialTab ?? 'AI';
    const [aiStage, setAiStage] = useState<AnalyzerStage>('CAMERA');
    const [step, setStep] = useState<Step>('MAIN');
    const [mealType, setMealType] = useState<MealType>(() => initialMealType ?? inferDefaultMealType());

    // Search state (Online)
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<FatSecretFoodItem[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Custom Foods / Recipe Builder state (Cached via useHealthStore for 0ms open)
    const {
        customFoods,
        systemIngredients,
        isLoadingCustomFoods: isLoadingCustom,
        fetchCatalogIfNeeded,
        logMealOptimistic,
        createCustomFoodOptimistic,
    } = useHealthStore();

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

    // Hydrate catalog when mounted
    useEffect(() => {
        void fetchCatalogIfNeeded();
    }, [fetchCatalogIfNeeded]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

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
            toast.error('No se pudo buscar el alimento.');
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
            toast.error('No se pudieron cargar los detalles del alimento.');
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
            toast.error('No se pudieron buscar ingredientes.');
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
            toast.error('No se pudo importar el ingrediente.');
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

    const handleCreateCustomFood = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCustomFood.name || recipeIngredients.length === 0) return;

        const payload = {
            name: newCustomFood.name,
            description: newCustomFood.description || null,
            servingSize: newCustomFood.servingSize || null,
            ingredients: recipeIngredients.map(i => ({ ingredientId: i.ingredientId, weightGrams: i.weightGrams }))
        };
        const computed = {
            calories: currentRecipeMacros.cals,
            proteinG: currentRecipeMacros.p,
            carbG: currentRecipeMacros.c,
            fatG: currentRecipeMacros.f,
        };

        // 0ms Optimistic UI: vuelve a MAIN inmediatamente y sincroniza en segundo plano
        setStep('MAIN');
        setNewCustomFood({ name: '', description: '', servingSize: '' });
        setRecipeIngredients([]);
        toast.success(`Platillo "${payload.name}" guardado`);
        void createCustomFoodOptimistic(payload, computed).catch(() => {
            toast.error('No se pudo guardar el platillo personalizado.');
        });
    };

    const handleLogCustomFood = (food: CustomFood) => {
        const payload = {
            date,
            mealType,
            name: food.name,
            calories: food.calories,
            proteinG: food.proteinG,
            carbG: food.carbG,
            fatG: food.fatG
        };
        // 0ms Optimistic UI: actualiza el store y cierra el modal al instante
        onSaved();
        onClose();
        toast.success(`"${food.name}" registrada`);
        void logMealOptimistic(payload).catch(() => {
            toast.error('No se pudo registrar la comida.');
        });
    };

    const handleSaveMeal = () => {
        if (!foodDetails || !selectedServing) return;

        const payload = {
            date,
            mealType,
            name: foodDetails.name,
            calories: selectedServing.calories * quantity,
            proteinG: selectedServing.protein * quantity,
            carbG: selectedServing.carbohydrates * quantity,
            fatG: selectedServing.fat * quantity
        };

        // 0ms Optimistic UI: actualiza el store y cierra el modal al instante
        onSaved();
        onClose();
        toast.success(`"${foodDetails.name}" registrada`);
        void logMealOptimistic(payload).catch(() => {
            toast.error('No se pudo registrar la comida.');
        });
    };

    const handleConfirmAiMeal = (meal: {
        name: string;
        calories: number;
        proteinG: number;
        carbG: number;
        fatG: number;
        fiberG: number;
        sugarG: number;
        mealType: MealType;
        photoUrl?: string;
    }) => {
        const payload = {
            date,
            mealType: meal.mealType,
            name: meal.name,
            calories: meal.calories,
            proteinG: meal.proteinG,
            carbG: meal.carbG,
            fatG: meal.fatG,
            fiberG: meal.fiberG,
            sugarG: meal.sugarG,
            ...(meal.photoUrl ? { photoUrl: meal.photoUrl } : {}),
        };
        onSaved();
        onClose();
        toast.success(`"${meal.name}" registrada`);
        void logMealOptimistic(payload).catch(() => {
            toast.error('No se pudo registrar la comida.');
        });
    };

    const isCameraFullscreen = step === 'MAIN' && activeTab === 'AI' && aiStage === 'CAMERA';

    const mealTypeSelector = (
        <div className="flex bg-[var(--surface-inset)] p-1 rounded-xl border border-[var(--border-subtle)]">
            {([
                { id: 'breakfast', label: 'Desayuno' },
                { id: 'lunch', label: 'Almuerzo' },
                { id: 'snack', label: 'Snack' },
                { id: 'dinner', label: 'Cena' }
            ] as const).map(type => (
                <button
                    key={type.id}
                    type="button"
                    onClick={() => setMealType(type.id)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${mealType === type.id
                        ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                >
                    {type.label}
                </button>
            ))}
        </div>
    );

    return (
        <div
            className={isCameraFullscreen ? undefined : 'mobile-sheet-root fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4'}
            role="dialog"
            aria-modal="true"
            aria-labelledby={isCameraFullscreen ? undefined : 'meal-modal-title'}
            aria-label={isCameraFullscreen ? 'Cámara para registrar comida' : undefined}
            onClick={(e) => { if (!isCameraFullscreen && e.target === e.currentTarget) onClose(); }}
        >
            <div className={isCameraFullscreen ? undefined : 'mobile-sheet-panel bg-[var(--surface-page)] border border-[var(--border-subtle)] rounded-t-[24px] sm:rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] overflow-hidden'}>

                {/* Header */}
                {!isCameraFullscreen && (
                <div className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 border-b border-[var(--border-subtle)] shrink-0">
                    <div className="flex items-center gap-2">
                        {step !== 'MAIN' && (
                            <button
                                type="button"
                                aria-label="Volver"
                                onClick={() => setStep('MAIN')}
                                className="flex h-8 w-8 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            >
                                <ArrowLeft className="w-4.5 h-4.5" aria-hidden="true" />
                            </button>
                        )}
                        <h2 id="meal-modal-title" className="text-[15px] sm:text-[17px] font-semibold tracking-[-0.01em] text-[var(--text-primary)] flex items-center gap-2">
                            {activeTab === 'SEARCH' && step === 'MAIN' ? (
                                <Search className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
                            ) : activeTab === 'CUSTOM' && step === 'MAIN' ? (
                                <Bookmark className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
                            ) : (
                                <Utensils className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
                            )}
                            {step === 'MAIN'
                                ? (activeTab === 'SEARCH'
                                    ? 'Buscador de Alimentos'
                                    : activeTab === 'CUSTOM'
                                        ? 'Mis Comidas'
                                        : aiStage === 'REVIEW'
                                            ? 'Revisar comida'
                                            : aiStage === 'TEXT_INPUT'
                                                ? 'Describir comida'
                                                : 'Registrar Comida')
                                : step === 'DETAILS'
                                    ? 'Detalles de la Composición'
                                    : 'Crear Plato Personalizado'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        aria-label="Cerrar registro de comida"
                        onClick={onClose}
                        className="flex h-8 w-8 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    >
                        <X className="w-4.5 h-4.5" aria-hidden="true" />
                    </button>
                </div>
                )}

                {/* Body Content */}
                <div className={isCameraFullscreen ? undefined : 'flex-1 overflow-y-auto overscroll-contain px-3.5 py-2.5 sm:px-5 sm:py-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent'}>

                    {step === 'MAIN' && (
                        <div className={isCameraFullscreen ? undefined : (activeTab === 'AI' ? 'space-y-3' : 'space-y-4')}>
                            {activeTab === 'CUSTOM' && mealTypeSelector}

                            {activeTab === 'AI' && (
                                <MealPhotoAnalyzer
                                    mealType={mealType}
                                    onMealTypeChange={setMealType}
                                    onStageChange={setAiStage}
                                    onClose={onClose}
                                    onConfirmMeal={handleConfirmAiMeal}
                                />
                            )}

                            {activeTab === 'SEARCH' && (
                                <div className="space-y-4">
                                    {/* Search Input */}
                                    <form onSubmit={handleSearch} className="relative">
                                        <label htmlFor="food-search-input" className="sr-only">
                                            Buscar alimento
                                        </label>
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                                        </div>
                                        <input
                                            id="food-search-input"
                                            type="text"
                                            value={query}
                                            onChange={(e) => {
                                                setQuery(e.target.value);
                                                if (e.target.value === '') {
                                                    setSearchResults([]);
                                                    setHasSearched(false);
                                                }
                                            }}
                                            className="block w-full pl-10 pr-20 py-3 border border-[var(--border-subtle)] rounded-xl leading-5 bg-[var(--surface-inset)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/30 text-base sm:text-sm transition-colors"
                                            placeholder="Buscar alimento (ej: Manzana, Pollo...)"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!query.trim() || isSearching}
                                            className="absolute inset-y-1.5 right-1.5 px-3 bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] text-[var(--text-primary)] text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                        >
                                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" aria-hidden="true" /> : 'Buscar'}
                                        </button>
                                    </form>

                                    {/* Results List */}
                                    <div className="space-y-2">
                                        {!hasSearched && !isSearching && (
                                            <div className="py-6">
                                                 <p className="text-xs text-[var(--text-muted)] font-semibold mb-3 text-center">
                                                    Sugerencias rápidas para {mealType === 'breakfast' ? 'Desayuno' : mealType === 'lunch' ? 'Almuerzo' : mealType === 'dinner' ? 'Cena' : 'Snack'}
                                                </p>
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    {MEAL_SUGGESTIONS[mealType].map(item => (
                                                        <button
                                                            key={item}
                                                            type="button"
                                                            onClick={() => handleSearch(undefined, item)}
                                                            className="min-h-9 px-3 py-1.5 bg-[var(--surface-inset)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-semibold rounded-lg hover:bg-[var(--surface-raised)] hover:text-[var(--accent-text)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                        >
                                                            {item}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {hasSearched && searchResults.length === 0 && !isSearching && (
                                            <div className="text-center py-10 text-sm text-[var(--text-muted)]">
                                                No se encontraron resultados para &quot;{query}&quot;.
                                            </div>
                                        )}

                                        {searchResults.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleSelectFood(item.id)}
                                                className="w-full min-h-14 flex items-center justify-between p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-inset)] transition-all text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <div className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                                                        {item.name} {item.brand && <span className="text-xs text-[var(--text-muted)] font-normal">({item.brand})</span>}
                                                    </div>
                                                    <div className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">
                                                        {item.description}
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] transition-all" aria-hidden="true" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'CUSTOM' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                         <p className="text-xs text-[var(--text-muted)] font-semibold">Tus recetas frecuentes</p>
                                        <button
                                            type="button"
                                            onClick={() => setStep('CREATE_CUSTOM')}
                                            className="min-h-9 text-xs bg-[var(--surface-inset)] border border-[var(--border-subtle)] text-[var(--accent-text)] font-bold px-3 py-1.5 rounded-lg hover:bg-[var(--surface-raised)] transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                        >
                                            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Nuevo
                                        </button>
                                    </div>

                                    {isLoadingCustom ? (
                                        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" aria-hidden="true" /></div>
                                    ) : customFoods.length === 0 ? (
                                        <div className="text-center py-10 text-sm text-[var(--text-muted)] bg-[var(--surface-inset)] rounded-xl border border-dashed border-[var(--border-subtle)]">
                                            Aún no tienes platillos personalizados creados.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {customFoods.map(food => (
                                                <button
                                                    key={food.id}
                                                    type="button"
                                                    onClick={() => handleLogCustomFood(food)}
                                                    className="w-full min-h-14 flex items-center justify-between p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-inset)] transition-all text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <div className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                                                            {food.name}
                                                        </div>
                                                        <div className="text-xs text-[var(--text-muted)] mt-1 flex flex-wrap gap-2 tabular-nums">
                                                             <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-[var(--accent-text)]" aria-hidden="true" /> {food.calories} kcal</span>
                                                            <span aria-hidden="true">|</span>
                                                            <span>P: {food.proteinG}g</span>
                                                            <span>C: {food.carbG}g</span>
                                                            <span>G: {food.fatG}g</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-[var(--accent-text)] p-2 rounded-lg shrink-0">
                                                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
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
                                <div className="py-20 flex flex-col items-center justify-center text-[var(--text-muted)] space-y-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
                                    <span className="text-sm">Obteniendo macros...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Food Header */}
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold text-[var(--text-primary)]">{foodDetails.name}</h3>
                                        {foodDetails.brand && <p className="text-sm text-[var(--text-muted)]">{foodDetails.brand}</p>}
                                    </div>

                                    {/* Serving Selector */}
                                    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4">
                                        <div>
                                             <label htmlFor="serving-select" className="text-xs font-semibold text-[var(--text-secondary)] mb-2 block">
                                                Tamaño de Porción
                                            </label>
                                            <select
                                                id="serving-select"
                                                className="w-full bg-[var(--surface-inset)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/30 transition-colors"
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
                                             <label htmlFor="quantity-range" className="text-xs font-semibold text-[var(--text-secondary)] mb-2 block">
                                                Cantidad (Multiplicador)
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    id="quantity-range"
                                                    type="range"
                                                    min="0.5"
                                                    max="5"
                                                    step="0.5"
                                                    value={quantity}
                                                    onChange={(e) => setQuantity(parseFloat(e.target.value))}
                                                    className="flex-1 accent-[var(--accent-fill)]"
                                                />
                                                <div className="bg-[var(--surface-inset)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-3 py-1 rounded-md text-sm font-bold min-w-[3rem] text-center tabular-nums">
                                                    {quantity}x
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {mealTypeSelector}

                                    {/* Macros Preview */}
                                    {selectedServing && (
                                        <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl p-5">
                                            <div className="text-center mb-4 tabular-nums">
                                                <span className="text-3xl font-black text-[var(--text-primary)]">{(selectedServing.calories * quantity).toFixed(0)}</span>
                                                 <span className="text-xs text-[var(--text-muted)] ml-1 font-bold">kcal</span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 tabular-nums">
                                                <div className="bg-[var(--surface-inset)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-center">
                                                     <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--chart-protein)' }}>Proteínas</div>
                                                    <div className="font-bold text-[var(--text-primary)]">{(selectedServing.protein * quantity).toFixed(1)}g</div>
                                                </div>
                                                <div className="bg-[var(--surface-inset)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-center">
                                                     <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--chart-carb)' }}>Carbos</div>
                                                    <div className="font-bold text-[var(--text-primary)]">{(selectedServing.carbohydrates * quantity).toFixed(1)}g</div>
                                                </div>
                                                <div className="bg-[var(--surface-inset)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-center">
                                                     <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--chart-fat)' }}>Grasas</div>
                                                    <div className="font-bold text-[var(--text-primary)]">{(selectedServing.fat * quantity).toFixed(1)}g</div>
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
                                    <label htmlFor="custom-dish-name" className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">Nombre del Platillo *</label>
                                    <input
                                        id="custom-dish-name"
                                        required
                                        type="text"
                                        value={newCustomFood.name}
                                        onChange={e => setNewCustomFood({ ...newCustomFood, name: e.target.value })}
                                        className="w-full bg-[var(--surface-inset)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-base sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/30"
                                        placeholder="Ej: Avena Mágica"
                                    />
                                </div>

                                {/* Ingredients Section */}
                                <div className="pt-2 border-t border-[var(--border-subtle)]">
                                    <div className="flex justify-between items-center mb-3">
                                         <p className="text-xs font-semibold text-[var(--text-secondary)]">Ingredientes</p>
                                        {!isSelectingIngredient && (
                                            <button
                                                type="button"
                                                onClick={() => setIsSelectingIngredient(true)}
                                                className="min-h-9 px-2.5 rounded-lg text-[var(--accent-text)] hover:bg-[var(--surface-inset)] text-xs font-bold flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                            >
                                                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Añadir
                                            </button>
                                        )}
                                    </div>

                                    {/* Selected Ingredients List */}
                                    {recipeIngredients.length > 0 ? (
                                        <div className="space-y-2 mb-4">
                                            {recipeIngredients.map((item, index) => (
                                                <div key={`${item.ingredientId}-${index}`} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-[var(--text-primary)] font-semibold truncate">{item.ingredient?.name}</p>
                                                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">{(item.ingredient!.caloriesPer100g * (item.weightGrams / 100)).toFixed(0)} kcal</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                aria-label={`Gramos de ${item.ingredient?.name ?? 'ingrediente'}`}
                                                                value={item.weightGrams}
                                                                onChange={(e) => updateIngredientWeight(index, Number(e.target.value))}
                                                                className="w-18 bg-[var(--surface-inset)] border border-[var(--border-subtle)] rounded-md py-1.5 pl-2 pr-6 text-xs text-right text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                                                            />
                                                            <span className="absolute right-2 top-1.5 text-xs text-[var(--text-muted)] pointer-events-none">g</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            aria-label={`Quitar ${item.ingredient?.name ?? 'ingrediente'}`}
                                                            onClick={() => removeIngredient(index)}
                                                            className="flex h-9 w-9 cursor-pointer items-center justify-center hover:bg-[var(--surface-inset)] rounded-md text-[var(--text-muted)] hover:text-[var(--status-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                        >
                                                            <X className="w-4 h-4" aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center p-3 mt-4 bg-[var(--surface-inset)] border border-[var(--border-subtle)] rounded-xl">
                                                <div>
                                                     <p className="text-[11px] text-[var(--accent-text)] font-bold">Total Estimado</p>
                                                     <p className="text-lg font-black text-[var(--text-primary)] tabular-nums">{currentRecipeMacros.cals.toFixed(0)} <span className="text-xs text-[var(--text-muted)] font-bold">kcal</span></p>
                                                </div>
                                                <div className="flex gap-3 text-xs text-[var(--text-secondary)] tabular-nums">
                                                     <span className="flex flex-col items-center"><span className="font-bold text-[10px]" style={{ color: 'var(--chart-protein)' }}>P</span>{currentRecipeMacros.p.toFixed(1)}g</span>
                                                     <span className="flex flex-col items-center"><span className="font-bold text-[10px]" style={{ color: 'var(--chart-carb)' }}>C</span>{currentRecipeMacros.c.toFixed(1)}g</span>
                                                     <span className="flex flex-col items-center"><span className="font-bold text-[10px]" style={{ color: 'var(--chart-fat)' }}>G</span>{currentRecipeMacros.f.toFixed(1)}g</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        !isSelectingIngredient && (
                                            <div className="text-center py-6 text-sm text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-xl bg-[var(--surface-inset)]">
                                                <Utensils className="w-5 h-5 mx-auto mb-2 text-[var(--text-muted)]" aria-hidden="true" />
                                                Empieza añadiendo ingredientes<br />para calcular los macros.
                                            </div>
                                        )
                                    )}

                                    {/* Ingredient Picker Overlay */}
                                    {isSelectingIngredient && (
                                        <div className="mt-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl p-3 shadow-lg">
                                            <div className="flex justify-between items-center mb-2">
                                                <label htmlFor="ingredient-search-input" className="text-xs text-[var(--text-secondary)] font-bold">Buscar ingrediente base</label>
                                                <button
                                                    type="button"
                                                    aria-label="Cerrar buscador de ingredientes"
                                                    onClick={() => setIsSelectingIngredient(false)}
                                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-inset)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                >
                                                    <X className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    id="ingredient-search-input"
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
                                                    className="w-full bg-[var(--surface-inset)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-base sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] mb-2 focus:border-[var(--focus-ring)] focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    aria-label="Buscar ingrediente"
                                                    onClick={handleIngredientSearch}
                                                    disabled={isSearchingIngredient || !ingredientSearch.trim()}
                                                    className="mb-2 px-3 bg-[var(--surface-inset)] border border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                >
                                                    {isSearchingIngredient ? <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" aria-hidden="true" /> : <Search className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />}
                                                </button>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin">
                                                {isImporting ? (
                                                    <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--accent-text)]" aria-hidden="true" /></div>
                                                ) : (
                                                    <>
                                                        {systemIngredients
                                                            .filter(ing => !ingredientSearch.trim() || ing.name.toLowerCase().includes(ingredientSearch.trim().toLowerCase()))
                                                            .slice(0, 15)
                                                            .map(ing => (
                                                                <button
                                                                    key={ing.id}
                                                                    type="button"
                                                                    onClick={() => addIngredientToRecipe(ing)}
                                                                    className="w-full text-left p-2 hover:bg-[var(--surface-inset)] rounded-lg flex flex-col group overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                                >
                                                                    <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] truncate w-full">{ing.name}</span>
                                                                    <span className="text-xs text-[var(--text-muted)] truncate w-full tabular-nums">{ing.caloriesPer100g} kcal / 100g · P: {ing.proteinPer100g}g · C: {ing.carbPer100g}g · G: {ing.fatPer100g}g</span>
                                                                </button>
                                                            ))}
                                                        {ingredientSearchResults.map(item => (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() => handleSelectIngredientFromSearch(item)}
                                                                className="w-full text-left p-2 hover:bg-[var(--surface-inset)] rounded-lg flex flex-col group overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                            >
                                                                <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] truncate w-full">{item.name} {item.brand && <span className="text-xs text-[var(--text-muted)] font-normal">({item.brand})</span>}</span>
                                                                <span className="text-xs text-[var(--text-muted)] truncate w-full">{item.description}</span>
                                                            </button>
                                                        ))}
                                                    </>
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
                    <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-[var(--border-subtle)] bg-[var(--surface-page)] shrink-0 z-10">
                        <button
                            type="submit"
                            form="create-custom-form"
                            disabled={isSaving || !newCustomFood.name || recipeIngredients.length === 0}
                             className="w-full min-h-12 flex justify-center items-center gap-2 bg-[var(--accent-fill)] text-[var(--on-accent)] font-bold py-3 rounded-xl transition-opacity disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                            {isSaving ? (
                                <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Creando Platillo...</>
                            ) : (
                                <><Utensils className="w-5 h-5" aria-hidden="true" /> Guardar Platillo</>
                            )}
                        </button>
                    </div>
                )}
                {step === 'DETAILS' && foodDetails && selectedServing && !isLoadingDetails && (
                    <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-[var(--border-subtle)] bg-[var(--surface-page)] shrink-0">
                        <button
                            type="button"
                            onClick={handleSaveMeal}
                            disabled={isSaving}
                            className="w-full min-h-12 flex justify-center items-center gap-2 bg-[var(--accent-fill)] text-[var(--on-accent)] font-bold py-3 rounded-xl transition-opacity disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                            {isSaving ? (
                                <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Guardando...</>
                            ) : (
                                <><CheckCircle2 className="w-5 h-5" aria-hidden="true" /> Agregar al Registro</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

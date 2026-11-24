'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Filter,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  CatalogBundle,
  CatalogExercise,
  filterExercises,
  loadExerciseCatalog,
} from '@/lib/api/exerciseCatalog';
import { CustomExerciseRecord, healthService } from '@/lib/api/health';
import {
  BODY_ZONE_CHIPS,
  EQUIPMENT_CHIPS,
  formatMuscleLabel,
} from '@/lib/constants/fitness';
import ExerciseImagePreview from './ExerciseImagePreview';
import ExerciseDetailSheet from './ExerciseDetailSheet';
import CustomExerciseSheet from './CustomExerciseSheet';

interface ExerciseCatalogBrowserProps {
  mode?: 'browse' | 'picker';
  onConfirmSelection?: (exercises: CatalogExercise[]) => void;
  onAddSingle?: (exercise: CatalogExercise) => void;
  hasActiveWorkout?: boolean;
  onClosePicker?: () => void;
  confirmLabel?: (count: number) => string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const PAGE_SIZE = 36;

// Popular foundational exercises surfaced first when browsing without a search query
const POPULAR_EXERCISE_IDS = [
  'Barbell_Bench_Press_-_Medium_Grip',
  'Barbell_Squat',
  'Barbell_Deadlift',
  'Pullups',
  'Pushups',
  'Incline_Dumbbell_Press',
  'Wide-Grip_Lat_Pulldown',
  'Seated_Cable_Rows',
  'Romanian_Deadlift',
  'Leg_Press',
  'Side_Lateral_Raise',
  'Dumbbell_Shoulder_Press',
  'Barbell_Curl',
  'Hammer_Curls',
  'Triceps_Pushdown',
  'Dips_-_Chest_Version',
  'Dumbbell_Lunges',
  'Plank',
  'Face_Pull',
  'Leg_Extensions',
  'Lying_Leg_Curls',
  'Standing_Calf_Raises',
  'Barbell_Hip_Thrust',
  'Hanging_Leg_Raise',
];

const POPULAR_RANK = new Map(POPULAR_EXERCISE_IDS.map((id, idx) => [id, idx]));

function customToCatalogExercise(item: CustomExerciseRecord): CatalogExercise {
  const zoneLabel =
    BODY_ZONE_CHIPS.find((z) => z.key === item.bodyZone)?.label || 'General';
  const equipLabel =
    EQUIPMENT_CHIPS.find((e) => e.key === item.equipment)?.label || item.equipment;
  return {
    id: `custom:${item.id}`,
    name: item.name,
    nameEn: item.name,
    bodyZone: item.bodyZone,
    bodyZoneLabel: zoneLabel,
    primaryMuscle: item.primaryMuscle,
    primaryMuscleLabel: formatMuscleLabel(item.primaryMuscle),
    secondaryMuscles: [],
    equipment: item.equipment,
    equipmentLabel: equipLabel,
    category: item.category,
    categoryLabel: item.category === 'cardio' ? 'Cardio' : 'Fuerza',
    level: 'intermediate',
    levelLabel: 'Propio',
    force: null,
    forceLabel: null,
    mechanic: null,
    mechanicLabel: null,
    metValue: item.metValue,
    images: [],
    instructions: item.notes ? [item.notes] : [],
    isCustom: true,
  };
}

export default function ExerciseCatalogBrowser({
  mode = 'browse',
  onConfirmSelection,
  onAddSingle,
  hasActiveWorkout = false,
  onClosePicker,
  confirmLabel,
  secondaryAction,
}: ExerciseCatalogBrowserProps) {
  const [bundle, setBundle] = useState<CatalogBundle | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExerciseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [bodyZone, setBodyZone] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [showEquipmentFilter, setShowEquipmentFilter] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailExercise, setDetailExercise] = useState<CatalogExercise | null>(null);
  const [isCreateCustomOpen, setIsCreateCustomOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      loadExerciseCatalog(),
      healthService.getCustomExercises().catch(() => ({ exercises: [] })),
    ])
      .then(([catalogBundle, customRes]) => {
        if (cancelled) return;
        setBundle(catalogBundle);
        setCustomExercises(customRes.exercises || []);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('No pudimos cargar el catálogo de ejercicios.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const allExercises = useMemo(() => {
    const customMapped = customExercises.map(customToCatalogExercise);
    const catalogSorted = [...(bundle?.exercises || [])].sort((a, b) => {
      const rankA = POPULAR_RANK.get(a.id);
      const rankB = POPULAR_RANK.get(b.id);
      if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
      if (rankA !== undefined) return -1;
      if (rankB !== undefined) return 1;
      return a.name.localeCompare(b.name, 'es');
    });
    return [...customMapped, ...catalogSorted];
  }, [bundle, customExercises]);

  const filtered = useMemo(() => {
    return filterExercises(allExercises, {
      query,
      bodyZone,
      equipment,
      onlyCustom,
    });
  }, [allExercises, query, bodyZone, equipment, onlyCustom]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, bodyZone, equipment, onlyCustom]);

  const visibleItems = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!onConfirmSelection || selectedIds.size === 0) return;
    const picked = allExercises.filter((ex) => selectedIds.has(ex.id));
    onConfirmSelection(picked);
    setSelectedIds(new Set());
  };

  const handleDeleteCustom = async (customId: string) => {
    const rawId = customId.replace(/^custom:/, '');
    try {
      await healthService.deleteCustomExercise(rawId);
      setCustomExercises((prev) => prev.filter((item) => item.id !== rawId));
      toast.success('Ejercicio propio eliminado');
    } catch {
      toast.error('No se pudo eliminar el ejercicio');
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Search + Quick Actions Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ejercicio o músculo..."
            aria-label="Buscar ejercicios por nombre, músculo o equipamiento"
            className="min-h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 pl-10 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowEquipmentFilter((prev) => !prev)}
          aria-expanded={showEquipmentFilter}
          aria-label="Filtrar por equipamiento"
          className={`flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl border transition-colors active:scale-95 ${
            equipment !== 'all' || showEquipmentFilter
              ? 'border-rose-600 bg-rose-600/15 text-rose-600 dark:text-rose-400'
              : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
          }`}
        >
          <Filter className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsCreateCustomOpen(true)}
          aria-label="Crear ejercicio propio"
          className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 text-xs font-semibold text-white transition-colors hover:border-rose-500/50 hover:bg-zinc-800 active:scale-95"
        >
          <Plus className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span className="hidden sm:inline">Crear propio</span>
        </button>
      </div>

      {/* Horizontal Body Zone Chips */}
      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {BODY_ZONE_CHIPS.map((chip) => {
          const active = !onlyCustom && bodyZone === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                setOnlyCustom(false);
                setBodyZone(chip.key);
              }}
              className={`min-h-9 shrink-0 cursor-pointer rounded-full border px-3.5 text-xs font-semibold transition-colors active:scale-95 ${
                active
                  ? 'border-rose-600 bg-rose-600 text-[#ffffff] shadow-sm shadow-rose-600/25'
                  : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setOnlyCustom((prev) => !prev);
            setBodyZone('all');
          }}
          className={`flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3.5 text-xs font-semibold transition-colors active:scale-95 ${
            onlyCustom
              ? 'border-rose-600 bg-rose-600 text-[#ffffff]'
              : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-zinc-700'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Propios ({customExercises.length})
        </button>
      </div>

      {/* Expandable Equipment Filter Chips */}
      {showEquipmentFilter && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3">
          {EQUIPMENT_CHIPS.map((eq) => (
            <button
              key={eq.key}
              type="button"
              onClick={() => setEquipment(eq.key)}
              className={`min-h-9 cursor-pointer rounded-xl border px-3 text-xs font-medium transition-colors ${
                equipment === eq.key
                  ? 'border-rose-600 bg-rose-600/15 text-rose-600 dark:text-rose-400'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {eq.label}
            </button>
          ))}
        </div>
      )}

      {/* Results counter */}
      <div className="flex items-center justify-between px-1 text-xs text-zinc-400">
        <span className="tabular-nums">
          {loading
            ? 'Cargando catálogo...'
            : `${filtered.length} ${filtered.length === 1 ? 'ejercicio' : 'ejercicios'} · ${
                mode === 'picker' ? 'Toca para seleccionar' : 'Toca uno para ver técnica'
              }`}
        </span>
        {(query || bodyZone !== 'all' || equipment !== 'all' || onlyCustom) && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setBodyZone('all');
              setEquipment('all');
              setOnlyCustom(false);
            }}
            className="cursor-pointer font-semibold text-rose-600 dark:text-rose-400 hover:underline"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Catalog Grid / List — strictly non-nested interactive controls */}
      {loading ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/60"
            />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-400">
          {loadError}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-8 text-center">
          <p className="text-sm font-semibold text-white">No encontramos ejercicios con esos filtros</p>
          <p className="mt-1 text-xs text-zinc-400">
            Prueba buscando en español o inglés, o crea tu propio ejercicio personalizado.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateCustomOpen(true)}
            className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-bold text-[#ffffff] hover:bg-rose-700"
          >
            <Plus className="h-4 w-4" />
            Crear ejercicio propio
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {visibleItems.map((exercise) => {
              const isSelected = selectedIds.has(exercise.id);
              return (
                <article
                  key={exercise.id}
                  className={`flex items-center gap-2 rounded-2xl border p-2 transition-colors ${
                    isSelected
                      ? 'border-rose-600 bg-rose-600/10'
                      : 'border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (mode === 'picker') {
                        toggleSelect(exercise.id);
                      } else {
                        setDetailExercise(exercise);
                      }
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl p-0.5 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <ExerciseImagePreview
                      images={exercise.images}
                      imageBaseUrl={bundle?.imageBaseUrl}
                      alt={exercise.name}
                      className="h-14 w-14 rounded-xl"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {exercise.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                        <span className="rounded-md bg-zinc-800/90 px-1.5 py-0.5 font-medium text-zinc-200">
                          {exercise.primaryMuscleLabel}
                        </span>
                        <span className="truncate">{exercise.equipmentLabel}</span>
                      </div>
                    </div>

                    {mode === 'picker' ? (
                      <span
                        className={`mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isSelected
                            ? 'border-rose-600 bg-rose-600 text-[#ffffff]'
                            : 'border-zinc-700 bg-zinc-950 text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    ) : (
                      <ChevronRight className="mr-1 h-4 w-4 shrink-0 text-zinc-500" />
                    )}
                  </button>

                  {mode === 'browse' && exercise.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustom(exercise.id)}
                      aria-label={`Eliminar ${exercise.name}`}
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          {visibleCount < filtered.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="mx-auto mt-1 min-h-11 w-full max-w-xs cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900 px-5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-800 active:scale-[0.98]"
            >
              Mostrar más ({filtered.length - visibleCount} restantes)
            </button>
          )}
        </>
      )}

      {/* Picker sticky confirmation bar */}
      {mode === 'picker' && (
        <div className="sticky bottom-0 z-10 -mx-1 mt-2 flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur-md">
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="min-h-11 flex-1 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              {secondaryAction.label}
            </button>
          ) : onClosePicker ? (
            <button
              type="button"
              onClick={onClosePicker}
              className="min-h-11 flex-1 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={handleConfirm}
            className="min-h-11 flex-[2] cursor-pointer rounded-xl bg-rose-600 px-4 text-sm font-bold text-[#ffffff] shadow-lg shadow-rose-600/20 transition-transform active:scale-[0.98] hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmLabel
              ? confirmLabel(selectedIds.size)
              : `Añadir ${selectedIds.size > 0 ? `(${selectedIds.size})` : 'ejercicios'}`}
          </button>
        </div>
      )}

      <ExerciseDetailSheet
        exercise={detailExercise}
        imageBaseUrl={bundle?.imageBaseUrl}
        onClose={() => setDetailExercise(null)}
        onAddToActive={onAddSingle}
        hasActiveWorkout={hasActiveWorkout}
      />

      <CustomExerciseSheet
        isOpen={isCreateCustomOpen}
        onClose={() => setIsCreateCustomOpen(false)}
        onCreated={(created) => {
          setCustomExercises((prev) => [created, ...prev]);
        }}
      />
    </div>
  );
}

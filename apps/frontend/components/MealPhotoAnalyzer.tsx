'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowUp,
  Bookmark,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ImagePlus,
  Keyboard,
  Loader2,
  Mic,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { aiService, AiMealItem, blobToBase64 } from '@/lib/api/ai';
import { FatSecretFoodItem, healthService, Ingredient } from '@/lib/api/health';
import {
  captureVideoFrameForAI,
  CompressedAiImage,
  compressImageForAI,
} from '@/lib/utils/image';
import {
  attachBaseDensity,
  computeMealTotals,
  DetectedMealItem,
  formatCaloriesDisplay,
  roundMacro,
  scaleMealItemByGrams,
  updateMealItemNutrient,
} from '@/lib/utils/mealMath';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useHealthStore } from '@/store/useHealthStore';
import { REDUCED_MOTION_TRANSITION, SHEET_ENTER_SPRING } from '@/lib/motion/sheetPhysics';

export type MealTypeOption = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type AnalyzerStage = 'CAMERA' | 'TEXT_INPUT' | 'ANALYZING' | 'SAVED' | 'REVIEW';

const ANALYZING_MESSAGES = [
  'Analizando imagen...',
  'Identificando alimentos...',
  'Revisando base de datos...',
  'Calculando calorías y macros...',
] as const;

const MEAL_TYPE_LABELS: Record<MealTypeOption, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Snack',
  dinner: 'Cena',
};

interface MealPhotoAnalyzerProps {
  mealType: MealTypeOption;
  onMealTypeChange: (mealType: MealTypeOption) => void;
  onStageChange?: (stage: AnalyzerStage) => void;
  onClose?: () => void;
  onOpenCustomMeals?: () => void;
  onConfirmMeal: (meal: {
    name: string;
    calories: number;
    proteinG: number;
    carbG: number;
    fatG: number;
    fiberG: number;
    sugarG: number;
    mealType: MealTypeOption;
    photoUrl?: string;
    existingMealId?: string;
  }) => Promise<string | void> | void;
}

type AddItemTab = 'MANUAL' | 'CATALOG';

interface AutoGrowTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  minHeightPx?: number;
  maxHeightPx?: number;
}

/**
 * Native-feeling auto-expanding textarea:
 * - Always >= 16px on coarse pointers so iOS Safari never zooms the viewport.
 * - Expands smoothly on word wrap and explicit line breaks (\n).
 */
function AutoGrowTextarea({
  value,
  onChange,
  minHeightPx = 32,
  maxHeightPx = 160,
  className = '',
  rows = 1,
  ...rest
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, maxHeightPx);
    el.style.height = `${Math.max(minHeightPx, next)}px`;
    el.style.overflowY = el.scrollHeight > maxHeightPx ? 'auto' : 'hidden';
  }, [maxHeightPx, minHeightPx]);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`resize-none text-base leading-[1.35] ${className}`}
      {...rest}
    />
  );
}

export default function MealPhotoAnalyzer({
  mealType,
  onMealTypeChange,
  onStageChange,
  onClose,
  onOpenCustomMeals,
  onConfirmMeal,
}: MealPhotoAnalyzerProps) {
  const [stage, setStageInternal] = useState<AnalyzerStage>('CAMERA');
  const reduceMotion = useReducedMotion();
  const [cameraStatus, setCameraStatus] = useState<'starting' | 'ready' | 'fallback'>(
    'starting'
  );
  const [flashOn, setFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [capturedImage, setCapturedImage] = useState<CompressedAiImage | null>(null);
  const [textDescription, setTextDescription] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzingStepIdx, setAnalyzingStepIdx] = useState(0);

  // Auto-save confirmation state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMealId, setSavedMealId] = useState<string | null>(null);

  // Review state
  const [dishName, setDishName] = useState('');
  const [items, setItems] = useState<DetectedMealItem[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // AI Correction Bar state
  const [correctionText, setCorrectionText] = useState('');
  const [isApplyingCorrection, setIsApplyingCorrection] = useState(false);

  // Add Manual / Catalog Ingredient state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [addItemTab, setAddItemTab] = useState<AddItemTab>('MANUAL');
  const [manualDraft, setManualDraft] = useState({
    name: '',
    grams: '100',
    calories: '',
    proteinG: '',
    carbG: '',
    fatG: '',
  });
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogGrams, setCatalogGrams] = useState('100');
  const [onlineResults, setOnlineResults] = useState<FatSecretFoodItem[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isImportingOnline, setIsImportingOnline] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voiceTargetRef = useRef<'text' | 'correction'>('text');
  const localItemSeqRef = useRef(0);

  const baseId = useId();
  const { systemIngredients, fetchCatalogIfNeeded } = useHealthStore();
  const recorder = useVoiceRecorder();

  const setStage = useCallback(
    (next: AnalyzerStage) => {
      setStageInternal(next);
      onStageChange?.(next);
    },
    [onStageChange]
  );

  useEffect(() => {
    void fetchCatalogIfNeeded();
  }, [fetchCatalogIfNeeded]);

  const stopCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopCameraStream = useCallback(() => {
    stopCameraTracks();
    setFlashOn(false);
    setFlashSupported(false);
  }, [stopCameraTracks]);

  const handleToggleFlash = useCallback(async () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack || !flashSupported) {
      toast('El flash no está disponible en este dispositivo', { icon: '⚡' });
      return;
    }
    const next = !flashOn;
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setFlashOn(next);
    } catch {
      toast.error('No se pudo activar el flash.');
    }
  }, [flashOn, flashSupported]);

  useEffect(() => {
    if (stage !== 'CAMERA') {
      stopCameraTracks();
      return;
    }

    let cancelled = false;

    async function initCamera() {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        if (!cancelled) setCameraStatus('fallback');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        const caps =
          typeof videoTrack?.getCapabilities === 'function'
            ? (videoTrack.getCapabilities() as MediaTrackCapabilities & { torch?: boolean })
            : undefined;
        setFlashSupported(Boolean(caps?.torch));
        setFlashOn(false);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraStatus('ready');
      } catch {
        if (!cancelled) {
          setCameraStatus('fallback');
        }
      }
    }

    void initCamera();

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [stage, stopCameraStream, stopCameraTracks]);

  const thumbnailUrl = capturedImage?.thumbnailUrl ?? capturedImage?.previewUrl ?? null;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopCameraStream();
    };
  }, [stopCameraStream]);

  useEffect(() => {
    if (stage !== 'ANALYZING') {
      setAnalyzingStepIdx(0);
      return;
    }
    const interval = window.setInterval(() => {
      setAnalyzingStepIdx((prev) => (prev + 1) % ANALYZING_MESSAGES.length);
    }, 1600);
    return () => window.clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'SAVED' || saveStatus !== 'saved' || !onClose) return;
    const delayMs = reduceMotion ? 450 : 1100;
    const timer = window.setTimeout(() => {
      onClose();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [stage, saveStatus, onClose, reduceMotion]);

  const totals = useMemo(() => computeMealTotals(items, 1), [items]);

  const persistMeal = useCallback(
    async (payload: {
      name: string;
      calories: number;
      proteinG: number;
      carbG: number;
      fatG: number;
      fiberG: number;
      sugarG: number;
      mealType: MealTypeOption;
      photoUrl?: string;
      existingMealId?: string;
    }) => {
      setSaveStatus('saving');
      setSaveError(null);
      try {
        const resultId = await onConfirmMeal(payload);
        if (typeof resultId === 'string' && resultId) {
          setSavedMealId(resultId);
        }
        setSaveStatus('saved');
      } catch (err: any) {
        setSaveStatus('error');
        setSaveError(err?.message || 'No se pudo guardar la comida. Intentá de nuevo.');
      }
    },
    [onConfirmMeal]
  );

  const runAnalysis = useCallback(
    async (params: {
      image?: CompressedAiImage | null;
      description?: string;
      returnStageOnFail: 'CAMERA' | 'TEXT_INPUT';
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setAnalysisError(null);
      setSaveStatus('idle');
      setSaveError(null);
      setSavedMealId(null);
      setStage('ANALYZING');

      try {
        const response = await aiService.analyzeMeal(
          {
            imageBase64: params.image?.base64,
            imageMimeType: params.image?.mimeType,
            textDescription: params.description?.trim() || undefined,
            mealTypeHint: mealType,
          },
          controller.signal
        );

        if (!response.isFood || response.items.length === 0) {
          const msg =
            response.rejectionReason ||
            'No pudimos detectar comida clara. Probá otra foto o describila con el teclado.';
          setAnalysisError(msg);
          setStage(params.returnStageOnFail);
          return;
        }

        const detectedItems = response.items.map(attachBaseDensity);
        const resolvedName =
          response.dishName.replace(/\s+/g, ' ').trim() ||
          detectedItems
            .map((i) => i.name)
            .slice(0, 2)
            .join(' con ') ||
          'Comida';

        setDishName(resolvedName);
        setItems(detectedItems);
        setExpandedItemId(null);
        setIsAddingItem(false);
        if (response.suggestedMealType) {
          onMealTypeChange(response.suggestedMealType);
        }

        setStage('SAVED');
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        const message =
          err?.message || 'No pudimos analizar tu comida. Intentá de nuevo.';
        setAnalysisError(message);
        setStage(params.returnStageOnFail);
      }
    },
    [mealType, onMealTypeChange, setStage]
  );

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      input.value = '';
      return;
    }

    try {
      setAnalysisError(null);
      const compressed = await compressImageForAI(file);
      setCapturedImage(compressed);
      await runAnalysis({
        image: compressed,
        returnStageOnFail: 'CAMERA',
      });
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo procesar la foto.');
    } finally {
      input.value = '';
    }
  };

  const handleShutterPress = () => {
    if (cameraStatus === 'ready' && videoRef.current && videoRef.current.videoWidth > 0) {
      try {
        const frame = captureVideoFrameForAI(videoRef.current);
        setCapturedImage(frame);
        void runAnalysis({
          image: frame,
          returnStageOnFail: 'CAMERA',
        });
        return;
      } catch {
        // Fallback to native file input
      }
    }
    cameraInputRef.current?.click();
  };

  const handleTextAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textDescription.trim()) {
      toast.error('Escribí qué comiste o tomaste.');
      return;
    }
    setCapturedImage(null);
    void runAnalysis({
      description: textDescription,
      returnStageOnFail: 'TEXT_INPUT',
    });
  };

  const handleApplyAiCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = correctionText.trim();
    if (!prompt || isApplyingCorrection) return;

    setIsApplyingCorrection(true);
    try {
      const currentItemsPayload: AiMealItem[] = items.map((item) => ({
        id: item.id,
        name: item.name,
        estimatedGrams: item.estimatedGrams,
        calories: item.calories,
        proteinG: item.proteinG,
        carbG: item.carbG,
        fatG: item.fatG,
        fiberG: item.fiberG ?? 0,
        sugarG: item.sugarG ?? 0,
      }));

      const updated = await aiService.analyzeMeal({
        imageBase64: capturedImage?.base64,
        imageMimeType: capturedImage?.mimeType,
        correctionPrompt: prompt,
        currentDishName: dishName,
        currentItems: currentItemsPayload,
        mealTypeHint: mealType,
      });

      if (!updated.isFood || updated.items.length === 0) {
        toast.error(updated.rejectionReason || 'No pudimos aplicar ese ajuste.');
        return;
      }

      setDishName(updated.dishName || dishName);
      setItems(updated.items.map(attachBaseDensity));
      setCorrectionText('');
      toast.success('Actualizado');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo recalcular con IA.');
    } finally {
      setIsApplyingCorrection(false);
    }
  };

  const handleToggleVoice = async (target: 'text' | 'correction') => {
    if (recorder.status === 'recording') {
      const res = await recorder.stopRecording();
      if (res.kind !== 'success') return;
      recorder.setTranscribing(true);
      try {
        const audioBase64 = await blobToBase64(res.blob);
        const tr = await aiService.transcribeAudio({
          audioBase64,
          mimeType: res.mimeType,
        });
        if (tr.hasSpeech && tr.transcript.trim()) {
          if (voiceTargetRef.current === 'text') {
            setTextDescription((prev) =>
              prev.trim() ? `${prev.trim()}\n${tr.transcript.trim()}` : tr.transcript.trim()
            );
          } else {
            setCorrectionText((prev) =>
              prev.trim() ? `${prev.trim()} ${tr.transcript.trim()}` : tr.transcript.trim()
            );
          }
        } else {
          toast('No se escuchó voz clara.');
        }
      } catch {
        toast.error('No pudimos transcribir el audio.');
      } finally {
        recorder.setTranscribing(false);
      }
      return;
    }

    voiceTargetRef.current = target;
    await recorder.startRecording();
  };

  const handleItemGramsChange = (id: string, rawValue: string) => {
    const cleaned = rawValue === '' ? 0 : Number(rawValue);
    if (!Number.isFinite(cleaned)) return;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? scaleMealItemByGrams(item, cleaned) : item))
    );
  };

  const handleItemFieldChange = (
    id: string,
    field: 'name' | 'calories' | 'proteinG' | 'carbG' | 'fatG' | 'fiberG' | 'sugarG',
    rawValue: string
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'name') {
          return { ...item, name: rawValue.slice(0, 120) };
        }
        return updateMealItemNutrient(item, field, Number(rawValue) || 0);
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (expandedItemId === id) setExpandedItemId(null);
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = manualDraft.name.trim();
    const calories = Math.max(0, Number(manualDraft.calories) || 0);
    if (!cleanName) {
      toast.error('Escribí el nombre del alimento.');
      return;
    }

    localItemSeqRef.current += 1;
    const newItem = attachBaseDensity({
      id: `manual-${localItemSeqRef.current}`,
      name: cleanName.slice(0, 120),
      estimatedGrams: Math.max(0, Number(manualDraft.grams) || 0),
      calories,
      proteinG: Math.max(0, Number(manualDraft.proteinG) || 0),
      carbG: Math.max(0, Number(manualDraft.carbG) || 0),
      fatG: Math.max(0, Number(manualDraft.fatG) || 0),
      fiberG: 0,
      sugarG: 0,
    });

    setItems((prev) => [...prev, newItem]);
    setManualDraft({
      name: '',
      grams: '100',
      calories: '',
      proteinG: '',
      carbG: '',
      fatG: '',
    });
    setIsAddingItem(false);
  };

  const handleAddCatalogIngredient = (ing: Ingredient) => {
    const grams = Math.max(1, Math.min(3000, Number(catalogGrams) || 100));
    const mult = grams / 100;
    localItemSeqRef.current += 1;
    const newItem = attachBaseDensity({
      id: `ing-${ing.id}-${localItemSeqRef.current}`,
      name: ing.name,
      estimatedGrams: grams,
      calories: ing.caloriesPer100g * mult,
      proteinG: ing.proteinPer100g * mult,
      carbG: ing.carbPer100g * mult,
      fatG: ing.fatPer100g * mult,
      fiberG: 0,
      sugarG: 0,
    });
    setItems((prev) => [...prev, newItem]);
    setCatalogQuery('');
    setOnlineResults([]);
    setIsAddingItem(false);
  };

  const handleSearchOnlineIngredient = async () => {
    if (!catalogQuery.trim()) return;
    setIsSearchingOnline(true);
    try {
      const res = await healthService.searchFood(catalogQuery.trim());
      setOnlineResults(res.results || []);
    } catch {
      toast.error('No se pudo buscar online.');
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleImportOnlineIngredient = async (food: FatSecretFoodItem) => {
    setIsImportingOnline(true);
    try {
      const ing = await healthService.importFatSecretFood(food.id);
      handleAddCatalogIngredient(ing);
    } catch {
      toast.error('No se pudo importar el alimento.');
    } finally {
      setIsImportingOnline(false);
    }
  };

  const handleResetToCamera = () => {
    abortRef.current?.abort();
    setAnalysisError(null);
    setCapturedImage(null);
    setSaveStatus('idle');
    setSaveError(null);
    setSavedMealId(null);
    setStage('CAMERA');
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error('Agregá al menos un alimento.');
      return;
    }
    const finalName =
      dishName.replace(/\s+/g, ' ').trim() ||
      items
        .map((i) => i.name)
        .slice(0, 2)
        .join(' con ') ||
      'Comida';

    setStage('SAVED');
    await persistMeal({
      name: finalName,
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbG: totals.carbG,
      fatG: totals.fatG,
      fiberG: totals.fiberG,
      sugarG: totals.sugarG,
      mealType,
      ...(thumbnailUrl || capturedImage?.previewUrl
        ? { photoUrl: thumbnailUrl ?? capturedImage?.previewUrl }
        : {}),
      ...(savedMealId ? { existingMealId: savedMealId } : {}),
    });
  };

  const filteredLocalIngredients = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return systemIngredients
      .filter((ing) => !q || ing.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [systemIngredients, catalogQuery]);

  const isRecordingVoice = recorder.status === 'recording';
  const isTranscribingVoice = recorder.status === 'transcribing';

  return (
    <div className="space-y-3">
      {/* Hidden native inputs triggered by visible accessible controls */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilePicked}
        aria-label="Tomar foto de comida"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFilePicked}
        aria-label="Seleccionar foto de comida de la galería"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />

      {analysisError && stage !== 'CAMERA' ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-[13px] text-[var(--status-danger)]"
        >
          <span className="min-w-0 leading-snug [overflow-wrap:anywhere]">
            {analysisError}
          </span>
          <button
            type="button"
            onClick={() => setAnalysisError(null)}
            aria-label="Cerrar aviso"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* STAGE 1: FULL-SCREEN BITEPAL CAMERA VIEWFINDER */}
      {stage === 'CAMERA' ? (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#18181b] text-white select-none">
          {/* Live Camera Viewport with rounded bottom corners */}
          <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-b-[26px] bg-black">
            {/* Full-screen live camera feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
                cameraStatus === 'ready' ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Top & bottom gradient scrims for crisp contrast */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 via-black/25 to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
              aria-hidden="true"
            />

            {/* Top Bar: Close + Flash */}
            <div className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar cámara"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-transform duration-100 active:scale-95"
              >
                <X className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => void handleToggleFlash()}
                aria-label={flashOn ? 'Desactivar flash' : 'Activar flash'}
                aria-pressed={flashOn}
                className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full backdrop-blur-md transition-all duration-100 active:scale-95 ${
                  flashOn
                    ? 'bg-amber-400 text-black shadow-lg'
                    : 'bg-black/40 text-white'
                } ${!flashSupported && cameraStatus === 'ready' ? 'opacity-65' : ''}`}
              >
                {flashOn ? (
                  <Zap className="h-5 w-5 fill-current" aria-hidden="true" />
                ) : (
                  <ZapOff className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Instruction Pill + Center Focus Frame (BitePal corner brackets) */}
            <div className="pointer-events-none relative z-10 flex flex-1 flex-col items-center justify-center px-6">
              <div className="mb-6 max-w-[310px] rounded-2xl bg-black/45 px-4 py-2.5 text-center backdrop-blur-md">
                <p className="text-[13.5px] font-medium leading-snug text-white">
                  Escanea una comida o una etiqueta nutricional
                </p>
              </div>

              <div className="relative h-64 w-64 sm:h-72 sm:w-72">
                <span className="absolute left-0 top-0 h-11 w-11 rounded-tl-[26px] border-l-[4.5px] border-t-[4.5px] border-[#ffffff] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" />
                <span className="absolute right-0 top-0 h-11 w-11 rounded-tr-[26px] border-r-[4.5px] border-t-[4.5px] border-[#ffffff] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" />
                <span className="absolute bottom-0 left-0 h-11 w-11 rounded-bl-[26px] border-b-[4.5px] border-l-[4.5px] border-[#ffffff] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" />
                <span className="absolute bottom-0 right-0 h-11 w-11 rounded-br-[26px] border-b-[4.5px] border-r-[4.5px] border-[#ffffff] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" />

                {cameraStatus !== 'ready' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                    <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-md">
                      <Camera className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                    </div>
                    <p className="text-[15px] font-semibold text-white">
                      {cameraStatus === 'starting'
                        ? 'Iniciando cámara...'
                        : 'Sacá o subí una foto'}
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-white/75">
                      Tocá el botón central o usá Galería / Teclado.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Floating Error + "Mis comidas" Pill */}
            <div className="relative z-10 flex flex-col items-center gap-3 px-4 pb-5">
              {analysisError ? (
                <div
                  role="alert"
                  className="mx-auto flex w-full max-w-sm items-start justify-between gap-2.5 rounded-2xl border border-red-400/30 bg-black/75 px-3.5 py-2.5 text-[13px] text-red-300 backdrop-blur-md"
                >
                  <span className="min-w-0 leading-snug [overflow-wrap:anywhere]">
                    {analysisError}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnalysisError(null)}
                    aria-label="Cerrar aviso"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 active:scale-95"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              {onOpenCustomMeals ? (
                <button
                  type="button"
                  onClick={onOpenCustomMeals}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/45 px-5 py-2.5 text-[14px] font-semibold text-white backdrop-blur-md transition-transform duration-100 active:scale-95"
                >
                  <Bookmark className="h-4 w-4 fill-current" aria-hidden="true" />
                  Mis comidas
                </button>
              ) : null}
            </div>
          </div>

          {/* Dedicated Dark Bottom Camera Dock: Galería | Shutter | Teclado */}
          <div className="relative z-10 bg-[#18181b] px-8 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto grid max-w-sm grid-cols-3 items-center gap-4">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  aria-label="Seleccionar foto de la galería"
                  className="flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/12 text-white transition-transform duration-100 active:scale-95"
                >
                  {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleShutterPress}
                  aria-label="Sacar foto y calcular calorías"
                  className="flex h-[76px] w-[76px] cursor-pointer items-center justify-center rounded-full border-[3.5px] border-[#ffffff] bg-transparent p-[4px] shadow-xl transition-transform duration-100 active:scale-90"
                >
                  <span className="h-full w-full rounded-full bg-[#ffffff]" />
                </button>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setAnalysisError(null);
                    setStage('TEXT_INPUT');
                  }}
                  aria-label="Describir comida con teclado"
                  className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white transition-transform duration-100 active:scale-95"
                >
                  <Keyboard className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* STAGE 2: CLEAN AUTO-GROWING KEYBOARD MODE */}
      {stage === 'TEXT_INPUT' ? (
        <form onSubmit={handleTextAnalyze} className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-[var(--text-muted)]">
              Contá con tus palabras qué comiste o tomaste.
            </p>
            <button
              type="button"
              onClick={() => setStage('CAMERA')}
              className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-xs font-semibold text-[var(--text-primary)] active:scale-[0.97]"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              Cámara
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3 focus-within:border-[var(--focus-ring)]">
            <label htmlFor={`${baseId}-text-desc`} className="sr-only">
              Descripción de la comida
            </label>
            <AutoGrowTextarea
              id={`${baseId}-text-desc`}
              rows={3}
              maxHeightPx={220}
              maxLength={1200}
              autoFocus
              enterKeyHint="done"
              value={textDescription}
              onChange={setTextDescription}
              placeholder="Ej: 2 huevos revueltos, media palta y 1 tostada integral con café..."
              className="w-full bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => void handleToggleVoice('text')}
                disabled={isTranscribingVoice}
                aria-label={isRecordingVoice ? 'Detener dictado' : 'Dictar comida por voz'}
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-transform duration-100 active:scale-95 ${
                  isRecordingVoice
                    ? 'bg-[var(--accent-fill)] text-[var(--on-accent)] animate-pulse'
                    : 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                }`}
              >
                {isTranscribingVoice ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecordingVoice ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!textDescription.trim() || isRecordingVoice || isTranscribingVoice}
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill)] px-4 text-[15px] font-semibold text-[var(--on-accent)] transition-transform duration-100 active:scale-[0.98] disabled:opacity-45"
          >
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            Calcular calorías con IA
          </button>
        </form>
      ) : null}

      {/* STAGE 3: FULL-SCREEN GOLDEN HALFTONE SCANNER ANALYZING STATE */}
      {stage === 'ANALYZING' ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end overflow-hidden bg-black text-white select-none"
          role="status"
          aria-live="polite"
        >
          {/* Full-screen captured photo or rich dark ambient backdrop */}
          {capturedImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage.previewUrl}
                alt="Comida en análisis"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/55"
                aria-hidden="true"
              />
            </>
          ) : (
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(250,204,21,0.18),rgba(24,24,27,0.98)_70%)]"
              aria-hidden="true"
            />
          )}

          {/* Animated Golden Scanner Bar + Halftone Dot-Matrix Trail */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-24 overflow-hidden" aria-hidden="true">
            {reduceMotion ? (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                <div
                  className="h-32 w-full"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, rgba(253, 224, 71, 0.58) 2.5px, transparent 3px), linear-gradient(to top, rgba(250, 204, 21, 0.45), rgba(250, 204, 21, 0.14) 55%, transparent)',
                    backgroundSize: '14px 14px, 100% 100%',
                    WebkitMaskImage:
                      'linear-gradient(to top, black 0%, rgba(0,0,0,0.72) 48%, transparent 100%)',
                    maskImage:
                      'linear-gradient(to top, black 0%, rgba(0,0,0,0.72) 48%, transparent 100%)',
                  }}
                />
                <div className="h-[4px] w-full bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 shadow-[0_0_24px_6px_rgba(250,204,21,0.75)]" />
              </div>
            ) : (
              <motion.div
                className="absolute inset-x-0 top-0"
                initial={{ y: '8vh' }}
                animate={{ y: ['8vh', '62vh', '8vh'] }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: [0.45, 0.05, 0.55, 0.95],
                }}
              >
                {/* Halftone dot-matrix glow trail */}
                <div
                  className="h-36 w-full"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, rgba(253, 224, 71, 0.62) 2.5px, transparent 3px), linear-gradient(to top, rgba(250, 204, 21, 0.52), rgba(250, 204, 21, 0.16) 55%, transparent)',
                    backgroundSize: '14px 14px, 100% 100%',
                    WebkitMaskImage:
                      'linear-gradient(to top, black 0%, rgba(0,0,0,0.75) 50%, transparent 100%)',
                    maskImage:
                      'linear-gradient(to top, black 0%, rgba(0,0,0,0.75) 50%, transparent 100%)',
                  }}
                />
                {/* Bright golden laser edge */}
                <div className="h-[4px] w-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 shadow-[0_0_26px_6px_rgba(250,204,21,0.8)]" />
              </motion.div>
            )}
          </div>

          {/* Bottom Rounded Status Sheet */}
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING}
            className="relative z-20 rounded-t-[28px] border-t border-[var(--border-subtle)] bg-[var(--surface-card)] px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[var(--text-primary)] shadow-[0_-12px_40px_rgba(0,0,0,0.38)]"
          >
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-500 dark:bg-violet-400/15 dark:text-violet-300"
                  aria-hidden="true"
                >
                  <Sparkles
                    className={`h-5 w-5 ${reduceMotion ? '' : 'animate-pulse'}`}
                    strokeWidth={2.2}
                  />
                </span>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={ANALYZING_MESSAGES[analyzingStepIdx]}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      className="truncate text-[17px] font-bold tracking-[-0.015em] text-[var(--text-primary)]"
                    >
                      {ANALYZING_MESSAGES[analyzingStepIdx]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetToCamera}
                aria-label="Cancelar análisis"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-primary)] transition-transform duration-100 active:scale-95"
              >
                <X className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* STAGE 4: FULL-SCREEN EXPLICIT SAVED CONFIRMATION (USER CLOSES WITH X) */}
      {stage === 'SAVED' ? (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[var(--surface-page)] text-[var(--text-primary)]">
          {/* Top Photo Hero (if photo was taken) */}
          {capturedImage ? (
            <div className="relative h-[32dvh] min-h-[190px] max-h-[290px] w-full shrink-0 overflow-hidden bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage.previewUrl}
                alt={dishName || 'Comida guardada'}
                className="h-full w-full object-cover"
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/65 via-black/25 to-transparent"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent"
                aria-hidden="true"
              />

              {/* Floating X Close Button */}
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar resumen de comida guardada"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-transform duration-100 active:scale-95"
                >
                  <X className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
              <span className="text-[15px] font-semibold text-[var(--text-primary)]">
                Resumen del registro
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar resumen de comida guardada"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-primary)] transition-transform duration-100 active:scale-95"
              >
                <X className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Rounded-top Scrollable Saved Details Sheet */}
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING}
            className={`relative z-10 flex flex-1 flex-col overflow-hidden bg-[var(--surface-page)] ${
              capturedImage ? '-mt-6 rounded-t-[28px] shadow-[0_-10px_30px_rgba(0,0,0,0.22)]' : ''
            }`}
          >
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-4">
              <div className="mx-auto max-w-lg space-y-4">
                {/* Explicit Status Pill + Meal Type Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {saveStatus === 'error' ? (
                    <div
                      role="alert"
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-[var(--status-danger)]"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Error al guardar
                    </div>
                  ) : saveStatus === 'saving' ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Guardando en tu registro...
                    </div>
                  ) : saveStatus === 'saved' ? (
                    <motion.div
                      key="saved-pill"
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={
                        reduceMotion
                          ? REDUCED_MOTION_TRANSITION
                          : { type: 'spring', stiffness: 420, damping: 24 }
                      }
                      role="status"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--status-success)]/45 bg-[var(--surface-card)] px-3 py-1 text-xs font-semibold text-[var(--status-success)] shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Comida guardada en tu registro
                    </motion.div>
                  ) : (
                    <div
                      role="status"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" aria-hidden="true" />
                      Análisis listo
                    </div>
                  )}

                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {MEAL_TYPE_LABELS[mealType]}
                  </span>
                </div>

                {/* Save Error Retry Banner (if network failed) */}
                {saveStatus === 'error' && saveError ? (
                  <div
                    role="alert"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-[var(--status-danger)]"
                  >
                    <span className="min-w-0 leading-snug">{saveError}</span>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      className="shrink-0 cursor-pointer rounded-xl bg-[var(--accent-fill)] px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)] active:scale-95"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : null}

                {/* Dish Title */}
                <div>
                  <h2 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
                    {dishName || 'Comida registrada'}
                  </h2>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                    {items.length} {items.length === 1 ? 'alimento detectado' : 'alimentos detectados'}
                  </p>
                </div>

                {/* Explicit Calories & Macros Summary Card */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 tabular-nums">
                  <div className="flex items-baseline justify-between gap-2 border-b border-[var(--divider)] pb-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                      {saveStatus === 'saved' ? 'Total guardado' : 'Total estimado'}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[28px] font-extrabold leading-none tracking-[-0.03em] text-[var(--text-primary)]">
                        {totals.calories}
                      </span>
                      <span className="text-[13px] font-semibold text-[var(--text-muted)]">
                        kcal
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-[var(--surface-inset)] px-3 py-2.5 text-center">
                      <span className="block text-[11px] font-semibold text-[var(--chart-protein)]">
                        Proteínas
                      </span>
                      <span className="mt-0.5 block text-[16px] font-bold text-[var(--text-primary)]">
                        {totals.proteinG}g
                      </span>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-inset)] px-3 py-2.5 text-center">
                      <span className="block text-[11px] font-semibold text-[var(--chart-carb)]">
                        Carbos
                      </span>
                      <span className="mt-0.5 block text-[16px] font-bold text-[var(--text-primary)]">
                        {totals.carbG}g
                      </span>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-inset)] px-3 py-2.5 text-center">
                      <span className="block text-[11px] font-semibold text-[var(--chart-fat)]">
                        Grasas
                      </span>
                      <span className="mt-0.5 block text-[16px] font-bold text-[var(--text-primary)]">
                        {totals.fatG}g
                      </span>
                    </div>
                  </div>

                  {totals.fiberG > 0 || totals.sugarG > 0 ? (
                    <div className="mt-2.5 flex items-center justify-end gap-3 border-t border-[var(--divider)] pt-2 text-[12px] text-[var(--text-muted)]">
                      {totals.fiberG > 0 ? <span>Fibra {totals.fiberG}g</span> : null}
                      {totals.sugarG > 0 ? <span>Azúcares {totals.sugarG}g</span> : null}
                    </div>
                  ) : null}
                </div>

                {/* Explicit Ingredients Breakdown */}
                <div>
                  <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    {saveStatus === 'saved' ? 'Detalle guardado' : 'Detalle detectado'}
                  </h3>
                  <div className="divide-y divide-[var(--divider)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
                            {item.name}
                          </p>
                          <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)] tabular-nums">
                            {Math.round(item.estimatedGrams)}g · P {roundMacro(item.proteinG)}g · C{' '}
                            {roundMacro(item.carbG)}g · G {roundMacro(item.fatG)}g
                          </p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-[13.5px] font-bold text-[var(--text-primary)] tabular-nums">
                          {formatCaloriesDisplay(item.calories)} kcal
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions: Editar datos | Guardar (user closes with X whenever ready) */}
            <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-page)] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto grid max-w-lg grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStage('REVIEW')}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-[13.5px] font-semibold text-[var(--text-primary)] transition-transform duration-100 active:scale-[0.98] disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Editar datos
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved' || items.length === 0}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[13.5px] font-semibold transition-transform duration-100 ${
                    saveStatus === 'saved'
                      ? 'cursor-default border border-[var(--status-success)]/35 bg-[var(--surface-card)] text-[var(--status-success)]'
                      : 'cursor-pointer bg-[var(--accent-fill)] text-[var(--on-accent)] active:scale-[0.98] disabled:opacity-50'
                  }`}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Guardando...
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Guardado
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* STAGE 5: COMPACT MOBILE-FIRST REVIEW — ZERO BLOAT, DIRECT MANUAL EDITING */}
      {stage === 'REVIEW' ? (
          <motion.div
            key="meal-review"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduceMotion ? REDUCED_MOTION_TRANSITION : SHEET_ENTER_SPRING}
            className="space-y-2.5 pb-1"
          >
            {/* 1. Compact Header: Thumbnail + Auto-growing Title + Icon-only Retake */}
            <div className="flex items-center gap-2.5">
              {capturedImage ? (
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnailUrl ?? capturedImage.previewUrl}
                    alt={dishName || 'Plato'}
                    className="block h-full w-full object-cover object-center"
                  />
                </div>
              ) : null}

              <div className="min-w-0 flex-1">
                <label htmlFor={`${baseId}-dish-name`} className="sr-only">
                  Nombre del plato
                </label>
                <AutoGrowTextarea
                  id={`${baseId}-dish-name`}
                  rows={1}
                  minHeightPx={30}
                  maxHeightPx={76}
                  maxLength={120}
                  value={dishName}
                  onChange={setDishName}
                  placeholder="Nombre del plato"
                  className="w-full rounded-lg bg-transparent px-1 py-0.5 text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)] focus:bg-[var(--surface-inset)] focus:px-2 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleResetToCamera}
                aria-label="Repetir"
                title="Repetir"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* 2. Compact KPI + Macro Row */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3.5 py-2.5 tabular-nums">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-[22px] font-bold leading-none tracking-[-0.03em] text-[var(--text-primary)]">
                    {totals.calories}
                  </span>
                  <span className="text-[12px] font-medium text-[var(--text-muted)]">
                    kcal
                  </span>
                </div>

                <div className="flex items-center gap-2.5 text-[12px]">
                  <div className="text-right leading-tight">
                    <span className="block text-[10px] font-medium text-[var(--chart-protein)]">
                      Prot
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {totals.proteinG}g
                    </span>
                  </div>
                  <div className="h-5 w-px bg-[var(--divider)]" aria-hidden="true" />
                  <div className="text-right leading-tight">
                    <span className="block text-[10px] font-medium text-[var(--chart-carb)]">
                      Carbs
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {totals.carbG}g
                    </span>
                  </div>
                  <div className="h-5 w-px bg-[var(--divider)]" aria-hidden="true" />
                  <div className="text-right leading-tight">
                    <span className="block text-[10px] font-medium text-[var(--chart-fat)]">
                      Grasas
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {totals.fatG}g
                    </span>
                  </div>
                </div>
              </div>

              {totals.fiberG > 0 || totals.sugarG > 0 ? (
                <div className="mt-1.5 flex items-center justify-end gap-2.5 border-t border-[var(--divider)] pt-1 text-[11px] text-[var(--text-muted)]">
                  {totals.fiberG > 0 ? <span>Fibra {totals.fiberG}g</span> : null}
                  {totals.sugarG > 0 ? <span>Azúcares {totals.sugarG}g</span> : null}
                </div>
              ) : null}
            </div>

            {/* 3. Compact Grouped List of Ingredients */}
            <div>
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Ingredientes ({items.length})
                </span>
              </div>

              <div className="divide-y divide-[var(--divider)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                {items.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  return (
                    <div key={item.id} className="px-3 py-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedItemId(isExpanded ? null : item.id)
                          }
                          className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-medium leading-tight text-[var(--text-primary)]">
                              {item.name}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)] tabular-nums">
                              {Math.round(item.estimatedGrams)}g · P {roundMacro(item.proteinG)} · C{' '}
                              {roundMacro(item.carbG)} · G {roundMacro(item.fatG)}
                              {(item.fiberG ?? 0) >= 0.5
                                ? ` · F ${roundMacro(item.fiberG ?? 0)}`
                                : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="whitespace-nowrap text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">
                              {formatCaloriesDisplay(item.calories)} kcal
                            </span>
                            <ChevronRight
                              className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-150 ${
                                isExpanded ? 'rotate-90' : ''
                              }`}
                              aria-hidden="true"
                            />
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Eliminar ${item.name}`}
                          className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] active:scale-95 hover:text-[var(--status-danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Clean Manual Editor inside the row */}
                      {isExpanded ? (
                        <div className="mt-2 space-y-2 border-t border-[var(--divider)] pt-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                              Alimento
                            </label>
                            <AutoGrowTextarea
                              rows={1}
                              maxHeightPx={90}
                              maxLength={120}
                              value={item.name}
                              onChange={(val) =>
                                handleItemFieldChange(item.id, 'name', val)
                              }
                              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                                Cantidad (g)
                              </label>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max="5000"
                                value={Math.round(item.estimatedGrams)}
                                onChange={(e) =>
                                  handleItemGramsChange(item.id, e.target.value)
                                }
                                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                                Calorías (kcal)
                              </label>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max="10000"
                                value={formatCaloriesDisplay(item.calories)}
                                onChange={(e) =>
                                  handleItemFieldChange(
                                    item.id,
                                    'calories',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                                Prot (g)
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.1"
                                value={roundMacro(item.proteinG)}
                                onChange={(e) =>
                                  handleItemFieldChange(
                                    item.id,
                                    'proteinG',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                                Carbs (g)
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.1"
                                value={roundMacro(item.carbG)}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'carbG', e.target.value)
                                }
                                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                                Grasas (g)
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.1"
                                value={roundMacro(item.fatG)}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'fatG', e.target.value)
                                }
                                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                                Fibra (g)
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.1"
                                value={roundMacro(item.fiberG ?? 0)}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'fiberG', e.target.value)
                                }
                                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
                                Azúcares (g)
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.1"
                                value={roundMacro(item.sugarG ?? 0)}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'sugarG', e.target.value)
                                }
                                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {/* Last Grouped Row: Add Ingredient inline */}
                {!isAddingItem ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingItem(true)}
                    className="flex min-h-9 w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left text-[13px] font-medium text-[var(--accent-text)] active:bg-[var(--surface-inset)]"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Agregar ingrediente
                  </button>
                ) : (
                  <div className="space-y-2 bg-[var(--surface-inset)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1 rounded-lg bg-[var(--surface-raised)] p-0.5">
                        <button
                          type="button"
                          onClick={() => setAddItemTab('MANUAL')}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold ${
                            addItemTab === 'MANUAL'
                              ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          A mano
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddItemTab('CATALOG')}
                          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold ${
                            addItemTab === 'CATALOG'
                              ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          Catálogo
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddingItem(false)}
                        aria-label="Cerrar agregar ingrediente"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {addItemTab === 'MANUAL' ? (
                      <form onSubmit={handleAddManualItem} className="space-y-2">
                        <AutoGrowTextarea
                          rows={1}
                          maxHeightPx={80}
                          required
                          maxLength={120}
                          value={manualDraft.name}
                          onChange={(val) =>
                            setManualDraft((d) => ({ ...d, name: val }))
                          }
                          placeholder="Nombre del ingrediente"
                          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--focus-ring)] focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="5000"
                            value={manualDraft.grams}
                            onChange={(e) =>
                              setManualDraft((d) => ({ ...d, grams: e.target.value }))
                            }
                            placeholder="Gramos"
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            required
                            min="0"
                            max="10000"
                            value={manualDraft.calories}
                            onChange={(e) =>
                              setManualDraft((d) => ({ ...d, calories: e.target.value }))
                            }
                            placeholder="Kcal *"
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:border-[var(--focus-ring)] focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={manualDraft.proteinG}
                            onChange={(e) =>
                              setManualDraft((d) => ({ ...d, proteinG: e.target.value }))
                            }
                            placeholder="Prot (g)"
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:outline-none"
                          />
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={manualDraft.carbG}
                            onChange={(e) =>
                              setManualDraft((d) => ({ ...d, carbG: e.target.value }))
                            }
                            placeholder="Carbs (g)"
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:outline-none"
                          />
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={manualDraft.fatG}
                            onChange={(e) =>
                              setManualDraft((d) => ({ ...d, fatG: e.target.value }))
                            }
                            placeholder="Grasas (g)"
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-1.5 text-base text-[var(--text-primary)] tabular-nums focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          className="flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-fill)] text-[13px] font-semibold text-[var(--on-accent)] active:scale-[0.98]"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Sumar al plato
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="relative min-w-0 flex-1">
                            <input
                              type="text"
                              value={catalogQuery}
                              onChange={(e) => setCatalogQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleSearchOnlineIngredient();
                                }
                              }}
                              placeholder="Buscar alimento..."
                              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] py-1.5 pl-3 pr-9 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSearchOnlineIngredient()}
                              aria-label="Buscar alimento online"
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--text-muted)]"
                            >
                              {isSearchingOnline ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="3000"
                            value={catalogGrams}
                            onChange={(e) => setCatalogGrams(e.target.value)}
                            aria-label="Gramos"
                            className="w-20 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-1.5 text-right text-base text-[var(--text-primary)] tabular-nums"
                          />
                          <span className="text-xs text-[var(--text-muted)]">g</span>
                        </div>

                        <div className="max-h-36 divide-y divide-[var(--divider)] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                          {isImportingOnline ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-text)]" />
                            </div>
                          ) : (
                            <>
                              {filteredLocalIngredients.map((ing) => (
                                <button
                                  key={ing.id}
                                  type="button"
                                  onClick={() => handleAddCatalogIngredient(ing)}
                                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left active:bg-[var(--surface-inset)]"
                                >
                                  <span className="min-w-0 truncate text-[13.5px] text-[var(--text-primary)]">
                                    {ing.name}
                                  </span>
                                  <span className="shrink-0 text-xs text-[var(--text-muted)] tabular-nums">
                                    {ing.caloriesPer100g} kcal/100g
                                  </span>
                                </button>
                              ))}
                              {onlineResults.map((food) => (
                                <button
                                  key={food.id}
                                  type="button"
                                  onClick={() => void handleImportOnlineIngredient(food)}
                                  className="flex w-full cursor-pointer flex-col px-3 py-2 text-left active:bg-[var(--surface-inset)]"
                                >
                                  <span className="w-full truncate text-[13.5px] text-[var(--text-primary)]">
                                    {food.name}
                                  </span>
                                  <span className="w-full truncate text-xs text-[var(--text-muted)]">
                                    {food.description}
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Compact AI Correction Composer */}
            <form
              onSubmit={handleApplyAiCorrection}
              className="flex items-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1 focus-within:border-[var(--focus-ring)]"
            >
              <label htmlFor={`${baseId}-ai-correction`} className="sr-only">
                Corregir con IA
              </label>
              <AutoGrowTextarea
                id={`${baseId}-ai-correction`}
                rows={1}
                minHeightPx={32}
                maxHeightPx={110}
                maxLength={500}
                disabled={isApplyingCorrection}
                value={correctionText}
                onChange={setCorrectionText}
                placeholder="Corregir con IA"
                className="min-w-0 flex-1 bg-transparent py-1 text-[var(--text-primary)] placeholder:text-[14px] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleToggleVoice('correction')}
                disabled={isApplyingCorrection || isTranscribingVoice}
                aria-label={
                  isRecordingVoice
                    ? 'Detener dictado de corrección'
                    : 'Dictar corrección por voz'
                }
                className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-100 active:scale-95 ${
                  isRecordingVoice
                    ? 'bg-[var(--accent-fill)] text-[var(--on-accent)] animate-pulse'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isTranscribingVoice ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecordingVoice ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
              <button
                type="submit"
                disabled={!correctionText.trim() || isApplyingCorrection}
                aria-label="Aplicar corrección con IA"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--accent-fill)] text-[var(--on-accent)] transition-transform duration-100 active:scale-95 disabled:opacity-35"
              >
                {isApplyingCorrection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
                )}
              </button>
            </form>

            {/* 5. Primary Save CTA */}
            <div className="pt-0.5 pb-[env(safe-area-inset-bottom,0px)]">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={items.length === 0 || isApplyingCorrection}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-4 text-[14px] font-semibold text-[var(--on-accent)] transition-transform duration-100 active:scale-[0.98] disabled:opacity-45"
              >
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
                <span className="tabular-nums">
                  {savedMealId
                    ? `Guardar cambios · ${totals.calories} kcal`
                    : `Registrar ${totals.calories} kcal`}
                </span>
              </button>
            </div>
          </motion.div>
        ) : null}
    </div>
  );
}

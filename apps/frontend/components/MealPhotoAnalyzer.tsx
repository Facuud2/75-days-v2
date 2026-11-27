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
  Camera,
  Check,
  ChevronRight,
  ImagePlus,
  Keyboard,
  Loader2,
  Mic,
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
  resolveImagePreview,
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
export type AnalyzerStage = 'CAMERA' | 'TEXT_INPUT' | 'ANALYZING' | 'REVIEW';

interface MealPhotoAnalyzerProps {
  mealType: MealTypeOption;
  onMealTypeChange: (mealType: MealTypeOption) => void;
  onStageChange?: (stage: AnalyzerStage) => void;
  onClose?: () => void;
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
  }) => void;
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
  const [thumbEntry, setThumbEntry] = useState<{ sourceUrl: string; thumbUrl: string } | null>(null);
  const [textDescription, setTextDescription] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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

  useEffect(() => {
    const sourceUrl = capturedImage?.previewUrl;
    if (!sourceUrl) return;
    let cancelled = false;
    void resolveImagePreview(sourceUrl, 160, 160).then((thumb) => {
      if (!cancelled) {
        setThumbEntry({ sourceUrl, thumbUrl: thumb ?? sourceUrl });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [capturedImage]);

  const thumbnailUrl =
    capturedImage?.previewUrl && thumbEntry?.sourceUrl === capturedImage.previewUrl
      ? thumbEntry.thumbUrl
      : null;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopCameraStream();
    };
  }, [stopCameraStream]);

  const totals = useMemo(() => computeMealTotals(items, 1), [items]);

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

        setDishName(response.dishName);
        setItems(response.items.map(attachBaseDensity));
        setExpandedItemId(null);
        setIsAddingItem(false);
        if (response.suggestedMealType) {
          onMealTypeChange(response.suggestedMealType);
        }
        setStage('REVIEW');
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
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

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
    setStage('CAMERA');
  };

  const handleSave = () => {
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

    onConfirmMeal({
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
        <div className="fixed inset-0 z-[100] flex flex-col justify-between overflow-hidden bg-black text-white select-none">
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
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 via-black/30 to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
            aria-hidden="true"
          />

          {/* Top Bar: Close + Flash */}
          <div className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar cámara"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition-transform duration-100 active:scale-95"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void handleToggleFlash()}
              aria-label={flashOn ? 'Desactivar flash' : 'Activar flash'}
              aria-pressed={flashOn}
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border backdrop-blur-md transition-all duration-100 active:scale-95 ${
                flashOn
                  ? 'border-amber-300 bg-amber-400 text-black shadow-lg'
                  : 'border-white/15 bg-black/45 text-white'
              } ${!flashSupported && cameraStatus === 'ready' ? 'opacity-65' : ''}`}
            >
              {flashOn ? (
                <Zap className="h-5 w-5 fill-current" aria-hidden="true" />
              ) : (
                <ZapOff className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Center Focus Frame (BitePal corner brackets) */}
          <div className="pointer-events-none relative z-10 flex flex-1 flex-col items-center justify-center px-6">
            <div className="relative h-64 w-64 sm:h-72 sm:w-72">
              <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-3xl border-l-[3.5px] border-t-[3.5px] border-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]" />
              <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-3xl border-r-[3.5px] border-t-[3.5px] border-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]" />
              <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-3xl border-b-[3.5px] border-l-[3.5px] border-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]" />
              <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-3xl border-b-[3.5px] border-r-[3.5px] border-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]" />

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
                    Enfocá tu plato en el centro o usá Galería / Teclado.
                  </p>
                </div>
              ) : null}
            </div>

            {cameraStatus === 'ready' ? (
              <p className="mt-5 rounded-full bg-black/45 px-3.5 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                Enfocá tu comida en el centro
              </p>
            ) : null}
          </div>

          {/* Bottom Controls: Galería | Shutter | Teclado */}
          <div className="relative z-10 space-y-3 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3">
            {analysisError ? (
              <div
                role="alert"
                className="mx-auto flex max-w-sm items-start justify-between gap-2.5 rounded-2xl border border-red-400/30 bg-black/75 px-3.5 py-2.5 text-[13px] text-red-300 backdrop-blur-md"
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

            <div className="mx-auto grid max-w-sm grid-cols-3 items-center gap-4">
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-1.5 text-white/95 transition-transform duration-100 active:scale-95"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/15 backdrop-blur-md">
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-[11px] font-medium tracking-wide">Galería</span>
              </button>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleShutterPress}
                  aria-label="Sacar foto y calcular calorías"
                  className="flex h-[74px] w-[74px] cursor-pointer items-center justify-center rounded-full border-[4px] border-white bg-transparent p-1 shadow-xl transition-transform duration-100 active:scale-90"
                >
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-black" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAnalysisError(null);
                  setStage('TEXT_INPUT');
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-1.5 text-white/95 transition-transform duration-100 active:scale-95"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/15 backdrop-blur-md">
                  <Keyboard className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-[11px] font-medium tracking-wide">Teclado</span>
              </button>
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

      {/* STAGE 3: MINIMAL ANALYZING STATE */}
      {stage === 'ANALYZING' ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-4">
          {capturedImage ? (
            <div className="mb-3.5 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage.previewUrl}
                alt="Comida en análisis"
                className="aspect-[16/10] max-h-[180px] w-full object-cover"
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--accent-text)]" />
              <span className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
                Calculando nutrientes...
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetToCamera}
              className="min-h-9 shrink-0 cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--text-secondary)] active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {/* STAGE 4: COMPACT MOBILE-FIRST REVIEW — ZERO BLOAT, DIRECT MANUAL EDITING */}
      <AnimatePresence initial={false} mode="wait">
        {stage === 'REVIEW' ? (
          <motion.div
            key="meal-review"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
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
                onClick={handleSave}
                disabled={items.length === 0 || isApplyingCorrection}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-4 text-[14px] font-semibold text-[var(--on-accent)] transition-transform duration-100 active:scale-[0.98] disabled:opacity-45"
              >
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
                <span className="tabular-nums">Registrar {totals.calories} kcal</span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

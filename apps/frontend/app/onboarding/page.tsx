'use client';

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore, Difficulty } from '@/store/useChallengeStore';
import { useQuestStore, type SideQuestTemplate } from '@/store/useQuestStore';
import { useUIStore } from '@/store/useUIStore';
import { userService } from '@/lib/api/users';
import { setPendingTutorial } from '@/lib/tutorial';
import { getInitial, getNameHandle } from '@/lib/utils/display';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  ChevronLeft,
  SkipForward,
  Calendar,
  Pencil,
  Check,
  Camera,
  Upload,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PLANS } from '@/components/PlansModal';
import RulerPicker from '@/components/onboarding/RulerPicker';
import VerticalWheelPicker from '@/components/onboarding/VerticalWheelPicker';
import QuestPreviewSheet from '@/components/onboarding/QuestPreviewSheet';
import CustomTaskEditorSheet, {
  createEmptyCustomTask,
  getCustomTaskIcon,
  type CustomTask,
} from '@/components/onboarding/CustomTaskEditorSheet';
import ImageCropperModal from '@/components/profile/ImageCropperModal';
import { calculateAgeBasedBmi, type BmiCategoryId } from '@/lib/utils/bmi';

type StepId =
  | 'profile'
  | 'age'
  | 'height'
  | 'weight'
  | 'targetWeight'
  | 'quests'
  | 'plan';

const BMI_SEGMENTS: Array<{ id: BmiCategoryId; label: string; colorVar: string }> = [
  { id: 'underweight', label: 'Bajo', colorVar: 'var(--status-info)' },
  { id: 'normal', label: 'Normal', colorVar: 'var(--status-success)' },
  { id: 'overweight', label: 'Sobrepeso', colorVar: 'var(--status-warning)' },
  { id: 'obesity', label: 'Obesidad', colorVar: 'var(--status-danger)' },
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function Onboarding() {
  const { user, updateProfile, completeOnboarding } = useAuthStore();
  const isGoogleUser = Boolean(user?.isGoogleUser);

  const steps: StepId[] = isGoogleUser
    ? ['profile', 'age', 'height', 'weight', 'targetWeight', 'quests', 'plan']
    : ['age', 'height', 'weight', 'targetWeight', 'quests', 'plan'];

  const totalSteps = steps.length;
  const [step, setStep] = useState(0);
  const currentStepId: StepId = steps[step] ?? 'age';

  const [direction, setDirection] = useState<1 | -1>(1);
  const [isChallengeLoading, setIsChallengeLoading] = useState(false);
  const { startChallenge } = useChallengeStore();
  const { availableQuests, fetchAvailableQuests, subscribeToQuest } = useQuestStore();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [fetchQuestsStatus, setFetchQuestsStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('loading');

  useEffect(() => {
    fetchAvailableQuests().finally(() => setFetchQuestsStatus('success'));
  }, [fetchAvailableQuests]);

  // Google Profile step state (Twitter-style preview & edit)
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(
    user?.avatarUrl || ''
  );
  const [failedAvatarPreview, setFailedAvatarPreview] = useState<string | null>(
    null
  );
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial user values once hydrated
  const googleDefaultAge = user?.age ?? 25;
  const [age, setAge] = useState(googleDefaultAge);
  const [weight, setWeight] = useState(user?.weight ?? 70.0);
  const [targetWeight, setTargetWeight] = useState<number | null>(
    user?.targetWeight ?? null
  );
  const [height, setHeight] = useState(user?.height ?? 170);

  useEffect(() => {
    if (user?.name && !profileName) {
      setProfileName(user.name);
    }
    if (user?.avatarUrl && !profileAvatarUrl) {
      setProfileAvatarUrl(user.avatarUrl);
    }
    if (typeof user?.age === 'number') {
      setAge(user.age);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Side Quests
  const [selectedQuests, setSelectedQuests] = useState<string[]>([]);
  const [previewQuest, setPreviewQuest] = useState<SideQuestTemplate | null>(null);

  const toggleQuestSelection = (questId: string) => {
    setSelectedQuests((prev) =>
      prev.includes(questId)
        ? prev.filter((id) => id !== questId)
        : [...prev, questId]
    );
  };

  // Challenge Selection
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [planDirection, setPlanDirection] = useState<1 | -1>(1);
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(false);

  const validCustomTasks = customTasks.filter((t) => t.title.trim() !== '');
  const hasCustomTasks = validCustomTasks.length > 0;

  const isPlanStepValid = () => {
    if (difficulty === 'Custom') {
      return hasCustomTasks;
    }
    return true;
  };

  const openCustomEditor = () => {
    if (customTasks.length === 0) {
      setCustomTasks([createEmptyCustomTask()]);
    }
    setIsCustomEditorOpen(true);
  };

  const handleSelectDifficulty = (nextDiff: Difficulty) => {
    const prevIdx = PLANS.findIndex((p) => p.difficulty === difficulty);
    const nextIdx = PLANS.findIndex((p) => p.difficulty === nextDiff);
    if (nextIdx !== prevIdx) {
      setPlanDirection(nextIdx > prevIdx ? 1 : -1);
      setDifficulty(nextDiff);
    }
  };

  const canProceed = () => {
    if (currentStepId === 'profile') {
      return profileName.trim().length >= 2;
    }
    if (currentStepId === 'plan') {
      return isPlanStepValid();
    }
    return true;
  };

  const goToStep = (nextStep: number) => {
    if (nextStep < 0 || nextStep >= totalSteps) return;
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  };

  const handleNext = async () => {
    if (!canProceed()) return;

    if (currentStepId === 'profile') {
      const cleanedName = profileName.trim();
      const cleanedAvatar = profileAvatarUrl.trim() || null;
      updateProfile({
        name: cleanedName,
        avatarUrl: cleanedAvatar,
      });
      // Persist immediately so app data always takes precedence over Google
      userService
        .updateProfile({
          name: cleanedName,
          avatarUrl: cleanedAvatar,
        })
        .catch(() => {});
      goToStep(step + 1);
      return;
    }

    if (currentStepId === 'targetWeight') {
      const finalTarget =
        targetWeight ?? Math.max(30, Number((weight - 5).toFixed(1)));
      setTargetWeight(finalTarget);
      updateProfile({
        age,
        weight,
        targetWeight: finalTarget,
        height,
      });
      goToStep(step + 1);
      return;
    }

    if (currentStepId === 'quests') {
      await Promise.all(
        selectedQuests.map((qId) => {
          const q = availableQuests.find((aq) => aq.id === qId);
          return q
            ? subscribeToQuest(q.title, q.difficulty, q.durationDays)
            : Promise.resolve();
        })
      );
      goToStep(step + 1);
      return;
    }

    if (currentStepId === 'plan') {
      setIsChallengeLoading(true);
      try {
        const formattedCustomGoals = customTasks
          .filter((t) => t.title.trim())
          .map(({ title, description, icon }) => ({
            title: title.trim(),
            description: description.trim(),
            icon,
          }));
        await startChallenge(
          difficulty,
          difficulty === 'Custom' ? formattedCustomGoals : undefined
        );
        await completeOnboarding();
        const completedUserId = useAuthStore.getState().user?.id;
        setPendingTutorial(completedUserId);
        useUIStore.getState().openTutorial();
        router.push('/dashboard');
      } catch {
        setIsChallengeLoading(false);
      }
      return;
    }

    goToStep(step + 1);
  };

  const handleSkipOptional = () => {
    if (currentStepId === 'targetWeight') {
      setTargetWeight(null);
      updateProfile({
        age,
        weight,
        targetWeight: undefined,
        height,
      });
      goToStep(step + 1);
    } else if (currentStepId === 'quests') {
      goToStep(step + 1);
    }
  };

  const activePlan = PLANS.find((p) => p.difficulty === difficulty) ?? PLANS[1];
  const activePlanTasks =
    activePlan.difficulty === 'Custom' && hasCustomTasks
      ? validCustomTasks.map((task) => {
          const Icon = getCustomTaskIcon(task.icon);
          return {
            icon: (
              <Icon
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: 'var(--accent-text)' }}
              />
            ),
            label: task.title,
          };
        })
      : activePlan.tasks;

  const getStepMeta = (id: StepId) => {
    switch (id) {
      case 'profile':
        return {
          eyebrow: 'Tu perfil · Google',
          title: 'Así se verá tu perfil',
          subtitle:
            'Revisá cómo queda tu tarjeta estilo Twitter y personalizá tu nombre o foto si querés.',
        };
      case 'age':
        return isGoogleUser
          ? {
              eyebrow: 'Paso 1 · Sobre vos',
              title: `¿Tenés ${googleDefaultAge} años?`,
              subtitle: `Confirmá si tu edad coincide con tu fecha de nacimiento en Google (${googleDefaultAge} años) o deslizá para cambiarla.`,
            }
          : {
              eyebrow: 'Paso 1 · Sobre vos',
              title: '¿Cuántos años tenés?',
              subtitle: 'Deslizá los números hacia arriba o abajo.',
            };
      case 'height':
        return {
          eyebrow: 'Paso 1 · Sobre vos',
          title: '¿Cuánto medís?',
          subtitle: 'Ajustá tu altura en centímetros.',
        };
      case 'weight':
        return {
          eyebrow: 'Paso 1 · Sobre vos',
          title: '¿Cuál es tu peso actual?',
          subtitle: 'Arrastrá la regla para ajustar kilos y gramos.',
        };
      case 'targetWeight':
        return {
          eyebrow: 'Paso 1 · Opcional',
          title: '¿Cuál es tu peso ideal?',
          subtitle: 'Definí una meta o saltá este paso si preferís.',
        };
      case 'quests':
        return {
          eyebrow: 'Paso 2 · Opcional',
          title: 'Actividades dinámicas',
          subtitle: 'Sumá misiones paralelas a tu desafío.',
        };
      case 'plan':
        return {
          eyebrow: 'Paso 3 · Plan principal',
          title: 'Elegí tu desafío',
          subtitle: 'Definí la intensidad de tus próximos 75 días.',
        };
    }
  };

  const meta = getStepMeta(currentStepId);
  const suggestedTarget = Math.max(30, Number((weight - 5).toFixed(1)));
  const effectiveTargetWeight = targetWeight ?? suggestedTarget;
  const bmiInfo = calculateAgeBasedBmi(weight, height, age);
  const showAvatarImage =
    Boolean(profileAvatarUrl.trim()) &&
    profileAvatarUrl.trim() !== failedAvatarPreview;
  const handle = getNameHandle(profileName || 'usuario');

  return (
    <div className="h-[calc(100dvh-5.75rem)] md:h-auto md:min-h-[620px] max-w-lg mx-auto flex flex-col justify-between gap-3 overflow-hidden select-none">
      {/* Top Progress + Centered iOS-style Question Header */}
      <header className="shrink-0 space-y-4 pt-1">
        <div className="flex items-center gap-3">
          <div
            className="h-1.5 flex-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--progress-track)' }}
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
          >
            <motion.div
              className="h-full w-full rounded-full"
              style={{
                backgroundColor: 'var(--accent-fill)',
                transformOrigin: 'left',
              }}
              initial={false}
              animate={{ scaleX: (step + 1) / totalSteps }}
              transition={
                reduceMotion
                  ? { duration: 0.01 }
                  : { duration: 0.26, ease: EASE_OUT }
              }
            />
          </div>
          <span
            className="text-xs font-semibold tabular-nums shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {step + 1} / {totalSteps}
          </span>
        </div>

        <div className="text-center space-y-1 px-2">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--accent-text)' }}
          >
            {meta.eyebrow}
          </p>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {meta.title}
          </h1>
          <p
            className="text-xs sm:text-sm leading-snug"
            style={{ color: 'var(--text-muted)' }}
          >
            {meta.subtitle}
          </p>
        </div>
      </header>

      {/* Main Full-Screen Focused Stage */}
      <div className="relative flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={currentStepId}
            custom={direction}
            variants={{
              enter: (dir: 1 | -1) =>
                reduceMotion ? { opacity: 0 } : { opacity: 0, x: `${dir * 26}%` },
              center: { opacity: 1, x: 0 },
              exit: (dir: 1 | -1) =>
                reduceMotion ? { opacity: 0 } : { opacity: 0, x: `${dir * -26}%` },
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              reduceMotion
                ? { duration: 0.16, ease: 'easeOut' }
                : { duration: 0.25, ease: EASE_OUT }
            }
            className="h-full min-h-0 flex flex-col justify-center"
          >
            {/* Substep Google Profile: Vista previa estilo Twitter + Edición de name y avatarUrl */}
            {currentStepId === 'profile' && (
              <div className="h-full min-h-0 overflow-y-auto overscroll-contain space-y-3.5 px-1 py-1">
                {/* Tarjeta de vista previa estilo Twitter */}
                <section
                  aria-label="Vista previa de tu perfil"
                  className="rounded-3xl border overflow-hidden shadow-sm"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="relative h-24 w-full overflow-hidden"
                    style={{
                      background:
                        'linear-gradient(135deg, color-mix(in srgb, var(--accent-fill) 38%, var(--surface-inset)), var(--surface-inset))',
                    }}
                  >
                    <span
                      className="absolute top-2.5 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: 'rgb(0 0 0 / 0.45)',
                        color: '#ffffff',
                      }}
                    >
                      Vista previa
                    </span>
                  </div>

                  <div className="px-4 pb-4">
                    <div className="flex items-end justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="relative -mt-10 h-20 w-20 rounded-full border-4 flex items-center justify-center overflow-hidden text-xl font-bold uppercase cursor-pointer group shrink-0"
                        style={{
                          borderColor: 'var(--surface-card)',
                          backgroundColor: 'var(--surface-inset)',
                          color: 'var(--accent-text)',
                        }}
                        aria-label="Cambiar foto de perfil"
                      >
                        {showAvatarImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profileAvatarUrl.trim()}
                            alt={profileName || 'Avatar'}
                            className="h-full w-full object-cover"
                            onError={() =>
                              setFailedAvatarPreview(profileAvatarUrl.trim())
                            }
                          />
                        ) : (
                          getInitial(profileName || 'U')
                        )}
                        <span
                          className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-hidden="true"
                        >
                          <Camera className="h-5 w-5 text-white" />
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--surface-inset)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Subir foto
                      </button>
                    </div>

                    <div className="mt-2.5 min-w-0">
                      <p
                        className="text-lg font-bold leading-tight truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {profileName.trim() || 'Tu nombre'}
                      </p>
                      <p
                        className="text-xs truncate mt-0.5"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        @{handle || 'usuario'}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className="pv2-chip"
                        style={{ color: 'var(--accent-text)' }}
                      >
                        Nivel 1
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        75 Days Challenge
                      </span>
                    </div>
                  </div>
                </section>

                {/* Controles editables: Name y AvatarUrl */}
                <div
                  className="rounded-2xl border p-3.5 space-y-3"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="space-y-1">
                    <label
                      htmlFor="onboarding-profile-name"
                      className="block text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Nombre visible
                    </label>
                    <input
                      id="onboarding-profile-name"
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Tu nombre"
                      maxLength={80}
                      className="w-full min-h-[42px] rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="onboarding-avatar-url"
                      className="block text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Foto de perfil (URL o imagen subida)
                    </label>
                    <input
                      id="onboarding-avatar-url"
                      type="url"
                      value={profileAvatarUrl}
                      onChange={(e) => {
                        setFailedAvatarPreview(null);
                        setProfileAvatarUrl(e.target.value);
                      }}
                      placeholder="https://..."
                      className="w-full min-h-[42px] rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--surface-inset)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="sr-only"
                />
              </div>
            )}

            {/* Substep Edad — Vertical numbers-only wheel */}
            {currentStepId === 'age' && (
              <div className="flex flex-col items-center justify-center py-2">
                <VerticalWheelPicker
                  label="Edad en años"
                  value={age}
                  onChange={setAge}
                  min={12}
                  max={110}
                  unitLabel="años"
                />
              </div>
            )}

            {/* Substep Altura — Horizontal iOS ruler */}
            {currentStepId === 'height' && (
              <div className="flex flex-col items-center justify-center px-1">
                <div
                  className="w-full rounded-3xl border px-4 py-7"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <RulerPicker
                    label="Altura en centímetros"
                    value={height}
                    onChange={setHeight}
                    min={120}
                    max={225}
                    step={1}
                    unit="cm"
                    majorEvery={10}
                    midEvery={5}
                    tickSpacing={12}
                    formatValue={(v) => String(Math.round(v))}
                  />
                </div>
              </div>
            )}

            {/* Substep Peso actual + Categorías de IMC según edad */}
            {currentStepId === 'weight' && (
              <div className="flex flex-col items-center justify-center gap-3 px-1">
                <div
                  className="w-full rounded-3xl border px-4 py-6"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <RulerPicker
                    label="Peso actual en kilogramos"
                    value={weight}
                    onChange={setWeight}
                    min={30}
                    max={220}
                    step={0.1}
                    unit="kg"
                    majorEvery={10}
                    midEvery={5}
                    tickSpacing={12}
                    formatValue={(v) => v.toFixed(1)}
                  />
                </div>

                {/* Age-based BMI card (only on current weight) */}
                <section
                  aria-live="polite"
                  className="w-full rounded-2xl border px-4 py-3 space-y-2.5"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        IMC estimado
                      </p>
                      <p
                        className="text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Referencia {bmiInfo.ageGroupLabel} · {height} cm
                      </p>
                    </div>

                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums border whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${bmiInfo.colorVar} 14%, transparent)`,
                        borderColor: `color-mix(in srgb, ${bmiInfo.colorVar} 38%, transparent)`,
                        color: bmiInfo.colorVar,
                      }}
                    >
                      <span>{bmiInfo.bmi.toFixed(1)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{bmiInfo.label}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                    {BMI_SEGMENTS.map((seg) => {
                      const isActive = seg.id === bmiInfo.categoryId;
                      return (
                        <div key={seg.id} className="space-y-1">
                          <div
                            className="h-1.5 rounded-full transition-opacity duration-150"
                            style={{
                              backgroundColor: seg.colorVar,
                              opacity: isActive ? 1 : 0.22,
                            }}
                          />
                          <p
                            className="text-[10px] text-center font-medium truncate"
                            style={{
                              color: isActive
                                ? 'var(--text-primary)'
                                : 'var(--text-muted)',
                              fontWeight: isActive ? 700 : 500,
                            }}
                          >
                            {seg.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* Substep Peso ideal (Opcional) — sin IMC */}
            {currentStepId === 'targetWeight' && (
              <div className="flex flex-col items-center justify-center gap-4 px-1">
                <div
                  className="w-full rounded-3xl border px-4 py-7"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <RulerPicker
                    label="Peso ideal en kilogramos"
                    value={effectiveTargetWeight}
                    onChange={(val) => setTargetWeight(val)}
                    min={30}
                    max={220}
                    step={0.1}
                    unit="kg"
                    majorEvery={10}
                    midEvery={5}
                    tickSpacing={12}
                    formatValue={(v) => v.toFixed(1)}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSkipOptional}
                  className="min-h-[40px] px-4 rounded-full text-xs font-semibold transition-transform active:scale-95 cursor-pointer"
                  style={{
                    touchAction: 'manipulation',
                    color: 'var(--text-muted)',
                  }}
                >
                  Prefiero no definir una meta por ahora
                </button>
              </div>
            )}

            {/* Step Actividades dinámicas */}
            {currentStepId === 'quests' && (
              <div className="h-full min-h-0 overflow-y-auto overscroll-contain space-y-2.5 pr-0.5 py-1">
                {fetchQuestsStatus === 'loading' ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl border animate-pulse"
                      style={{
                        backgroundColor: 'var(--surface-card)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="pv2-skeleton h-4 w-2/3" />
                        <div className="pv2-skeleton h-4 w-16" />
                      </div>
                      <div className="pv2-skeleton h-3 w-1/3 mt-2" />
                    </div>
                  ))
                ) : availableQuests.length > 0 ? (
                  availableQuests.map((quest) => {
                    const isSelected = selectedQuests.includes(quest.id);
                    const taskCount = quest.tasks?.length ?? 0;
                    return (
                      <div
                        key={quest.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewQuest(quest)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setPreviewQuest(quest);
                          }
                        }}
                        className="w-full p-3.5 text-left rounded-2xl border transition-transform active:scale-[0.985] cursor-pointer flex items-center justify-between gap-2"
                        style={{
                          touchAction: 'manipulation',
                          backgroundColor: isSelected
                            ? 'var(--surface-raised)'
                            : 'var(--surface-card)',
                          borderColor: isSelected
                            ? 'var(--accent-fill)'
                            : 'var(--border-subtle)',
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3
                              className="font-semibold text-sm truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {quest.title}
                            </h3>
                            <span
                              className="text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0"
                              style={{
                                backgroundColor: 'var(--surface-inset)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {quest.difficulty}
                            </span>
                          </div>
                          <p
                            className="text-xs mt-0.5 flex items-center gap-1.5"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <span>{quest.durationDays} días</span>
                            {taskCount > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{taskCount} tareas</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span
                              className="font-medium"
                              style={{ color: 'var(--accent-text)' }}
                            >
                              Ver detalle
                            </span>
                          </p>
                        </div>

                        <button
                          type="button"
                          aria-label={
                            isSelected
                              ? `Quitar ${quest.title}`
                              : `Seleccionar ${quest.title}`
                          }
                          aria-pressed={isSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleQuestSelection(quest.id);
                          }}
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center border transition-colors"
                            style={{
                              backgroundColor: isSelected
                                ? 'var(--accent-fill)'
                                : 'transparent',
                              borderColor: isSelected
                                ? 'var(--accent-fill)'
                                : 'var(--border-control)',
                              color: 'var(--on-accent)',
                            }}
                          >
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </span>
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div
                    className="rounded-2xl border p-6 text-center"
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      No hay actividades disponibles en este momento.
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Podés continuar al siguiente paso y elegir tu plan.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step Elegí tu desafío */}
            {currentStepId === 'plan' && (
              <div className="h-full min-h-0 flex flex-col justify-center gap-3">
                <div
                  className="grid grid-cols-4 gap-1 p-1 rounded-2xl border shrink-0 relative"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  {PLANS.map((plan) => {
                    const isSelected = difficulty === plan.difficulty;
                    return (
                      <button
                        key={plan.difficulty}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectDifficulty(plan.difficulty)}
                        className="relative min-h-[40px] px-1.5 rounded-xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer truncate z-10"
                        style={{
                          touchAction: 'manipulation',
                          color: isSelected
                            ? 'var(--on-accent)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId="onboarding-plan-pill"
                            transition={
                              reduceMotion
                                ? { duration: 0.01 }
                                : { duration: 0.22, ease: EASE_OUT }
                            }
                            className="absolute inset-0 rounded-xl -z-10"
                            style={{ backgroundColor: 'var(--accent-fill)' }}
                          />
                        )}
                        {plan.difficulty}
                      </button>
                    );
                  })}
                </div>

                <div className="relative overflow-hidden min-h-0">
                  <AnimatePresence mode="wait" custom={planDirection} initial={false}>
                    <motion.section
                      key={difficulty}
                      custom={planDirection}
                      variants={{
                        enter: (dir: 1 | -1) =>
                          reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, x: dir * 20 },
                        center: { opacity: 1, x: 0 },
                        exit: (dir: 1 | -1) =>
                          reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, x: dir * -20 },
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={
                        reduceMotion
                          ? { duration: 0.14 }
                          : { duration: 0.18, ease: EASE_OUT }
                      }
                      className="rounded-2xl border p-4 space-y-3 max-h-full overflow-y-auto overscroll-contain"
                      style={{
                        backgroundColor: 'var(--surface-card)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2
                            className="font-bold text-lg leading-tight"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {activePlan.title}
                          </h2>
                          <p
                            className="text-xs mt-1 leading-relaxed"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {activePlan.description}
                          </p>
                        </div>
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 border"
                          style={{
                            backgroundColor: 'var(--surface-inset)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Calendar className="w-3 h-3" />
                          75 días
                        </span>
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <p
                            className="text-[11px] font-bold uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {difficulty === 'Custom' && hasCustomTasks
                              ? `Tus tareas (${validCustomTasks.length})`
                              : 'Tareas Diarias'}
                          </p>
                          {difficulty === 'Custom' && hasCustomTasks && (
                            <button
                              type="button"
                              onClick={openCustomEditor}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-transform active:scale-95 cursor-pointer"
                              style={{
                                touchAction: 'manipulation',
                                backgroundColor: 'var(--surface-inset)',
                                borderColor: 'var(--border-subtle)',
                                color: 'var(--accent-text)',
                              }}
                            >
                              <Pencil size={12} />
                              Editar tareas
                            </button>
                          )}
                        </div>

                        <ul className="space-y-2">
                          {activePlanTasks.map((task, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-2.5 text-xs font-medium"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              <span className="shrink-0">{task.icon}</span>
                              <span className="leading-snug truncate">
                                {task.label}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.section>
                  </AnimatePresence>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pinned Bottom Action Bar */}
      <footer className="shrink-0 flex items-center justify-between gap-3 pt-1 pb-[env(safe-area-inset-bottom,0px)]">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => goToStep(step - 1)}
            className="min-h-[48px] px-4 rounded-2xl font-semibold text-sm flex items-center gap-1 border transition-transform active:scale-95 cursor-pointer"
            style={{
              touchAction: 'manipulation',
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <ChevronLeft size={18} />
            Anterior
          </button>
        ) : null}

        {currentStepId === 'quests' && selectedQuests.length === 0 ? (
          <button
            type="button"
            onClick={handleSkipOptional}
            className="flex-1 min-h-[48px] px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
            style={{
              touchAction: 'manipulation',
              backgroundColor: 'var(--accent-fill)',
              color: 'var(--on-accent)',
            }}
          >
            Saltar
            <SkipForward size={18} />
          </button>
        ) : currentStepId === 'plan' &&
          difficulty === 'Custom' &&
          !hasCustomTasks ? (
          <button
            type="button"
            onClick={openCustomEditor}
            className="flex-1 min-h-[48px] px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
            style={{
              touchAction: 'manipulation',
              backgroundColor: 'var(--accent-fill)',
              color: 'var(--on-accent)',
            }}
          >
            <Pencil size={17} />
            Editar tareas
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed() || isChallengeLoading}
            className={`flex-1 min-h-[48px] px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-transform ${
              canProceed() && !isChallengeLoading
                ? 'active:scale-[0.98] cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
            style={{
              touchAction: 'manipulation',
              backgroundColor: 'var(--accent-fill)',
              color: 'var(--on-accent)',
            }}
          >
            {isChallengeLoading ? (
              <>
                Creando tu desafío <span className="pv2-skeleton w-4 h-4" />
              </>
            ) : (
              <>
                {currentStepId === 'plan' ? 'Comenzar Desafío' : 'Siguiente'}
                <ChevronRight size={18} />
              </>
            )}
          </button>
        )}
      </footer>
      <QuestPreviewSheet
        quest={previewQuest}
        isSelected={
          previewQuest ? selectedQuests.includes(previewQuest.id) : false
        }
        onToggleSelect={toggleQuestSelection}
        onClose={() => setPreviewQuest(null)}
      />

      <CustomTaskEditorSheet
        isOpen={isCustomEditorOpen}
        tasks={customTasks}
        onChange={setCustomTasks}
        onClose={() => {
          setCustomTasks((prev) => prev.filter((t) => t.title.trim() !== ''));
          setIsCustomEditorOpen(false);
        }}
      />

      <ImageCropperModal
        open={Boolean(cropSrc)}
        src={cropSrc}
        mode="avatar"
        onCancel={() => {
          if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }}
        onApply={(croppedDataUrl) => {
          if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
          setFailedAvatarPreview(null);
          setProfileAvatarUrl(croppedDataUrl);
          setCropSrc(null);
        }}
      />
    </div>
  );
}

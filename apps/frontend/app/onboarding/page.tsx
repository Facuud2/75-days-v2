'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore, Difficulty } from '@/store/useChallengeStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, SkipForward, Calendar, X } from 'lucide-react';
import { PLANS } from '@/components/PlansModal';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const { updateProfile, completeOnboarding } = useAuthStore();
  const { startChallenge, addSideQuest } = useChallengeStore();
  const { availableQuests, fetchAvailableQuests } = useQuestStore();
  const router = useRouter();

  // Load available dynamic quests
  useEffect(() => {
    fetchAvailableQuests();
  }, [fetchAvailableQuests]);

  // Step 1: Biometrics
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [height, setHeight] = useState('');

  // Step 2: Side Quests
  const [selectedQuests, setSelectedQuests] = useState<string[]>([]);

  // Step 3: Challenge Selection
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [customGoals, setCustomGoals] = useState<string[]>(['Drink 1 Gallon water', 'Read 10 pages', 'Workout 45m']);

  // --- Validation ---
  const isStep1Valid = () => {
    const ageNum = parseFloat(age);
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    return (
      age !== '' && !isNaN(ageNum) && ageNum > 0 &&
      weight !== '' && !isNaN(weightNum) && weightNum > 0 &&
      height !== '' && !isNaN(heightNum) && heightNum > 0
    );
  };

  const isStep3Valid = () => {
    if (difficulty === 'Custom') {
      return customGoals.some(g => g.trim() !== '');
    }
    return true;
  };

  const canProceed = () => {
    if (step === 1) return isStep1Valid();
    if (step === 3) return isStep3Valid();
    return true;
  };

  // --- Handlers ---
  const handleNext = async () => {
    if (!canProceed()) return;

    if (step === 1) {
      updateProfile({
        age: parseInt(age),
        weight: parseFloat(weight),
        targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
        height: parseFloat(height),
      });
      setStep(2);
    } else if (step === 2) {
      selectedQuests.forEach(qId => {
        const q = availableQuests.find(aq => aq.id === qId);
        // Note: Map difficulty back to the ChallengeStore's expected string
        if (q) addSideQuest({ title: q.title, difficulty: q.difficulty as any, durationDays: q.durationDays });
      });
      setStep(3);
    } else if (step === 3) {
      const formattedCustomGoals = customGoals.map(g => ({ title: g }));
      await startChallenge(difficulty, difficulty === 'Custom' ? formattedCustomGoals : undefined);
      await completeOnboarding();
      router.push('/dashboard');
    }
  };

  const handleSkipStep2 = () => {
    setStep(3);
  };

  // --- Missing fields label (Step 1) ---
  const getMissingFields = () => {
    const missing: string[] = [];
    const ageNum = parseFloat(age);
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    if (!age || isNaN(ageNum) || ageNum <= 0) missing.push('Edad');
    if (!weight || isNaN(weightNum) || weightNum <= 0) missing.push('Peso');
    if (!height || isNaN(heightNum) || heightNum <= 0) missing.push('Altura');
    return missing;
  };

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-2xl mx-auto pt-12">
      {/* Progress Bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
        ))}
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm p-6 md:p-10 border border-zinc-100 dark:border-zinc-800">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Sobre Vos</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Completá tus métricas base para comenzar. Todos los campos son obligatorios.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Edad <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none"
                  placeholder="ej. 25"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Peso actual (kg) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={weight === '' ? '' : Math.floor(Number(weight))}
                    onChange={(e) => {
                      const newInt = e.target.value;
                      const currentDec = weight === '' ? '0' : Math.round((Number(weight) - Math.floor(Number(weight))) * 10).toString();
                      setWeight(`${newInt}.${currentDec}`);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none appearance-none"
                  >
                    <option value="" disabled>Peso</option>
                    {Array.from({ length: 271 }, (_, i) => i + 30).map((kg) => (
                      <option key={kg} value={kg}>{kg}</option>
                    ))}
                  </select>
                  <span className="text-xl font-bold text-zinc-400 dark:text-zinc-500">.</span>
                  <select
                    value={weight === '' ? '' : Math.round((Number(weight) - Math.floor(Number(weight))) * 10)}
                    onChange={(e) => {
                      const newDec = e.target.value;
                      const currentInt = weight === '' ? '75' : Math.floor(Number(weight)).toString();
                      setWeight(`${currentInt}.${newDec}`);
                    }}
                    className="w-24 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none appearance-none text-center"
                  >
                    <option value="" disabled>Gr</option>
                    {Array.from({ length: 10 }, (_, i) => i).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Meta de peso (kg) <span className="text-zinc-500 font-normal text-xs ml-1">(Opcional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={targetWeight === '' ? '' : Math.floor(Number(targetWeight))}
                    onChange={(e) => {
                      const newInt = e.target.value;
                      const currentDec = targetWeight === '' ? '0' : Math.round((Number(targetWeight) - Math.floor(Number(targetWeight))) * 10).toString();
                      setTargetWeight(`${newInt}.${currentDec}`);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none appearance-none"
                  >
                    <option value="" disabled>Peso</option>
                    {Array.from({ length: 271 }, (_, i) => i + 30).map((kg) => (
                      <option key={kg} value={kg}>{kg}</option>
                    ))}
                  </select>
                  <span className="text-xl font-bold text-zinc-400 dark:text-zinc-500">.</span>
                  <select
                    value={targetWeight === '' ? '' : Math.round((Number(targetWeight) - Math.floor(Number(targetWeight))) * 10)}
                    onChange={(e) => {
                      const newDec = e.target.value;
                      const currentInt = targetWeight === '' ? '75' : Math.floor(Number(targetWeight)).toString();
                      setTargetWeight(`${currentInt}.${newDec}`);
                    }}
                    className="w-24 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none appearance-none text-center"
                  >
                    <option value="" disabled>Gr</option>
                    {Array.from({ length: 10 }, (_, i) => i).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Altura (cm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={e => setHeight(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none"
                  placeholder="ej. 175"
                  min={1}
                />
              </div>
            </div>

            {/* Validation message */}
            {!isStep1Valid() && (getMissingFields().length > 0) && (
              <p className="text-sm text-red-500 dark:text-red-400">
                Completá los siguientes campos: {getMissingFields().join(', ')}.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Actividades Dinámicas</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Actividades opcionales para potenciar tu recorrido. Podés saltearte este paso.</p>
            </div>

            <div className="space-y-3">
              {availableQuests.map((quest) => (
                <div
                  key={quest.id}
                  onClick={() => setSelectedQuests(prev => prev.includes(quest.id) ? prev.filter(id => id !== quest.id) : [...prev, quest.id])}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedQuests.includes(quest.id) ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50' : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{quest.title}</h3>
                    <span className="text-xs font-medium px-2 py-1 bg-white dark:bg-zinc-900 rounded-md">{quest.difficulty}</span>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{quest.durationDays} días de desafío</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Elegí la Dificultad</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Seleccioná tu plan principal de 75 Días.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLANS.map((plan) => {
                const isSelected = difficulty === plan.difficulty;
                return (
                  <div
                    key={plan.difficulty}
                    onClick={() => setDifficulty(plan.difficulty)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-4 ${isSelected ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50 shadow-md' : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                  >
                    {/* Title & Description */}
                    <div>
                      <h3 className={`font-bold text-lg leading-tight mb-1 ${isSelected ? plan.color : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {plan.title}
                      </h3>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">{plan.description}</p>
                    </div>

                    {/* Duration badge */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="font-medium">75 días</span>
                    </div>

                    {/* Tasks */}
                    <div className="space-y-2">
                      <p className="text-zinc-400 dark:text-zinc-500 text-[11px] font-bold uppercase tracking-wider">Tareas Diarias:</p>
                      <ul className="space-y-1.5">
                        {plan.tasks.map((task, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                            {task.icon}
                            <span className="leading-snug">{task.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            {difficulty === 'Custom' && (
              <div className="mt-6 space-y-3">
                <h4 className="font-medium">Objetivos Personalizados</h4>
                {customGoals.map((goal, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={goal}
                      onChange={(e) => {
                        const newGoals = [...customGoals];
                        newGoals[i] = e.target.value;
                        setCustomGoals(newGoals);
                      }}
                      className="flex-1 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none"
                      placeholder="Ej. Tomar 1 litro de agua"
                    />
                    <button onClick={() => setCustomGoals(customGoals.filter((_, index) => index !== i))} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl">
                      Eliminar
                    </button>
                  </div>
                ))}
                <button onClick={() => setCustomGoals([...customGoals, ''])} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                  + Agregar objetivo
                </button>

                {!isStep3Valid() && (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    Agregá al menos un objetivo personalizado para continuar.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-8">
        {step > 1 ? (
          <button onClick={() => setStep(step - 1)} className="flex items-center px-6 py-3 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
            <ChevronLeft size={20} className="mr-2" /> Atrás
          </button>
        ) : <div />}

        <div className="flex items-center gap-3">
          {step === 2 && selectedQuests.length === 0 ? (
            <button
              onClick={handleSkipStep2}
              className="flex items-center px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Saltar <SkipForward size={20} className="ml-2" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex items-center px-8 py-3 rounded-xl font-medium transition-colors ${canProceed()
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer'
                : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed opacity-60'
                }`}
            >
              {step === 3 ? 'Comenzar Desafío' : 'Siguiente'} <ChevronRight size={20} className="ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

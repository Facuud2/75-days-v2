'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useChallengeStore, Difficulty } from '@/store/useChallengeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { X, Target, Calendar, Utensils, Dumbbell, Droplets, ClipboardList, Star, Pencil } from 'lucide-react';

const PLANS: {
  difficulty: Difficulty;
  title: string;
  description: string;
  color: string;
  borderColor: string;
  glowColor: string;
  tasks: { icon: React.ReactElement; label: string }[];
}[] = [
    {
      difficulty: 'Soft',
      title: 'Soft Challenge',
      description: 'Versión suave para principiantes o recuperación',
      color: 'text-sky-400',
      borderColor: 'border-sky-500',
      glowColor: 'shadow-sky-500/20',
      tasks: [
        { icon: <Utensils className="w-3.5 h-3.5 text-sky-400" />, label: 'Comer saludable (alcohol social)' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-sky-400" />, label: 'Entrenamiento 45 min' },
        { icon: <Droplets className="w-3.5 h-3.5 text-sky-400" />, label: 'Agua (1L)' },
        { icon: <Star className="w-3.5 h-3.5 text-sky-400" />, label: 'Leer 10 páginas' },
      ],
    },
    {
      difficulty: 'Medium',
      title: 'Medium Challenge',
      description: 'Versión intermedia con desafíos balanceados',
      color: 'text-purple-400',
      borderColor: 'border-purple-500',
      glowColor: 'shadow-purple-500/20',
      tasks: [
        { icon: <Dumbbell className="w-3.5 h-3.5 text-purple-400" />, label: 'Entrenamiento 45 min' },
        { icon: <Utensils className="w-3.5 h-3.5 text-purple-400" />, label: 'Dieta Saludable' },
        { icon: <Droplets className="w-3.5 h-3.5 text-purple-400" />, label: 'Agua (3L)' },
        { icon: <Star className="w-3.5 h-3.5 text-purple-400" />, label: 'Sin alcohol' },
      ],
    },
    {
      difficulty: 'Hard',
      title: 'Hard Challenge',
      description: 'El desafío completo 75 HARD original',
      color: 'text-rose-400',
      borderColor: 'border-rose-500',
      glowColor: 'shadow-rose-500/20',
      tasks: [
        { icon: <Utensils className="w-3.5 h-3.5 text-rose-400" />, label: 'Dieta Estricta' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-rose-400" />, label: 'Primer Entrenamiento' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-rose-400" />, label: 'Segundo Entrenamiento' },
        { icon: <Droplets className="w-3.5 h-3.5 text-rose-400" />, label: 'Agua (3.7L)' },
        { icon: <Star className="w-3.5 h-3.5 text-rose-400" />, label: 'Leer 10 páginas' },
        { icon: <Star className="w-3.5 h-3.5 text-rose-400" />, label: 'Sin alcohol' },
      ],
    },
    {
      difficulty: 'Custom',
      title: 'Custom Challenge',
      description: 'Crea tu propio desafío personalizado',
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500',
      glowColor: 'shadow-emerald-500/20',
      tasks: [
        { icon: <Utensils className="w-3.5 h-3.5 text-emerald-400" />, label: 'Dieta Personalizada' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />, label: 'Ejercicio Personalizado' },
        { icon: <Droplets className="w-3.5 h-3.5 text-emerald-400" />, label: 'Hidratación Personalizada' },
        { icon: <Pencil className="w-3.5 h-3.5 text-emerald-400" />, label: 'Tus propias metas' },
      ],
    },
  ];

export default function PlansModal() {
  const router = useRouter();
  const { isPlansModalOpen, closePlansModal } = useUIStore();
  const { startChallenge, isActive, difficulty: currentDifficulty } = useChallengeStore();
  const { user } = useAuthStore();
  const [difficulty, setDifficulty] = useState<Difficulty>(currentDifficulty || 'Hard');
  const [customGoals, setCustomGoals] = useState<string[]>(['Agua (3.7L)', 'Lectura (10 págs)', 'Entrenamiento 45m']);

  const onboardingCompleted = user?.onboardingCompleted === true;
  const PREVIEW_COUNT = 3;

  if (!isPlansModalOpen) return null;

  const handleStart = () => {
    if (isActive) {
      if (!confirm('Ya tienes un desafío activo. ¿Estás seguro de que quieres reiniciarlo con un nuevo plan? Perderás tu racha actual.')) {
        return;
      }
    }
    const formattedCustomGoals = customGoals.map(g => ({ title: g }));
    startChallenge(difficulty, difficulty === 'Custom' ? formattedCustomGoals : undefined);
    closePlansModal();
    router.push('/dashboard');
  };

  const selectedPlan = PLANS.find(p => p.difficulty === difficulty);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={closePlansModal}
    >
      <div
        className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
              <Target className="text-rose-500 w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Seleccionar Plan de Desafío</h2>
          </div>
          <button
            onClick={closePlansModal}
            className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1">
          {!onboardingCompleted ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-rose-500/5" />
                <ClipboardList size={28} className="text-rose-500 relative z-10" />
              </div>
              <div>
                <p className="text-white font-bold text-lg mb-1">¡Completa el Sobre Vos para generar tu plan!</p>
                <p className="text-white/50 text-sm max-w-xs mx-auto">
                  Necesitás finalizar el proceso de configuración inicial antes de seleccionar un plan.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {PLANS.map((plan) => {
                  const isSelected = difficulty === plan.difficulty;
                  return (
                    <div
                      key={plan.difficulty}
                      onClick={() => setDifficulty(plan.difficulty)}
                      className={`
                        relative rounded-xl border-2 p-5 cursor-pointer flex flex-col gap-4 transition-all duration-200
                        ${isSelected
                          ? `${plan.borderColor} bg-white/5 shadow-xl ${plan.glowColor}`
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                        }
                      `}
                    >
                      {/* Title & Description */}
                      <div>
                        <h3 className={`font-bold text-lg leading-tight mb-1 ${isSelected ? plan.color : 'text-white/80'}`}>
                          {plan.title}
                        </h3>
                        <p className="text-white/50 text-xs leading-relaxed">{plan.description}</p>
                      </div>

                      {/* Duration badge */}
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="font-medium">75 días</span>
                      </div>

                      {/* Tasks */}
                      <div className="space-y-2">
                        <p className="text-white/50 text-[11px] font-bold uppercase tracking-wider">Tareas Diarias:</p>
                        <ul className="space-y-1.5">
                          {plan.tasks.map((task, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-white/70 font-medium">
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

              {/* Custom goals editor */}
              {difficulty === 'Custom' && (
                <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2 p-5 bg-white/[0.02] border border-emerald-500/20 rounded-xl">
                  <h4 className="font-bold text-white text-sm">Personaliza tus Metas</h4>
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
                        placeholder="Nombre de la meta..."
                        className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-sm outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/20"
                      />
                      <button
                        onClick={() => setCustomGoals(customGoals.filter((_, index) => index !== i))}
                        className="px-3 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setCustomGoals([...customGoals, ''])}
                    className="text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    + Añadir Meta
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-white/5 flex items-center justify-between bg-zinc-900">
          <span className="text-sm text-white/40 font-medium">
            {selectedPlan ? (
              <span>
                Plan seleccionado:{' '}
                <span className={`font-bold ${selectedPlan.color}`}>{selectedPlan.title}</span>
              </span>
            ) : (
              'No hay plan seleccionado'
            )}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={closePlansModal}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors border border-white/10"
            >
              Cancelar
            </button>
            {onboardingCompleted && (
              <button
                onClick={handleStart}
                className="px-6 py-2.5 bg-rose-500 text-white rounded-xl font-bold text-sm hover:bg-rose-600 transition-all shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]"
              >
                {isActive ? 'Reiniciar Desafío' : 'Comenzar Desafío'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

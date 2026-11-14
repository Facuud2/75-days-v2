'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useChallengeStore, Difficulty } from '@/store/useChallengeStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  X, Target, Calendar, Utensils, Dumbbell, Droplets, ClipboardList, Star, Pencil,
  BookOpen, Camera, Sun, Brain, HeartPulse, GripVertical, Plus, ArrowLeft,
} from 'lucide-react';

export const PLANS: {
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
        { icon: <Droplets className="w-3.5 h-3.5 text-sky-400" />, label: 'Agua (3L al día)' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-sky-400" />, label: 'Ejercicio 45 min (1 día libre)' },
        { icon: <Star className="w-3.5 h-3.5 text-sky-400" />, label: 'Leer 10 páginas' },
        { icon: <Star className="w-3.5 h-3.5 text-sky-400" />, label: 'Sin fotos de progreso' },
      ],
    },
    {
      difficulty: 'Medium',
      title: 'Medium Challenge',
      description: 'Versión intermedia con desafíos balanceados',
      color: 'text-rose-300',
      borderColor: 'border-rose-400',
      glowColor: 'shadow-rose-500/20',
      tasks: [
        { icon: <Utensils className="w-3.5 h-3.5 text-rose-300" />, label: 'Dieta saludable (Sin alcohol)' },
        { icon: <Dumbbell className="w-3.5 h-3.5 text-rose-300" />, label: 'Ejercicio 45 min' },
        { icon: <Star className="w-3.5 h-3.5 text-rose-300" />, label: 'Leer 10 páginas' },
        { icon: <ClipboardList className="w-3.5 h-3.5 text-rose-300" />, label: '3-4 fotos de progreso/sem' },
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

type CustomTask = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

const CUSTOM_ICON_OPTIONS = [
  { name: 'utensils', label: 'Alimentación', Icon: Utensils },
  { name: 'dumbbell', label: 'Ejercicio', Icon: Dumbbell },
  { name: 'droplet', label: 'Hidratación', Icon: Droplets },
  { name: 'book', label: 'Lectura', Icon: BookOpen },
  { name: 'camera', label: 'Fotos', Icon: Camera },
  { name: 'sun', label: 'Exterior', Icon: Sun },
  { name: 'brain', label: 'Mentalidad', Icon: Brain },
  { name: 'heart', label: 'Bienestar', Icon: HeartPulse },
];

const DEFAULT_CUSTOM_TASKS: CustomTask[] = [
  { id: 'water', title: 'Agua (3.7L)', description: 'Beber al menos 3.7 litros de agua durante el día.', icon: 'droplet' },
  { id: 'reading', title: 'Lectura (10 págs)', description: 'Leer 10 páginas de cualquier libro.', icon: 'book' },
  { id: 'workout', title: 'Entrenamiento 45m', description: 'Completar 45 minutos de actividad física.', icon: 'dumbbell' },
];

export default function PlansModal() {
  const router = useRouter();
  const { isPlansModalOpen, closePlansModal } = useUIStore();
  const { startChallenge, isActive, difficulty: currentDifficulty } = useChallengeStore();
  const { user } = useAuthStore();
  const [difficulty, setDifficulty] = useState<Difficulty>(currentDifficulty || 'Hard');
  const [customTasks, setCustomTasks] = useState<CustomTask[]>(DEFAULT_CUSTOM_TASKS);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const onboardingCompleted = user?.onboardingCompleted === true;
  // Reiniciar con el plan que ya está corriendo no cambia nada y sí borraría el
  // historial: el botón queda bloqueado hasta que se elija otro plan.
  const isCurrentPlan = isActive && Boolean(currentDifficulty) && difficulty === currentDifficulty;
  const PREVIEW_COUNT = 3;
  const handleClose = useCallback(() => {
    setIsCustomEditorOpen(false);
    closePlansModal();
  }, [closePlansModal]);

  useEffect(() => {
    if (!isPlansModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlansModalOpen, handleClose]);

  if (!isPlansModalOpen) return null;

  const handleStart = async () => {
    if (isActive) {
      // Solo pedimos confirmación (y solo llegamos acá) si de verdad cambia el plan.
      if (isCurrentPlan) return;
      if (!confirm('Ya tienes un desafío activo. ¿Estás seguro de que quieres reiniciarlo con un nuevo plan? Perderás tu racha actual.')) {
        return;
      }
    }
    const formattedCustomGoals = customTasks
      .filter(task => task.title.trim())
      .map(({ title, description, icon }) => ({ title: title.trim(), description: description.trim(), icon }));
    await startChallenge(difficulty, difficulty === 'Custom' ? formattedCustomGoals : undefined);
    handleClose();
    router.push('/dashboard');
  };

  const updateCustomTask = (id: string, field: keyof CustomTask, value: string) => {
    setCustomTasks(tasks => tasks.map(task => task.id === id ? { ...task, [field]: value } : task));
  };

  const moveTask = (id: string, direction: -1 | 1) => {
    setCustomTasks(tasks => {
      const index = tasks.findIndex(task => task.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= tasks.length) return tasks;
      const next = [...tasks];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const dropTask = (targetId: string) => {
    if (!draggedTaskId || draggedTaskId === targetId) return;
    setCustomTasks(tasks => {
      const from = tasks.findIndex(task => task.id === draggedTaskId);
      const to = tasks.findIndex(task => task.id === targetId);
      if (from < 0 || to < 0) return tasks;
      const next = [...tasks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedTaskId(null);
  };

  const selectedPlan = PLANS.find(p => p.difficulty === difficulty);

  return (
    <div
      className="mobile-sheet-root fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={handleClose}
    >
      <div
        className="mobile-sheet-panel bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom-4 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plans-modal-title"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
              <Target className="text-rose-500 w-4 h-4" />
            </div>
            <h2 id="plans-modal-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {isCustomEditorOpen ? 'Personalizar tu desafío' : 'Seleccionar Plan de Desafío'}
            </h2>
          </div>
          <button
            aria-label="Cerrar selección de plan"
             onClick={handleClose}
            className="text-white/60 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-8 overflow-y-auto overscroll-contain flex-1">
          {isCustomEditorOpen ? (
            <div className="animate-in fade-in slide-in-from-right-2 duration-200">
              <div className="flex items-start gap-4 mb-7">
                <button
                  type="button"
                  onClick={() => setIsCustomEditorOpen(false)}
                  aria-label="Volver a seleccionar el plan"
                  className="mt-0.5 p-2 -ml-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Custom Challenge</p>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Ordená tus tareas</h3>
                  <p className="text-white/50 text-sm mt-1 max-w-xl">Cada bloque representa una tarea diaria. Editá sus datos y arrastralos para definir el orden del desafío.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customTasks.map((task, index) => {
                  const selectedIcon = CUSTOM_ICON_OPTIONS.find(option => option.name === task.icon) ?? CUSTOM_ICON_OPTIONS[0];
                  const TaskIcon = selectedIcon.Icon;
                  return (
                    <article
                      key={task.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropTask(task.id)}
                      className="group relative rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition-colors hover:border-emerald-500/40 hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className="flex items-center gap-2 text-white/35"
                          draggable
                          onDragStart={() => setDraggedTaskId(task.id)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Arrastrar ${task.title || 'tarea'} para reordenar`}
                          title="Arrastrar para reordenar"
                        >
                          <GripVertical className="w-4 h-4 cursor-grab active:cursor-grabbing" aria-hidden="true" />
                          <span className="text-[11px] font-bold uppercase tracking-widest">Tarea {index + 1}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setCustomTasks(tasks => tasks.filter(item => item.id !== task.id))} aria-label={`Eliminar ${task.title || 'tarea'}`} className="p-1.5 ml-1 rounded-md text-white/35 hover:text-red-400 hover:bg-red-500/10 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="relative shrink-0 group/icon">
                          <button type="button" aria-label={`Cambiar icono de ${task.title || 'tarea'}`} className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors peer"><TaskIcon className="w-6 h-6" /></button>
                          <div className="absolute z-10 left-0 top-[calc(100%+8px)] hidden group-focus-within/icon:grid grid-cols-4 gap-1 p-2 rounded-xl border border-white/10 bg-zinc-900 shadow-2xl w-44">
                            {CUSTOM_ICON_OPTIONS.map(({ name, label, Icon }) => <button key={name} type="button" aria-label={label} onClick={() => updateCustomTask(task.id, 'icon', name)} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${task.icon === name ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}><Icon className="w-4 h-4" /></button>)}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <input value={task.title} onChange={(event) => updateCustomTask(task.id, 'title', event.target.value)} aria-label="Nombre de la tarea" placeholder="Nombre de la tarea" className="w-full bg-transparent border-b border-white/10 pb-1 text-base font-bold text-white outline-none focus:border-emerald-400 placeholder:text-white/25" />
                          <textarea value={task.description} onChange={(event) => updateCustomTask(task.id, 'description', event.target.value)} aria-label="Explicación de la tarea" placeholder="Explicá qué hay que hacer..." rows={2} className="w-full resize-none bg-transparent text-xs leading-relaxed text-white/50 outline-none placeholder:text-white/25" />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <button type="button" onClick={() => setCustomTasks(tasks => [...tasks, { id: `task-${Date.now()}`, title: '', description: '', icon: 'star' }])} className="mt-5 flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"><Plus className="w-4 h-4" /> Añadir tarea</button>
            </div>
          ) : !onboardingCompleted ? (
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
                  const tasks = plan.difficulty === 'Custom'
                    ? customTasks
                      .filter(task => task.title.trim())
                      .map(task => ({
                        icon: <Pencil className="w-3.5 h-3.5 text-emerald-400" />,
                        label: task.title,
                      }))
                    : plan.tasks;
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
                            {tasks.map((task, i) => (
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

            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-8 sm:py-4 border-t border-white/5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between bg-zinc-900 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:pb-4">
          <span className="hidden text-sm text-white/40 font-medium sm:block">
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
               onClick={handleClose}
              className="min-h-12 flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors border border-white/10"
            >
              Cancelar
            </button>
            {onboardingCompleted && (
              <button
                onClick={() => difficulty === 'Custom' && !isCustomEditorOpen ? setIsCustomEditorOpen(true) : handleStart()}
                disabled={isCurrentPlan}
                title={isCurrentPlan ? 'Ya estás en este plan. Elegí otro para reiniciar el desafío.' : undefined}
                 className={`min-h-12 flex-[1.4] sm:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                   isCurrentPlan
                     ? 'bg-white/10 text-white/40 cursor-not-allowed'
                     : 'bg-rose-400 text-zinc-950 hover:bg-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                 }`}
              >
                {isCurrentPlan
                  ? 'Plan actual'
                  : difficulty === 'Custom' && !isCustomEditorOpen ? 'Siguiente' : (isActive ? 'Reiniciar Desafío' : 'Comenzar Desafío')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import {
  Brain,
  BookOpen,
  Camera,
  Check,
  Droplets,
  Dumbbell,
  GripVertical,
  HeartPulse,
  Plus,
  Sun,
  Utensils,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export type CustomTask = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

export const CUSTOM_ICON_OPTIONS = [
  { name: 'utensils', label: 'Alimentación', Icon: Utensils },
  { name: 'dumbbell', label: 'Ejercicio', Icon: Dumbbell },
  { name: 'droplet', label: 'Hidratación', Icon: Droplets },
  { name: 'book', label: 'Lectura', Icon: BookOpen },
  { name: 'camera', label: 'Fotos', Icon: Camera },
  { name: 'sun', label: 'Exterior', Icon: Sun },
  { name: 'brain', label: 'Mentalidad', Icon: Brain },
  { name: 'heart', label: 'Bienestar', Icon: HeartPulse },
];

export const DEFAULT_CUSTOM_TASKS: CustomTask[] = [
  {
    id: 'water',
    title: 'Agua (3.7L)',
    description: 'Beber al menos 3.7 litros de agua durante el día.',
    icon: 'droplet',
  },
  {
    id: 'reading',
    title: 'Lectura (10 págs)',
    description: 'Leer 10 páginas de cualquier libro.',
    icon: 'book',
  },
  {
    id: 'workout',
    title: 'Entrenamiento 45m',
    description: 'Completar 45 minutos de actividad física.',
    icon: 'dumbbell',
  },
];

export function getCustomTaskIcon(iconName: string) {
  return (
    CUSTOM_ICON_OPTIONS.find((option) => option.name === iconName)?.Icon ??
    Dumbbell
  );
}

export function createEmptyCustomTask(): CustomTask {
  return {
    id: `task-${Date.now()}`,
    title: '',
    description: '',
    icon: 'dumbbell',
  };
}

type CustomTaskEditorSheetProps = {
  isOpen: boolean;
  tasks: CustomTask[];
  onChange: (tasks: CustomTask[]) => void;
  onClose: () => void;
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function CustomTaskEditorSheet({
  isOpen,
  tasks,
  onChange,
  onClose,
}: CustomTaskEditorSheetProps) {
  const reduceMotion = useReducedMotion();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [openIconTaskId, setOpenIconTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const updateTask = (id: string, field: keyof CustomTask, value: string) => {
    onChange(
      tasks.map((task) => (task.id === id ? { ...task, [field]: value } : task))
    );
  };

  const dropTask = (targetId: string) => {
    if (!draggedTaskId || draggedTaskId === targetId) return;
    const from = tasks.findIndex((t) => t.id === draggedTaskId);
    const to = tasks.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...tasks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setDraggedTaskId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-editor-title"
        >
          <motion.button
            type="button"
            aria-label="Cerrar editor personalizado"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          <motion.div
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }
            }
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { duration: 0.24, ease: EASE_OUT }
            }
            className="relative w-full max-w-lg max-h-[88dvh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border shadow-2xl"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <header
              className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--accent-text)' }}
                >
                  Custom Challenge
                </p>
                <h2
                  id="custom-editor-title"
                  className="text-lg font-bold leading-snug mt-0.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Personalizá tus tareas
                </h2>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Editá cada bloque o arrastralo para cambiar el orden.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--surface-inset)',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3">
              {tasks.map((task, index) => {
                const TaskIcon = getCustomTaskIcon(task.icon);
                const isIconOpen = openIconTaskId === task.id;
                return (
                  <article
                    key={task.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropTask(task.id)}
                    className="rounded-2xl border p-3.5 space-y-3"
                    style={{
                      backgroundColor: 'var(--surface-inset)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-1.5"
                        style={{ color: 'var(--text-muted)' }}
                        draggable
                        onDragStart={() => setDraggedTaskId(task.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Arrastrar ${task.title || 'tarea'} para reordenar`}
                      >
                        <GripVertical
                          size={15}
                          className="cursor-grab active:cursor-grabbing"
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-bold uppercase tracking-wider">
                          Tarea {index + 1}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onChange(tasks.filter((t) => t.id !== task.id))
                        }
                        aria-label={`Eliminar ${task.title || 'tarea'}`}
                        className="h-8 w-8 rounded-lg flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                        style={{
                          touchAction: 'manipulation',
                          color: 'var(--status-danger)',
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenIconTaskId(isIconOpen ? null : task.id)
                          }
                          aria-label={`Cambiar icono de ${task.title || 'tarea'}`}
                          className="w-12 h-12 rounded-xl border flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: 'var(--surface-card)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--accent-text)',
                          }}
                        >
                          <TaskIcon size={20} />
                        </button>

                        {isIconOpen && (
                          <div
                            className="absolute z-20 left-0 top-[calc(100%+6px)] grid grid-cols-4 gap-1 p-2 rounded-xl border shadow-xl w-44"
                            style={{
                              backgroundColor: 'var(--surface-card)',
                              borderColor: 'var(--border-subtle)',
                            }}
                          >
                            {CUSTOM_ICON_OPTIONS.map(({ name, label, Icon }) => (
                              <button
                                key={name}
                                type="button"
                                aria-label={label}
                                onClick={() => {
                                  updateTask(task.id, 'icon', name);
                                  setOpenIconTaskId(null);
                                }}
                                className="p-2 rounded-lg flex items-center justify-center cursor-pointer"
                                style={{
                                  touchAction: 'manipulation',
                                  backgroundColor:
                                    task.icon === name
                                      ? 'var(--accent-fill)'
                                      : 'transparent',
                                  color:
                                    task.icon === name
                                      ? 'var(--on-accent)'
                                      : 'var(--text-muted)',
                                }}
                              >
                                <Icon size={16} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <input
                          value={task.title}
                          autoFocus={index === tasks.length - 1 && task.title === ''}
                          onChange={(e) =>
                            updateTask(task.id, 'title', e.target.value)
                          }
                          aria-label="Nombre de la tarea"
                          placeholder="Nombre de la tarea"
                          className="w-full bg-transparent border-b pb-1 text-base font-semibold outline-none select-text"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <textarea
                          value={task.description}
                          onChange={(e) =>
                            updateTask(task.id, 'description', e.target.value)
                          }
                          aria-label="Explicación de la tarea"
                          placeholder="Explicá qué hay que hacer..."
                          rows={2}
                          className="w-full resize-none bg-transparent text-xs leading-relaxed outline-none select-text"
                          style={{ color: 'var(--text-muted)' }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  onChange([
                    ...tasks,
                    {
                      id: `task-${Date.now()}`,
                      title: '',
                      description: '',
                      icon: 'dumbbell',
                    },
                  ])
                }
                className="w-full min-h-[44px] rounded-2xl border border-dashed flex items-center justify-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98] cursor-pointer"
                style={{
                  touchAction: 'manipulation',
                  borderColor: 'var(--border-control)',
                  color: 'var(--accent-text)',
                }}
              >
                <Plus size={15} />
                Añadir tarea
              </button>
            </div>

            <footer
              className="shrink-0 px-5 py-4 border-t pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
              style={{ borderColor: 'var(--divider)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[46px] px-5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: 'var(--accent-fill)',
                  color: 'var(--on-accent)',
                }}
              >
                <Check size={17} strokeWidth={2.5} />
                Listo
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

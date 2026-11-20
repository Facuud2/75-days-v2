export type GoalCadence = 'daily' | 'weekly' | 'monthly';
export type GoalMeasurementType = 'boolean' | 'count' | 'numeric';

export interface PlanGoalDefinition {
  title: string;
  description: string;
  icon: string;
  cadence: GoalCadence;
  measurementType: GoalMeasurementType;
  targetValue: number;
  targetUnit?: string;
}

export const DEFAULT_GOALS: Record<'Soft' | 'Medium' | 'Hard', PlanGoalDefinition[]> = {
  Soft: [
    {
      title: 'Comer Saludable',
      description: 'Dieta saludable, alcohol únicamente en ocasiones sociales.',
      icon: 'utensils',
      cadence: 'daily',
      measurementType: 'boolean',
      targetValue: 1,
    },
    {
      title: 'Agua (3L)',
      description: 'Beber al menos 3 litros de agua.',
      icon: 'droplet',
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 3,
      targetUnit: 'L',
    },
    {
      title: 'Entrenamiento',
      description: '45 minutos de actividad física (6 sesiones por semana, 1 día de descanso).',
      icon: 'dumbbell',
      cadence: 'weekly',
      measurementType: 'count',
      targetValue: 6,
      targetUnit: 'sesiones',
    },
    {
      title: 'Lectura (10 págs)',
      description: 'Leer 10 páginas de cualquier libro.',
      icon: 'book',
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 10,
      targetUnit: 'págs',
    },
  ],
  Medium: [
    {
      title: 'Dieta Saludable',
      description: 'Seguir una dieta saludable. Sin alcohol.',
      icon: 'utensils',
      cadence: 'daily',
      measurementType: 'boolean',
      targetValue: 1,
    },
    {
      title: 'Entrenamiento',
      description: '45 minutos de actividad física.',
      icon: 'dumbbell',
      cadence: 'daily',
      measurementType: 'boolean',
      targetValue: 1,
    },
    {
      title: 'Lectura (10 págs)',
      description: 'Leer 10 páginas de cualquier libro.',
      icon: 'book',
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 10,
      targetUnit: 'págs',
    },
    {
      title: 'Fotos de Progreso',
      description: 'Tomar 4 fotos de progreso a la semana.',
      icon: 'camera',
      cadence: 'weekly',
      measurementType: 'count',
      targetValue: 4,
      targetUnit: 'fotos',
    },
  ],
  Hard: [
    {
      title: 'Dieta Estricta',
      description: 'Seguir una dieta sin comidas trampa ni alcohol.',
      icon: 'utensils',
      cadence: 'daily',
      measurementType: 'boolean',
      targetValue: 1,
    },
    {
      title: 'Primer Entrenamiento',
      description: '45 minutos de actividad física.',
      icon: 'dumbbell',
      cadence: 'daily',
      measurementType: 'boolean',
      targetValue: 1,
    },
    {
      title: 'Segundo Entrenamiento',
      description: '45 minutos, debe ser al aire libre.',
      icon: 'sun',
      cadence: 'daily',
      measurementType: 'boolean',
      targetValue: 1,
    },
    {
      title: 'Agua (3.7L)',
      description: 'Beber un galón (aprox. 3.7 litros) de agua.',
      icon: 'droplet',
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 3.7,
      targetUnit: 'L',
    },
    {
      title: 'Lectura (10 págs)',
      description: 'Leer 10 páginas de un libro de no ficción.',
      icon: 'book',
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 10,
      targetUnit: 'págs',
    },
    {
      title: 'Foto de Progreso',
      description: 'Tomar una foto de progreso diaria.',
      icon: 'camera',
      cadence: 'daily',
      measurementType: 'boolean',
      targetValue: 1,
    },
  ],
};

export type Difficulty = 'Soft' | 'Medium' | 'Hard' | 'Custom';

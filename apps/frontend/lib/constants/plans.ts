export const DEFAULT_GOALS = {
    Soft: [
        { title: 'Comer Saludable', description: 'Dieta saludable, alcohol únicamente en ocasiones sociales.', icon: 'utensils' },
        { title: 'Agua (3L)', description: 'Beber al menos 3 litros de agua.', icon: 'droplet' },
        { title: 'Entrenamiento', description: '45 minutos de actividad física (1 día de descanso por semana).', icon: 'dumbbell' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de cualquier libro.', icon: 'book' }
    ],
    Medium: [
        { title: 'Dieta Saludable', description: 'Seguir una dieta saludable. Sin alcohol.', icon: 'utensils' },
        { title: 'Entrenamiento', description: '45 minutos de actividad física.', icon: 'dumbbell' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de cualquier libro.', icon: 'book' },
        { title: 'Fotos de Progreso', description: 'Tomar 3-4 fotos de progreso a la semana.', icon: 'camera' }
    ],
    Hard: [
        { title: 'Dieta Estricta', description: 'Seguir una dieta sin comidas trampa ni alcohol.', icon: 'utensils' },
        { title: 'Primer Entrenamiento', description: '45 minutos de actividad física.', icon: 'dumbbell' },
        { title: 'Segundo Entrenamiento', description: '45 minutos, debe ser al aire libre.', icon: 'sun' },
        { title: 'Agua (3.7L)', description: 'Beber un galón (aprox. 3.7 litros) de agua.', icon: 'droplet' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro de no ficción.', icon: 'book' },
        { title: 'Foto de Progreso', description: 'Tomar una foto de progreso diaria.', icon: 'camera' }
    ],
};

export type Difficulty = 'Soft' | 'Medium' | 'Hard' | 'Custom';

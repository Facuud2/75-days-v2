export const DEFAULT_GOALS = {
    Soft: [
        { title: 'Agua (2L)', description: 'Beber al menos 2 litros de agua.', icon: 'droplet' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro.', icon: 'book' },
        { title: 'Entrenamiento', description: '30 minutos de actividad física.', icon: 'dumbbell' }
    ],
    Medium: [
        { title: 'Agua (3L)', description: 'Beber al menos 3 litros de agua.', icon: 'droplet' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro.', icon: 'book' },
        { title: 'Entrenamiento', description: '45 minutos de actividad física.', icon: 'dumbbell' },
        { title: 'Dieta', description: 'Seguir una dieta saludable.', icon: 'utensils' }
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

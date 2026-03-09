import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding SideQuestTemplates...');

    const templates = [
        {
            title: 'Beber 3L de Agua',
            difficulty: 'Easy',
            durationDays: 7,
            icon: 'droplet',
            description: 'Mantente hidratado bebiendo al menos 3 litros de agua durante 7 días.'
        },
        {
            title: 'Caminar 10,000 Pasos',
            difficulty: 'Medium',
            durationDays: 14,
            icon: 'dumbbell',
            description: 'Aumenta tu actividad diaria caminando 10,000 pasos por dos semanas.'
        },
        {
            title: 'Leer 20 Páginas',
            difficulty: 'Easy',
            durationDays: 30,
            icon: 'book',
            description: 'Fomenta el hábito de la lectura leyendo todos los días.'
        },
        {
            title: 'Meditar 10 Minutos',
            difficulty: 'Medium',
            durationDays: 21,
            icon: 'sun',
            description: 'Mejora tu enfoque y reduce el estrés con meditación diaria.'
        },
        {
            title: 'Dormir 8 Horas',
            difficulty: 'Hard',
            durationDays: 7,
            icon: 'moon',
            description: 'Prioriza tu descanso durmiendo entre 7 y 8 horas cada noche.'
        },
        {
            title: 'Sin Azúcar Añadida',
            difficulty: 'Hard',
            durationDays: 14,
            icon: 'target',
            description: 'Evita consumir alimentos o bebidas con azúcares añadidos.'
        },
        // Onboarding additional maps
        {
            title: '10k Steps Daily',
            difficulty: 'Medium',
            durationDays: 30,
            icon: 'dumbbell',
            description: 'Caminar 10,000 pasos diarios por 30 días.'
        },
        {
            title: 'Intermittent Fasting (16:8)',
            difficulty: 'Hard',
            durationDays: 14,
            icon: 'target',
            description: 'Ayuno intermitente 16 horas con ventana de 8 horas para comer.'
        },
        {
            title: 'Meditation 10m',
            difficulty: 'Easy',
            durationDays: 21,
            icon: 'sun',
            description: 'Medita 10 minutos cada día.'
        }
    ];

    for (const t of templates) {
        await prisma.sideQuestTemplate.upsert({
            where: { title: t.title },
            update: t,
            create: t,
        });
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

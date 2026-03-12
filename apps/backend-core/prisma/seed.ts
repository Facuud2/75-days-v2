import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding SideQuestTemplates...');

    const templates = [
        {
            title: 'Sin Azúcar Añadida',
            difficulty: 'Hard',
            durationDays: 21,
            icon: 'target',
            description: 'Abstenerse completamente de ingerir alimentos o bebidas con azúcares añadidos por 21 días.'
        },
        {
            title: 'Ducha de Agua Fría',
            difficulty: 'Medium',
            durationDays: 14,
            icon: 'droplet',
            description: 'Comienza tu mañana con una ducha completamente fría durante 3 minutos.'
        },
        {
            title: 'Mediatción Profunda',
            difficulty: 'Easy',
            durationDays: 30,
            icon: 'sun',
            description: 'Medita 15 minutos en silencio total al iniciar el día.'
        },
        {
            title: '12k Pasos Diarios',
            difficulty: 'Medium',
            durationDays: 30,
            icon: 'dumbbell',
            description: 'Recorre un total de 12,000 pasos en el día para mantenerte en movimiento.'
        },
        {
            title: 'Desconexión Digital',
            difficulty: 'Hard',
            durationDays: 7,
            icon: 'moon',
            description: 'Cero pantallas (celular, tv, pc) al menos 1 hora antes de dormir.'
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

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding SideQuestTemplates...');

    // Upsert por título: no borra plantillas que hayan agregado otros seeds
    // ni las que el usuario haya creado. El seed es idempotente.

    const templates = [
        {
            title: 'Detox de Azúcar (Sugar-Free)',
            difficulty: 'Medium',
            durationDays: 21,
            icon: 'apple',
            tasks: [
                { title: 'Evitar golosinas, repostería, helados y gaseosas azucaradas', description: 'No consumir azúcar añadido durante el día.', icon: 'apple', frequency: 'daily' },
                { title: 'No añadir azúcar ni endulzantes a las infusiones', description: 'Café, té y mate sin azúcar agregada.', icon: 'droplet', frequency: 'daily' },
                { title: 'Registrar cómo te sentiste sin azúcar', description: 'Anota brevemente tu energía o antojos.', icon: 'book', frequency: 'daily' },
            ],
            description: 'Rompe la dependencia de los alimentos ultraprocesados, estabiliza tus niveles de energía y reduce la inflamación eliminando el azúcar añadido de tu dieta.\n\nReglas Clave:\n- Cero consumo de golosinas, repostería, helados o gaseosas azucaradas.\n- Prohibido añadir azúcar blanca, rubia o endulzantes artificiales a las infusiones (café, té, mate).\n- Nota aclaratoria: El azúcar naturalmente presente en alimentos enteros (como las frutas) sí está permitido.\n\nMini-logros (Milestones):\n- Día 7: Superando el pico de abstinencia.\n- Día 14: Energía estabilizada.\n- Día 21: Paladar reiniciado (¡Completado!).'
        },
        {
            title: 'Caminante Constante (8K Steps)',
            difficulty: 'Medium',
            durationDays: 45,
            icon: 'footprints',
            tasks: [
                { title: 'Alcanzar 8.000 pasos', description: 'Completa el objetivo antes de la medianoche.', icon: 'footprints', frequency: 'daily', targetValue: 8000, targetUnit: 'pasos' },
                { title: 'Registrar el total de pasos', description: 'Usa tu teléfono, reloj o aplicación de actividad.', icon: 'clock', frequency: 'daily', targetUnit: 'pasos' },
            ],
            description: 'Combate el sedentarismo e incorpora el movimiento natural a tu rutina diaria para fortalecer tu sistema cardiovascular sin necesidad de ir a un gimnasio.\n\nReglas Clave:\n- Acumular un mínimo de 8,000 pasos todos los días antes de la medianoche.\n- Se debe utilizar una app externa (como Google Fit, Apple Health) o un smartwatch para validar el conteo de forma personal.\n- Son válidos los pasos por caminata, trote o movimiento general en casa/trabajo.\n\nMini-logros (Milestones):\n- Día 15: Hábito en formación (Equivalente a 120,000 pasos acumulados).\n- Día 30: Resistencia mejorada.\n- Día 45: Caminante incansable (¡Completado!).'
        },
        {
            title: 'Maestría Metabólica (Ayuno 12/12)',
            difficulty: 'Hard',
            durationDays: 60,
            icon: 'clock',
            tasks: [
                { title: 'Cumplir 12 horas de ayuno', description: 'Mantén una ventana diaria de ayuno ininterrumpido.', icon: 'clock', frequency: 'daily', targetValue: 12, targetUnit: 'horas' },
                { title: 'Consumir solo bebidas permitidas durante el ayuno', description: 'Agua, té, mate o café negro sin endulzantes.', icon: 'droplet', frequency: 'daily' },
                { title: 'Registrar horario de inicio y finalización', description: 'Deja constancia de tu ventana de ayuno.', icon: 'book', frequency: 'daily' },
            ],
            description: 'Dale a tu sistema digestivo el descanso que necesita, promueve la regeneración celular y optimiza tu reloj biológico regulando tus horarios de comida.\n\nReglas Clave:\n- Mantener una ventana de ayuno estricto e ininterrumpido de al menos 12 horas diarias (ejemplo: cenar a las 20:00 hs y desayunar a las 08:00 hs).\n- Durante las horas de ayuno, la ingesta calórica debe ser estrictamente cero.\n- Solo se permite consumir agua, té, mate o café negro (sin leche ni endulzantes) durante el período de ayuno.\n\nMini-logros (Milestones):\n- Día 20: Adaptación digestiva superada.\n- Día 40: Control total de la saciedad.\n- Día 60: Maestro del tiempo (¡Completado!).'
        }
    ];

    for (const t of templates) {
        const { tasks, ...templateData } = t;
        const template = await prisma.sideQuestTemplate.upsert({
            where: { title: t.title },
            update: templateData,
            create: templateData,
        });
        for (const [index, task] of tasks.entries()) {
            await prisma.sideQuestTaskTemplate.upsert({
                where: { id: `${template.id}-${index + 1}` },
                update: { ...task, order: index },
                create: { id: `${template.id}-${index + 1}`, templateId: template.id, ...task, order: index },
            });
        }
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

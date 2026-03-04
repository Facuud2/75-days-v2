import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const getProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                challenges: {
                    include: {
                        dailyLogs: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Calculate statistics based on User and Challenge logs
        let totalChallengesCompleted = 0;
        let totalDaysCompleted = 0;
        let totalWeightLost = 0;

        let bestWeight = user.weight || 0;
        const initialWeight = user.weight || 0;

        const weightHistory: Array<{ date: string, weight: number }> = [];

        // Push initial weight if exists (optional, keeping it clean by only using logs for actual progression)
        if (initialWeight > 0) {
            // Provide a mock start date "Inicio" for the initial dot
            weightHistory.push({ date: 'Inicio', weight: initialWeight });
        }

        for (const challenge of user.challenges) {
            totalChallengesCompleted += challenge.challengesCompleted;

            // Count successful days from logs
            const successfulLogs = challenge.dailyLogs.filter(log => log.status === 'success');
            totalDaysCompleted += successfulLogs.length;

            for (const log of challenge.dailyLogs) {
                if (log.weight) {
                    if (bestWeight === 0 || log.weight < bestWeight) {
                        bestWeight = log.weight;
                    }

                    // Add weight history point formatted to MM/dd
                    try {
                        const dateObj = new Date(log.date);
                        // Since our 'date' field in Prisma is a string like "YYYY-MM-DD",
                        // parsing it directly with Date() or slicing it is safe.
                        const fmtDate = log.date.substring(5).replace('-', '/'); // "MM/DD"
                        weightHistory.push({ date: fmtDate, weight: log.weight });
                    } catch (e) {
                        weightHistory.push({ date: log.date.substring(5), weight: log.weight });
                    }
                }
            }
        }

        totalWeightLost = Math.max(0, initialWeight - bestWeight);

        // Mocked global stats (like calories, hours, distance) could also be generated or hardcoded, 
        // depending on what exists in the DB. Given the schema, we lack these fields, so we return 0 
        // to have the frontend deal with them.

        // Sort history by date logic
        weightHistory.sort((a, b) => {
            if (a.date === 'Inicio') return -1;
            if (b.date === 'Inicio') return 1;
            return a.date.localeCompare(b.date);
        });

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                registeredAt: user.registeredAt,
                initialWeight: initialWeight,
                currentWeight: bestWeight || initialWeight,
                targetWeight: user.targetWeight || 0,
                weightHistory,
            },
            stats: {
                totalChallengesCompleted,
                totalDaysCompleted,
                totalWeightLost,
            }
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

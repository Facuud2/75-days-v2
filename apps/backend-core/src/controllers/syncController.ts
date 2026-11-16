import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { reconcileAndGetActiveChallenge } from '../utils/dailyReset';
import { questInclude, serializeQuest } from './questController';
import { buildUserProfilePayload } from './userController';

/**
 * GET /api/sync
 * Unified 1-round-trip synchronization endpoint (appManifestV2 pattern).
 * Returns the reconciled active challenge (including daily reset + logs),
 * active/completed side quests, available side quest templates, and optionally
 * the user's profile + achievements in a single parallelized response.
 */
export const getCoreSync = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const includeProfile = String(req.query?.includeProfile) === 'true';

        const [challenge, rawQuests, availableQuests, profile] = await Promise.all([
            reconcileAndGetActiveChallenge(userId, req.query?.timezoneOffset),
            prisma.sideQuest.findMany({
                where: { userId },
                orderBy: { startedAt: 'desc' },
                include: questInclude,
            }),
            prisma.sideQuestTemplate.findMany({
                orderBy: { durationDays: 'asc' },
                include: { tasks: { orderBy: { order: 'asc' } } },
            }),
            includeProfile ? buildUserProfilePayload(userId) : Promise.resolve(null),
        ]);

        res.json({
            syncVersion: 1,
            challenge,
            quests: rawQuests.map(serializeQuest),
            availableQuests,
            profile,
        });
    } catch (error) {
        console.error('Error in getCoreSync:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

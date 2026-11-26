import { getCorePrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { reconcileAndGetActiveChallenge } from '../../utils/dailyReset';
import {
  deduplicateSerializedQuests,
  fetchCachedAvailableQuestTemplates,
  questInclude,
  serializeQuest,
} from './questController';
import { buildUserProfilePayload } from './userController';

export const getCoreSync = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;
    const includeProfile = String(req.query?.includeProfile) === 'true';

    const [challenge, rawQuests, availableQuests, profile] = await Promise.all([
      reconcileAndGetActiveChallenge(userId, req.query?.timezoneOffset),
      prisma.sideQuest.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        include: questInclude,
      }),
      fetchCachedAvailableQuestTemplates(),
      includeProfile ? buildUserProfilePayload(userId) : Promise.resolve(null),
    ]);

    return res.json({
      syncVersion: 1,
      challenge,
      quests: deduplicateSerializedQuests(
        rawQuests.map((q) => serializeQuest(q, req.query?.timezoneOffset))
      ),
      availableQuests,
      profile,
    });
  } catch (error) {
    console.error('[syncController.getCoreSync]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { aiRateLimit } from '../middlewares/rateLimit';
import { generateCustomPlan, generateSideQuest } from '../controllers/aiController';

const router = Router();

router.use(authenticate);
router.use(aiRateLimit);

router.post('/custom-plan', generateCustomPlan);
router.post('/side-quest', generateSideQuest);

export default router;

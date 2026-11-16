import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { aiRateLimit } from '../middlewares/rateLimit';
import { generateCustomPlan } from '../controllers/aiController';

const router = Router();

router.use(authenticate);
router.use(aiRateLimit);

router.post('/custom-plan', generateCustomPlan);

export default router;

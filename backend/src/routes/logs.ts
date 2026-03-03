import { Router } from 'express';
import { getLogs, updateGoalStatus, updateMetrics, checkDailyReset } from '../controllers/logController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getLogs);
router.put('/:date/goal/:goalId', updateGoalStatus);
router.put('/:date/metrics', updateMetrics);
router.post('/check-reset', checkDailyReset);

export default router;

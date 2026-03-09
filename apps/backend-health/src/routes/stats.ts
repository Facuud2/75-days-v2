import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
    getDailyStats,
    getWeeklyStats,
    getMonthlyStats,
} from '../controllers/statsController';

const router = Router();

router.use(authenticate);

router.get('/daily/:date', getDailyStats);
router.get('/weekly', getWeeklyStats);   // ?startDate=YYYY-MM-DD
router.get('/monthly', getMonthlyStats);  // ?month=YYYY-MM

export default router;

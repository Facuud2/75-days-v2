import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
    getDailyStats,
    getWeeklyStats,
    getMonthlyStats,
} from '../controllers/statsController';

const router = Router();

router.use(authenticate);

router.get('/daily/:date', asyncHandler(getDailyStats));
router.get('/weekly', asyncHandler(getWeeklyStats));   // ?startDate=YYYY-MM-DD
router.get('/monthly', asyncHandler(getMonthlyStats));  // ?month=YYYY-MM

export default router;

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { externalApiRateLimit } from '../middlewares/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import {
    connectStrava,
    stravaCallback,
    getStravaStatus,
    syncStravaWorkouts
} from '../controllers/stravaController';

const router = Router();

// OAuth flow
router.get('/auth', authenticate, externalApiRateLimit, connectStrava);

// The callback comes from Strava, verified via signed OAuth state token
router.get('/callback', externalApiRateLimit, asyncHandler(stravaCallback));

// Protected routes
router.get('/status', authenticate, asyncHandler(getStravaStatus));
router.post('/sync', authenticate, externalApiRateLimit, asyncHandler(syncStravaWorkouts));

export default router;

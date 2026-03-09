import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
    connectStrava,
    stravaCallback,
    getStravaStatus,
    syncStravaWorkouts
} from '../controllers/stravaController';

const router = Router();

// OAuth flow
// This one generates the URL, doesn't necessarily need auth if done simply, but better to protect it
// Wait, connectStrava doesn't do anything with the user session yet as currently written, but usually we pass the user ID in the state. So we should authenticate the user BEFORE they redirect.
// We will call this from the frontend with the user's token.
router.get('/auth', authenticate, connectStrava);

// The callback comes from Strava, so it cannot have our JWT `authenticate` middleware
router.get('/callback', stravaCallback);

// Protected routes
router.get('/status', authenticate, getStravaStatus);
router.post('/sync', authenticate, syncStravaWorkouts);

export default router;

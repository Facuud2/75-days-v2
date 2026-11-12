import { Router } from 'express';
import { register, login, getMe, completeOnboarding, getOnboardingStatus } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authRateLimit } from '../middlewares/rateLimit';

const router = Router();

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.get('/me', authenticate, getMe);
router.patch('/complete-onboarding', authenticate, completeOnboarding);
router.get('/onboarding-status', authenticate, getOnboardingStatus);

export default router;

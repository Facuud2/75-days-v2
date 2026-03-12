import { Router } from 'express';
import { register, login, getMe, completeOnboarding, getOnboardingStatus } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.patch('/complete-onboarding', authenticate, completeOnboarding);
router.get('/onboarding-status', authenticate, getOnboardingStatus);

export default router;

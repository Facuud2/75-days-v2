import { Router } from 'express';
import { register, login, getMe, completeOnboarding } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.patch('/complete-onboarding', authenticate, completeOnboarding);

export default router;

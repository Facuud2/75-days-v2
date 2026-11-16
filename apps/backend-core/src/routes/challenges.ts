import { Router } from 'express';
import { getCurrentChallenge, startChallenge, abandonChallenge, updateCustomGoals } from '../controllers/challengeController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/current', getCurrentChallenge);
router.post('/start', startChallenge);
router.post('/abandon', abandonChallenge);
router.patch('/current/custom-goals', updateCustomGoals);

export default router;

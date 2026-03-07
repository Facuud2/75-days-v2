import { Router } from 'express';
import { getCurrentChallenge, startChallenge, abandonChallenge } from '../controllers/challengeController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/current', getCurrentChallenge);
router.post('/start', startChallenge);
router.post('/abandon', abandonChallenge);

export default router;

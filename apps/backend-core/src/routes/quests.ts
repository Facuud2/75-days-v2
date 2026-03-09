import { Router } from 'express';
import { getQuests, addQuest, progressQuest, getAvailableQuests } from '../controllers/questController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getQuests);
router.get('/available', getAvailableQuests);
router.post('/', addQuest);
router.put('/:id/progress', progressQuest);

export default router;

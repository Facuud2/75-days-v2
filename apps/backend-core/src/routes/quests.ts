import { Router } from 'express';
import { getQuests, addQuest, progressQuest, getAvailableQuests, toggleQuestTask, restartQuest } from '../controllers/questController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getQuests);
router.get('/available', getAvailableQuests);
router.post('/', addQuest);
router.put('/:id/progress', progressQuest);
router.patch('/:id/tasks/:taskId', toggleQuestTask);
router.post('/:id/restart', restartQuest);

export default router;

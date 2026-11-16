import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { getHealthSync } from '../controllers/syncController';

const router = Router();

router.use(authenticate);
router.get('/:date', getHealthSync);

export default router;

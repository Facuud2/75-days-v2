import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { getCoreSync } from '../controllers/syncController';

const router = Router();

router.use(authenticate);
router.get('/', getCoreSync);

export default router;

import { Router } from 'express';
import { internalAuth } from '../middlewares/internalAuth';
import { getInternalSummary } from '../controllers/internalController';

const router = Router();

// All internal routes require the x-internal-api-key header
router.use(internalAuth);

router.get('/summary/:userId/:date', getInternalSummary);

export default router;

import { Router } from 'express';
import { internalAuth } from '../middlewares/internalAuth';
import { asyncHandler } from '../utils/asyncHandler';
import { getInternalSummary } from '../controllers/internalController';

const router = Router();

// All internal routes require the x-internal-api-key header
router.use(internalAuth);

router.get('/summary/:userId/:date', asyncHandler(getInternalSummary));

export default router;

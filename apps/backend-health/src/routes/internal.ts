import { Router } from 'express';
import { internalAuth } from '../middlewares/internalAuth';
import { asyncHandler } from '../utils/asyncHandler';
import {
    deleteInternalUserData,
    exportInternalUserData,
    getInternalSummary,
} from '../controllers/internalController';

const router = Router();

// All internal routes require the x-internal-api-key header
router.use(internalAuth);

router.get('/summary/:userId/:date', asyncHandler(getInternalSummary));
router.delete('/users/:userId', asyncHandler(deleteInternalUserData));
router.get('/users/:userId/export', asyncHandler(exportInternalUserData));

export default router;

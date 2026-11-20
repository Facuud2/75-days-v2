import { Router } from 'express';
import {
    getProfile,
    updateProfile,
    updatePassword,
    deleteAccount,
    exportUserData,
} from '../controllers/userController';
import { authenticate } from '../middlewares/auth';
import { sensitiveAccountRateLimit } from '../middlewares/rateLimit';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/export', authenticate, sensitiveAccountRateLimit, exportUserData);
router.put('/password', authenticate, sensitiveAccountRateLimit, updatePassword);
router.delete('/account', authenticate, sensitiveAccountRateLimit, deleteAccount);

export default router;

import { Router } from 'express';
import { getProfile, updateProfile, updatePassword, deleteAccount } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/password', authenticate, updatePassword);
router.delete('/account', authenticate, deleteAccount);

export default router;

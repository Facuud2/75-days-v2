import { Router } from 'express';
import { getProfile, updateProfile, updatePassword } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/password', authenticate, updatePassword);

export default router;

import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/me', authMiddleware, userController.getProfile);

export default router;

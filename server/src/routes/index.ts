import { Router } from 'express';
import authRoutes from './authRoutes.js';
import scoreRoutes from './scoreRoutes.js';
import userRoutes from './userRoutes.js';
import sessionRoutes from './sessionRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/scores', scoreRoutes);
router.use('/users', userRoutes);
router.use('/sessions', sessionRoutes);

export default router;

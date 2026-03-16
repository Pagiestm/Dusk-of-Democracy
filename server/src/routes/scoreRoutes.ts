import { Router } from 'express';
import { scoreController } from '../controllers/scoreController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/leaderboard', scoreController.getLeaderboard);
router.get('/me', authMiddleware, scoreController.getUserScores);

export default router;

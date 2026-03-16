import { Router } from 'express';
import { sessionController } from '../controllers/sessionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', authMiddleware, sessionController.create);
router.get('/:id', authMiddleware, sessionController.get);

export default router;

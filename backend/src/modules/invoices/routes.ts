import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { create, list, getById, retry } from './controller.js';

const router = Router();

// Secure all invoice operations behind JWT middleware
router.use(authenticate);

router.post('/', create);
router.get('/', list);
router.get('/:id', getById);
router.post('/:id/retry', retry);

export default router;
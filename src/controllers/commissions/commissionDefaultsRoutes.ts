import { Router, Request, Response } from 'express';
import { CommissionDefaultsController } from './CommissionDefaultsController';
import { handleOverLoad } from '../../hooks/helper';

const router = Router();
router.get('/api/v1/commission-defaults', handleOverLoad(CommissionDefaultsController.getAll));
router.post('/api/v1/commission-defaults', handleOverLoad(CommissionDefaultsController.create));
router.put('/api/v1/commission-defaults/:id', handleOverLoad(CommissionDefaultsController.updateById));
export default router;

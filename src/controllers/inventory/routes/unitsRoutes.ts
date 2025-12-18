import { Router } from 'express';
import { UnitsController } from '../UnitsController';

const router = Router();
const unitsController = new UnitsController();

// Unit management routes
router.get('/units', (req, res) => unitsController.getAvailableUnits(req, res));
router.post('/units', (req, res) => unitsController.createCustomUnit(req, res));
router.get('/units/:unitId/validate', (req, res) => unitsController.validateUnit(req, res));

export default router;
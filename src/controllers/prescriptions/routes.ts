import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { pharmacyAccess } from '../pharmacy/pharmacyAccess.middleware';
import { PrescriptionController } from './PrescriptionController';

const router = Router();

router.use(checkTokenExists);

// Raised by a clinician during consultation; any authenticated clinical user may create or view one.
router.post('/prescriptions', PrescriptionController.createPrescription);
router.get('/prescriptions/:id', PrescriptionController.getPrescription);

// Fulfillment queue and dispensing actions are pharmacy-staff only.
router.get('/prescriptions', pharmacyAccess, PrescriptionController.listPrescriptions);
router.post('/prescriptions/:id/fulfill', pharmacyAccess, PrescriptionController.fulfillPrescription);
router.post('/prescriptions/:id/refer', pharmacyAccess, PrescriptionController.referRemaining);

export default router;

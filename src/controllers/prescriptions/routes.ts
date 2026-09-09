import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { pharmacyAccess, prescriptionListAccess } from '../pharmacy/pharmacyAccess.middleware';
import { PrescriptionController } from './PrescriptionController';

const router = Router();

router.use(checkTokenExists);

// Raised by a clinician during consultation; any authenticated clinical user may create or view one.
router.post('/prescriptions', PrescriptionController.createPrescription);
router.get('/prescriptions/:id', PrescriptionController.getPrescription);

// Fulfillment queue and dispensing actions are pharmacy-staff only. A clinician may list
// their OWN orders (clinicianId === their id) via prescriptionListAccess; the broad queue
// (no clinicianId, or someone else's) still requires pharmacyAccess.
router.get('/prescriptions', prescriptionListAccess, PrescriptionController.listPrescriptions);
router.post('/prescriptions/:id/fulfill', pharmacyAccess, PrescriptionController.fulfillPrescription);
router.post('/prescriptions/:id/refer', pharmacyAccess, PrescriptionController.referRemaining);

export default router;

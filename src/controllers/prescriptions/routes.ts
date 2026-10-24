import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { pharmacyAccess, pharmacySalesAccess, prescriptionListAccess } from '../pharmacy/pharmacyAccess.middleware';
import { PrescriptionController } from './PrescriptionController';
import { prescriptionCreateAccess, prescriptionDetailAccess, validatePrescriptionContext } from './prescriptionAccess';
import {enterprise} from '../pharmacy/PharmacyEnterpriseController';

const router = Router();

router.use(checkTokenExists);

// Raised by a clinician during consultation; any authenticated clinical user may create or view one.
router.post('/prescriptions', prescriptionCreateAccess, validatePrescriptionContext, PrescriptionController.createPrescription);
// Must precede /prescriptions/:id. Same self-or-pharmacy rule as the list.
router.get('/prescriptions/patients/search', prescriptionCreateAccess, PrescriptionController.searchPatients);
router.get('/prescriptions/summary', prescriptionListAccess, PrescriptionController.summarizePrescriptions);
router.get('/prescriptions/:id', prescriptionDetailAccess, PrescriptionController.getPrescription);
router.post('/prescriptions/:id/repeats',prescriptionCreateAccess,prescriptionDetailAccess,enterprise((s,r)=>s.clinical.authorizeRepeat(String(r.params.id),r.body)));
router.put('/prescriptions/link-consultation', prescriptionCreateAccess, validatePrescriptionContext, PrescriptionController.linkPrescriptionsToConsultation);

// Fulfillment queue and dispensing actions are pharmacy-staff only. A clinician may list
// their OWN orders (clinicianId === their id) via prescriptionListAccess; the broad queue
// (no clinicianId, or someone else's) still requires pharmacyAccess.
router.get('/prescriptions', prescriptionListAccess, PrescriptionController.listPrescriptions);
router.post('/prescriptions/:id/fulfill', pharmacySalesAccess, PrescriptionController.fulfillPrescription);
router.post('/prescriptions/:id/refer', pharmacyAccess, PrescriptionController.referRemaining);

export default router;

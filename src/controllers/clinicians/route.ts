import { Router } from "express";
import * as clinicianHandlers from "./cliniciansHandlers";
import { ClinicianPaymentHandler } from './ClinicianPaymentHandler';
import { handleOverLoad } from "../../hooks/helper";
const router = Router();

router.get("/api/v1/clinicians", handleOverLoad(clinicianHandlers.getCliniciansHandler));
router.get("/api/v1/clinicians/getclinician", handleOverLoad(clinicianHandlers.getSingleClinicianHandler));
router.put("/api/v1/clinicians", clinicianHandlers.putCliniciansHandler);
router.delete("/api/v1/clinicians", clinicianHandlers.deleteCliniciansHandler);
router.post("/api/v1/clinicians", clinicianHandlers.postCliniciansHandler);
router.post("/api/v1/client/filter/clinician", clinicianHandlers.filterClinicianHandler);
router.get("/api/v1/clinician/resultsets", clinicianHandlers.getClinicianResultHandler);
router.get("/api/v1/clinician/resultsets/billingid", clinicianHandlers.getBillingTestBasedByClinicianHandler);
router.post("/api/v1/orders/temporary", clinicianHandlers.postTemporaryOrderHandler);
router.get("/api/v1/orders/temporary", clinicianHandlers.getTemporaryOrdersHandler);
router.get("/api/v1/orders/temporary/processing", clinicianHandlers.getTemporaryOrdersProcessingHandler);
router.post("/api/v1/orders/processed", clinicianHandlers.postProcessedOrderHandler);



import {
  createBillingStrategy,
  getBillingStrategy,
  updateBillingStrategy,
  checkStrategyExists,
  deleteBillingStrategy,
  checkEntityHasStrategy,
  getEntityBillingStrategy,
  getAllBillingStrategies,
  addCategoryToStrategy,
  removeCategoryFromStrategy,
  getAllBillingStrategiesMini,
} from './billingStrategyHandler';

router.post('/api/v1/billing/strategies', handleOverLoad(createBillingStrategy));
router.get('/api/v1/billing/strategies/all', handleOverLoad(getAllBillingStrategies));
router.get('/api/v1/billing/strategies/all/mini', handleOverLoad(getAllBillingStrategiesMini));
router.get('/api/v1/billing/strategies/check/:strategyid', handleOverLoad(checkStrategyExists));
router.get('/api/v1/billing/strategies/:strategyid', handleOverLoad(getBillingStrategy));
router.put('/api/v1/billing/strategies/:strategyid', handleOverLoad(updateBillingStrategy));
router.delete('/api/v1/billing/strategies/:strategyid', handleOverLoad(deleteBillingStrategy));
router.get('/api/v1/billing/strategies/:entityType/:entityid/has-strategy', handleOverLoad(checkEntityHasStrategy));
router.get('/api/v1/billing/strategies/:entityType/:entityid', handleOverLoad(getEntityBillingStrategy));
router.post('/api/v1/billing/strategies/apply/strategy/entity/:strategyid', handleOverLoad(addCategoryToStrategy));
router.delete('/api/v1/billing/strategies/remove/entity/:strategyid', handleOverLoad(removeCategoryFromStrategy));


// payment routes of the clinicians

const clinicianPaymentHandler = new ClinicianPaymentHandler();

router.put('/api/v1/clinicians/payments/:id', (req, res) => clinicianPaymentHandler.createPayment(req, res));
router.get('/api/v1/clinicians/payments/:id', (req, res) => clinicianPaymentHandler.getPaymentById(req, res));
router.get('/api/v1/clinicians/payments/clinician/:clinicianId', (req, res) => clinicianPaymentHandler.getPaymentsByClinicianId(req, res));


export default router;

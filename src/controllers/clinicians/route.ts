import { Request, Response, Router } from "express";
import { assignStrategyOrganizationsHandler } from '../billing/StrategyOrganizationController';
import * as clinicianHandlers from "./cliniciansHandlers";
import { ClinicianPaymentHandler } from './ClinicianPaymentHandler';
import { handleOverLoad } from "../../hooks/helper";
import { checkTokenExists } from "../../middleware/validateTenancy";
import { linkClinicianOrganizationHandler, listClinicianOrganizationsHandler, unlinkClinicianOrganizationHandler } from './clinicianOrganizationHandlers';
const router = Router();

router.get("/api/v1/clinicians", handleOverLoad(clinicianHandlers.getCliniciansHandler));
router.get("/api/v1/clinicians/getclinician", handleOverLoad(clinicianHandlers.getSingleClinicianHandler));
// A clinician may refer from several organizations; the main one stays on the clinician profile.
router.get("/api/v1/clinicians/:clinicianId/organizations", handleOverLoad(listClinicianOrganizationsHandler));
router.post("/api/v1/clinicians/:clinicianId/organizations", handleOverLoad(linkClinicianOrganizationHandler));
router.delete("/api/v1/clinicians/:clinicianId/organizations/:organizationId", handleOverLoad(unlinkClinicianOrganizationHandler));
router.put("/api/v1/clinicians", clinicianHandlers.putCliniciansHandler);
router.delete("/api/v1/clinicians", clinicianHandlers.deleteCliniciansHandler);
router.post("/api/v1/clinicians", handleOverLoad(clinicianHandlers.verifyClinicianPhoneNumberAndEmailMiddleware), clinicianHandlers.postCliniciansHandler);
router.post("/api/v1/client/filter/clinician", clinicianHandlers.filterClinicianHandler);
router.get("/api/v1/clinician/resultsets", clinicianHandlers.getClinicianResultHandler);
router.get("/api/v1/clinician/resultsets/billingid", clinicianHandlers.getBillingTestBasedByClinicianHandler);
router.get("/api/v1/clinician/portal/requests", handleOverLoad(checkTokenExists), handleOverLoad(clinicianHandlers.getClinicianPortalRequestsHandler));
router.get("/api/v1/clinician/portal/requests/:ascensionid", handleOverLoad(checkTokenExists), handleOverLoad(clinicianHandlers.getClinicianPortalRequestDetailsHandler));
router.post("/api/v1/clinician/portal/requests/:ascensionid/comments", handleOverLoad(checkTokenExists), handleOverLoad(clinicianHandlers.updateClinicianPortalRequestCommentHandler));
router.post("/api/v1/orders/temporary", clinicianHandlers.postTemporaryOrderHandler);
router.get("/api/v1/orders/temporary", clinicianHandlers.getTemporaryOrdersHandler);
router.get("/api/v1/orders/temporary/processing", clinicianHandlers.getTemporaryOrdersProcessingHandler);
router.post("/api/v1/orders/processed", clinicianHandlers.postProcessedOrderHandler);

// Route to load all clinicians
router.get('/api/v1/clinicians/all', handleOverLoad(clinicianHandlers.getAllCliniciansHandler));
router.post('/api/v1/clinicians/bulk', handleOverLoad(clinicianHandlers.bulkInsertCliniciansHandler));



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
  getBillingModeCapability,
  getProvidentialBillingHandler,
  getEntityInfoUsingSpecialCode,
} from './billingStrategyHandler';
import { isAuthorizedRoleAdmin } from "../../middleware/validateTenancy";


router.get('/api/v1/billing/testpanel/strategies/panels/:entityType/:associatedid', handleOverLoad(getProvidentialBillingHandler));
router.post('/api/v1/billing/strategies', handleOverLoad(createBillingStrategy));
router.post('/api/v1/billing/strategies/:strategyid/organizations', handleOverLoad(assignStrategyOrganizationsHandler));
router.get('/api/v1/billing/strategies/all', handleOverLoad(getAllBillingStrategies));
router.get('/api/v1/billing/strategies/mode-capability', handleOverLoad(getBillingModeCapability));
router.get('/api/v1/billing/strategies/all/mini', handleOverLoad(getAllBillingStrategiesMini));
router.get('/api/v1/billing/strategies/check/:strategyid', handleOverLoad(checkStrategyExists));
router.get('/api/v1/billing/strategies/:strategyid', handleOverLoad(getBillingStrategy));
router.put('/api/v1/billing/strategies/:strategyid', handleOverLoad(updateBillingStrategy));
router.delete('/api/v1/billing/strategies/:strategyid', handleOverLoad(deleteBillingStrategy));
router.get('/api/v1/billing/strategies/:entityType/:entityid/has-strategy', handleOverLoad(checkEntityHasStrategy));
router.get('/api/v1/billing/strategies/:entityType/:entityid', handleOverLoad(getEntityBillingStrategy));
router.post('/api/v1/billing/strategies/apply/strategy/entity/:strategyid', handleOverLoad(addCategoryToStrategy));
router.delete('/api/v1/billing/strategies/remove/entity/:strategyid', handleOverLoad(removeCategoryFromStrategy));
router.get('/api/v1/billing/specialcodeinfo', handleOverLoad(getEntityInfoUsingSpecialCode));
// payment routes of the clinicians

const clinicianPaymentHandler = new ClinicianPaymentHandler();

router.put('/api/v1/clinicians/payments/:id', isAuthorizedRoleAdmin, (req, res) => clinicianPaymentHandler.createPayment(req, res));
router.get('/api/v1/clinicians/payments/:id', handleOverLoad((req: Request<{ id: string }, any, any, { tenantId: string }>, res: Response) => clinicianPaymentHandler.getPaymentById(req, res)));
router.get('/api/v1/clinicians/payments/clinician/:clinicianId', handleOverLoad((req: Request<{ clinicianId: string }, any, any, { tenantId: string }>, res: Response) => clinicianPaymentHandler.getPaymentsByClinicianId(req, res)));


export default router;

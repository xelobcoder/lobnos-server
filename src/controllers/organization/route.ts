import { getAuthUser } from '../../middleware/authority';
import { labSupervisor } from '../../models/operations/LabAccessPolicy';
import express from 'express'
import {
     createOrganizationOutSource, updateOrganizationOutSource, updateOrganizationOutSourceServices, getOrganizationOutSourceServices, getOrganizationOutSourceBasic, getOrganizationOutsourcingAll, checkIsServiceRenderedByOutsourceOrganization,
     getOutsourcedTestBasedStageHandler,
     updateToResolveOutsourcedHandler,
     updateTestPanelOutsourcingInformation, getTestOutSourcingOrganizations,
     getOutsourcedCasesPaginated
} from "./outsourceHandlers"
import { organizationImageUpload } from './uploadImages'
import {
     bulkInsertOrganizationsHandler, createAOrganization, createOrganizationPricingHandler,
     deleteOrganization, getOrganizationCommission, getOrganizationId, getOrganizationImage, getOrganizationPricingHandler, getOrganizations, getOrganizationsBasic, getOrganizationsContact, getOrganizationsPayment, getOrganizationsCommissionByDate, getOrganizationWithDetails, updateOrganizationBasic, updateOrganizationContact, updateOrganizationPayment, upload, uploadOrganizationProfilePicture
} from './handlers';
import { handleOverLoad } from '../../hooks/helper';
import { checkTokenExists, isAuthorizedRoleAdmin } from '../../middleware/validateTenancy';
import { ReferralCodeController } from './ReferralCodeController';
import { quickAddClinicianHandler, quickAddOrganizationHandler } from './quickAddReferralHandlers';


const router = express.Router();
const configureOutsource: express.RequestHandler = (req, res, next) => { const actor = getAuthUser(req); if (!actor || !labSupervisor(actor)) return res.status(403).json({ status: false, message: 'Supervisor access is required for outsourcing configuration' }); if (req.body) req.body.employeeid = actor.employeeid; next(); };

router.get('/api/v1/organization/referral-codes', checkTokenExists, ReferralCodeController.authorizeRead, handleOverLoad(ReferralCodeController.list));
// Name-only quick add from the billing page; phone and email are optional.
router.post('/api/v1/organization/quick-add', handleOverLoad(quickAddOrganizationHandler));
router.post('/api/v1/clinicians/quick-add', handleOverLoad(quickAddClinicianHandler));

router.get("/api/v1/organization", handleOverLoad(getOrganizations));
router.get("/api/v1/organization/basic", handleOverLoad(getOrganizationsBasic));
router.get("/api/v1/organization/contactperson", handleOverLoad(getOrganizationsContact));
router.get("/api/v1/organization/payment", handleOverLoad(getOrganizationsPayment));
router.get("/api/v1/organization/commission/summary", handleOverLoad(getOrganizationsCommissionByDate));
router.get("/api/v1/organization/commission", handleOverLoad(getOrganizationCommission));
router.get(`/api/v1/organization/profile/image`, handleOverLoad(getOrganizationImage));
router.get("/api/v1/organization/id", handleOverLoad(getOrganizationId));
router.get("/api/v1/organizations/details", handleOverLoad(getOrganizationWithDetails));
router.post("/api/v1/new/organizations", handleOverLoad(createAOrganization));
router.put("/api/v1/organization/update/basic", handleOverLoad(updateOrganizationBasic));
router.put("/api/v1/organization/update/contact", handleOverLoad(updateOrganizationContact));
router.put("/api/v1/organization/update/payment", handleOverLoad(updateOrganizationPayment));
router.post("/api/v1/new/organization/images", handleOverLoad(upload));
router.delete("/api/v1/organization", isAuthorizedRoleAdmin, handleOverLoad(deleteOrganization));
router.post(`/api/v1/organization/profile/image`, organizationImageUpload, handleOverLoad(uploadOrganizationProfilePicture));
router.post("/api/v1/organization/billing/test", handleOverLoad(createOrganizationPricingHandler))
router.get("/api/v1/organization/billing/test", handleOverLoad(getOrganizationPricingHandler))
router.post('/api/v1/organization/bulk/registration', handleOverLoad(bulkInsertOrganizationsHandler))



// ROUTES FOR OUTSOURCING ORGANIZATIONS
router.post("/api/v1/outsourcing/organization", configureOutsource, createOrganizationOutSource);
router.put("/api/v1/outsourcing/organization/services", configureOutsource, updateOrganizationOutSourceServices);
router.put("/api/v1/outsourcing/organization", configureOutsource, updateOrganizationOutSource);
router.get("/api/v1/outsourcing/organization/services", getOrganizationOutSourceServices);
router.get("/api/v1/outsourcing/organization/all", getOrganizationOutsourcingAll);
// router.post("/api/v1/outsourcing/organization", );
router.get("/api/v1/outsourcing/organization", getOrganizationOutSourceBasic)
router.get("/api/v1/outsourcing/organization/check/test", checkIsServiceRenderedByOutsourceOrganization)
router.put('/api/v1/outsourcing/organization/testpanel/outsourceinfo/update', updateTestPanelOutsourcingInformation)
router.get('/api/v1/outsourcing/organization/testpanel/outsourceinfo', getTestOutSourcingOrganizations)
router.get('/api/v1/outsourced/testpanel/:stage?', getOutsourcedTestBasedStageHandler)
router.post("/api/v1/outsourced/testpanel/resolve", handleOverLoad(updateToResolveOutsourcedHandler))

// routes for outsourced cases tracking
router.get("/api/v1/outsourced/cases/tracking", getOutsourcedCasesPaginated);

export default router
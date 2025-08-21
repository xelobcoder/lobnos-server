import express from 'express'
import {
     createOrganizationOutSource, updateOrganizationOutSource, updateOrganizationOutSourceServices, getOrganizationOutSourceServices, getOrganizationOutSourceBasic, getOrganizationOutsourcingAll, checkIsServiceRenderedByOutsourceOrganization,
     getOutsourcedTestBasedStageHandler,
     updateToResolveOutsourcedHandler,
     updateTestPanelOutsourcingInformation, getTestOutSourcingOrganizations,
     getOutsourcedCasesPaginated
} from "./outsourceHandlers"
import { organizationImageUpload } from './uploadImages'
import { bulkInsertOrganizationsHandler, createAOrganization, createOrganizationPricingHandler, dailyOrganizationCommission, deleteOrganization, generateMonthlySalesReport, getOrganizationCommissionByMonth, getOrganizationId, getOrganizationImage, getOrganizationPricingHandler, getOrganizations, getOrganizationsBasic, getOrganizationsContact, getOrganizationsPayment, getOrganizationWithDetails, getTopPerformance, updateOrganizationBasic, updateOrganizationContact, updateOrganizationPayment, upload, uploadOrganizationProfilePicture } from './handlers';
import { handleOverLoad } from '../../hooks/helper';


const router = express.Router();

router.get("/api/v1/organization", getOrganizations);
router.get("/api/v1/organization/basic", getOrganizationsBasic);
router.get("/api/v1/organization/contactperson", getOrganizationsContact);
router.get("/api/v1/organization/payment", getOrganizationsPayment);
router.get("/api/v1/organization/daily", dailyOrganizationCommission);
router.get("/api/v1/organization/monthly", getOrganizationCommissionByMonth);
router.get(`/api/v1/organization/profile/image`, getOrganizationImage)
router.get("/api/v1/organization/id", getOrganizationId);
router.get("/api/v1/organization/performance/top", getTopPerformance);
router.get("/api/v1/organization/detail/report/monthly", generateMonthlySalesReport);
router.get("/api/v1/organizations/details", getOrganizationWithDetails);
router.post("/api/v1/new/organizations", handleOverLoad(createAOrganization));
router.put("/api/v1/organization/update/basic", updateOrganizationBasic);
router.put("/api/v1/organization/update/contact", updateOrganizationContact);
router.put("/api/v1/organization/update/payment", updateOrganizationPayment);
router.post("/api/v1/new/organization/images", upload);
router.delete("/api/v1/organization", deleteOrganization);
router.post(`/api/v1/organization/profile/image`, organizationImageUpload, uploadOrganizationProfilePicture);
router.post("/api/v1/organization/billing/test", handleOverLoad(createOrganizationPricingHandler))
router.get("/api/v1/organization/billing/test", getOrganizationPricingHandler)
router.post('/api/v1/organization/bulk/registration', handleOverLoad(bulkInsertOrganizationsHandler))



// ROUTES FOR OUTSOURCING ORGANIZATIONS



router.post("/api/v1/outsourcing/organization", createOrganizationOutSource);
router.put("/api/v1/outsourcing/organization/services", updateOrganizationOutSourceServices);
router.put("/api/v1/outsourcing/organization", updateOrganizationOutSource);
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
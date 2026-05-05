import express from 'express'
import {
     createOrganizationOutSource, updateOrganizationOutSource, updateOrganizationOutSourceServices, getOrganizationOutSourceServices, getOrganizationOutSourceBasic, getOrganizationOutsourcingAll, checkIsServiceRenderedByOutsourceOrganization,
     getOutsourcedTestBasedStageHandler,
     updateToResolveOutsourcedHandler,
     updateTestPanelOutsourcingInformation, getTestOutSourcingOrganizations,
     getOutsourcedCasesPaginated
} from "./outsourceHandlers"
import { organizationImageUpload } from './uploadImages'
import { bulkInsertOrganizationsHandler, createAOrganization, createOrganizationPricingHandler, dailyOrganizationCommission, deleteOrganization, generateMonthlySalesReport, getOrganizationCommission, getOrganizationCommissionByMonth, getOrganizationId, getOrganizationImage, getOrganizationPricingHandler, getOrganizations, getOrganizationsBasic, getOrganizationsContact, getOrganizationsPayment, getOrganizationsCommissionByDate, getOrganizationWithDetails, getTopPerformance, updateOrganizationBasic, updateOrganizationContact, updateOrganizationPayment, upload, uploadOrganizationProfilePicture } from './handlers';
import { handleOverLoad } from '../../hooks/helper';
import { isAuthorizedRoleAdmin } from '../../middleware/validateTenancy';


const router = express.Router();

router.get("/api/v1/organization", handleOverLoad(getOrganizations));
router.get("/api/v1/organization/basic", handleOverLoad(getOrganizationsBasic));
router.get("/api/v1/organization/contactperson", handleOverLoad(getOrganizationsContact));
router.get("/api/v1/organization/payment", handleOverLoad(getOrganizationsPayment));
router.get("/api/v1/organization/daily", handleOverLoad(dailyOrganizationCommission));
router.get("/api/v1/organization/monthly", handleOverLoad(getOrganizationCommissionByMonth));
router.get("/api/v1/organization/commission/summary", handleOverLoad(getOrganizationsCommissionByDate));
router.get("/api/v1/organization/commission", handleOverLoad(getOrganizationCommission));
router.get(`/api/v1/organization/profile/image`, handleOverLoad(getOrganizationImage));
router.get("/api/v1/organization/id", handleOverLoad(getOrganizationId));
router.get("/api/v1/organization/performance/top", handleOverLoad(getTopPerformance));
router.get("/api/v1/organization/detail/report/monthly", handleOverLoad(generateMonthlySalesReport));
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
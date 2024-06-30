import { Router } from "express";
import * as organizationHandlers from "./handlers";

const router = Router();

router.get("/api/v1/organization", organizationHandlers.getOrganizations);
router.get("/api/v1/organization/basic", organizationHandlers.getOrganizationsBasic);
router.get("/api/v1/organization/contactperson", organizationHandlers.getOrganizationsContact);
router.get("/api/v1/organization/payment", organizationHandlers.getOrganizationsPayment);
router.delete("/api/v1/organization", organizationHandlers.deleteOrganization);
router.get("/api/v1/organizations/details", organizationHandlers.getOrganizationWithDetails);
router.post("/api/v1/new/organizations", organizationHandlers.createAOrganization);
router.put("/api/v1/organization/update/basic", organizationHandlers.updateOrganizationBasic);
router.put("/api/v1/organization/update/contact", organizationHandlers.updateOrganizationContact);
router.put("/api/v1/organization/update/payment", organizationHandlers.updateOrganizationPayment);
router.post("/api/v1/new/organization/images", organizationHandlers.upload);
router.get("/api/v1/organization/daily", organizationHandlers.dailyOrganizationCommission);
router.get("/api/v1/organization/monthly", organizationHandlers.getOrganizationCommissionByMonth);
router.get("/api/v1/organization/id", organizationHandlers.getOrganizationId);
router.get("/api/v1/organization/performance/top", organizationHandlers.getTopPerformance);
router.get("/api/v1/organization/detail/report/monthly", organizationHandlers.generateMonthlySalesReport);

export default router;

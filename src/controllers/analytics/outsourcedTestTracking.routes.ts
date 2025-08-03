import { Router } from "express";
import { OutsourcedTestTrackingController } from "./OutsourcedTestTrackingController";

const router = Router();

// GET /analytics/outsourced/profit-per-test?tenantId=1&outsourceid=123
router.get("/api/v1/outsourced/profit-per-test", OutsourcedTestTrackingController.getProfitPerTestByOutsource);

// GET /analytics/outsourced/profit-by-case?tenantId=1&outsourceid=123
router.get("/api/v1/outsourced/profit-by-case", OutsourcedTestTrackingController.getProfitByOutsourcedTest);

// GET /analytics/outsourced/cases?tenantId=1&page=1&count=10&sortby=DESC
router.get("/api/v1/outsourced/cases", OutsourcedTestTrackingController.getOursourcedCases);

// GET /analytics/outsourced/cases-profit?tenantId=1&outsourceid=123
router.get("/api/v1/outsourced/cases-profit", OutsourcedTestTrackingController.getOutsourcedCasesProfit);

export default router;

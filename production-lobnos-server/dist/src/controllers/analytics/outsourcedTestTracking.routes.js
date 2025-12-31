"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const OutsourcedTestTrackingController_1 = require("./OutsourcedTestTrackingController");
const router = (0, express_1.Router)();
// GET /analytics/outsourced/profit-per-test?tenantId=1&outsourceid=123
router.get("/api/v1/outsourced/profit-per-test", OutsourcedTestTrackingController_1.OutsourcedTestTrackingController.getProfitPerTestByOutsource);
// GET /analytics/outsourced/profit-by-case?tenantId=1&outsourceid=123
router.get("/api/v1/outsourced/profit-by-case", OutsourcedTestTrackingController_1.OutsourcedTestTrackingController.getProfitByOutsourcedTest);
// GET /analytics/outsourced/cases?tenantId=1&page=1&count=10&sortby=DESC
router.get("/api/v1/outsourced/cases", OutsourcedTestTrackingController_1.OutsourcedTestTrackingController.getOursourcedCases);
// GET /analytics/outsourced/cases-profit?tenantId=1&outsourceid=123
router.get("/api/v1/outsourced/cases-profit", OutsourcedTestTrackingController_1.OutsourcedTestTrackingController.getOutsourcedCasesProfit);
exports.default = router;

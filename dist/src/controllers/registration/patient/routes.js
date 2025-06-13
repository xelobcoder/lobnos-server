"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PatientAnalyticsController_1 = require("./PatientAnalyticsController");
const router = express_1.default.Router();
// Patient Analytics Routes
router.get('/api/v1/patient/individual/analytics', PatientAnalyticsController_1.getPatientAnalytics);
router.get('/api/v1/patient/individual/analytics/yearly', async (req, res) => {
    await (0, PatientAnalyticsController_1.getYearlyAnalytics)(req, res);
});
router.get('/api/v1/patient/individual/analytics/monthly', PatientAnalyticsController_1.getMonthlyAnalytics);
router.get('/api/v1/patient/individual/analytics/trends', PatientAnalyticsController_1.getTrendsAnalytics);
// Lifetime Transaction Summary Route
router.get('/api/v1/patient/individual/analytics/lifetime', PatientAnalyticsController_1.getLifetimeTransactionSummary);
exports.default = router;

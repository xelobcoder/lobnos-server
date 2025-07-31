"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const QCDashboardController_1 = require("./QCDashboardController");
const router = (0, express_1.Router)();
// GET /api/qc/dashboard
router.get("/dashboard", QCDashboardController_1.getQCDashboardData);
exports.default = router;

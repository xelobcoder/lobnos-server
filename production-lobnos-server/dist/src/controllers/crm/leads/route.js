"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leads_controller_1 = require("./leads.controller");
const leadsAnalytics_1 = __importDefault(require("../../analytics/leadsAnalytics"));
const router = (0, express_1.Router)();
router.post('/', leads_controller_1.createLead);
router.put('/:id', leads_controller_1.updateLead);
router.get('/analytics', leadsAnalytics_1.default.getLeadsAnalytics);
router.get('/', leads_controller_1.getAllLeads);
router.get('/:id', leads_controller_1.getLeadById);
router.delete('/:id', leads_controller_1.deleteLead);
exports.default = router;

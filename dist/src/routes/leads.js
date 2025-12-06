"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leads_controller_1 = require("../controllers/crm/leads/leads.controller");
const router = (0, express_1.Router)();
// POST /leads?tenantId=1 - Create a new lead
router.post('/', leads_controller_1.createLead);
// PUT /leads/:id?tenantId=1 - Update a lead by ID
router.put('/:id', leads_controller_1.updateLead);
// GET /leads?tenantId=1&page=1&count=10 - Get all leads with pagination
router.get('/', leads_controller_1.getAllLeads);
// GET /leads/:id?tenantId=1 - Get a lead by ID
router.get('/:id', leads_controller_1.getLeadById);
exports.default = router;

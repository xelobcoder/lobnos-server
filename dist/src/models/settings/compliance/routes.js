"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const IncidentController_1 = require("../../../controllers/compliance/IncidentController");
const router = (0, express_1.Router)();
const incidentController = new IncidentController_1.IncidentController();
// GET /api/compliance/incidents - Get paginated list of incidents
router.get('/incidents', (req, res) => incidentController.getIncidents(req, res));
// GET /api/compliance/incidents/:id - Get single incident
router.get('/incidents/:id', (req, res) => incidentController.getIncident(req, res));
// POST /api/compliance/incidents - Create new incident
router.post('/incidents', (req, res) => incidentController.createIncident(req, res));
// PUT /api/compliance/incidents/:id - Update incident
router.put('/incidents/:id', (req, res) => incidentController.updateIncident(req, res));
// DELETE /api/compliance/incidents/:id - Delete incident
router.delete('/incidents/:id', (req, res) => incidentController.deleteIncident(req, res));
exports.default = router;

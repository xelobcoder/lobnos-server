import { Router } from 'express';
import { IncidentController } from './IncidentController';

const router = Router();
const incidentController = new IncidentController();

router.get('/api/v1/compliance/incidents', (req, res) => incidentController.getIncidents(req, res));
router.get('/api/v1/compliance/incidents/:id', (req, res) => incidentController.getIncident(req, res));
router.post('/api/v1/compliance/incidents', (req, res) => incidentController.createIncident(req, res));
router.put('/api/v1/compliance/incidents/:id', (req, res) => incidentController.updateIncident(req, res));
router.delete('/api/v1/compliance/incidents/:id', (req, res) => incidentController.deleteIncident(req, res));

// Audit trail routes
router.get('/api/v1/compliance/incidents/:id/audit-trail', (req, res) => incidentController.getIncidentAuditTrail(req, res));
router.get('/api/v1/compliance/audit-trail', (req, res) => incidentController.getAllAuditTrails(req, res));

export default router;
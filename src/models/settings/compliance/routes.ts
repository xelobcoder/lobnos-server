import { Router } from 'express';
import { IncidentController } from '../../../controllers/compliance/IncidentController';

const router = Router();
const incidentController = new IncidentController();

router.get('/incidents', (req, res) => incidentController.getIncidents(req, res));

router.get('/incidents/:id', (req, res) => incidentController.getIncident(req, res));

router.post('/incidents', (req, res) => incidentController.createIncident(req, res));

router.put('/incidents/:id', (req, res) => incidentController.updateIncident(req, res));

router.delete('/incidents/:id', (req, res) => incidentController.deleteIncident(req, res));

export default router;
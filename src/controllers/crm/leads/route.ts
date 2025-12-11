import { Router } from 'express';
import { createLead, updateLead, getAllLeads, getLeadById, deleteLead } from './leads.controller';
import LeadsAnalyticsController from '../../analytics/leadsAnalytics';

const router = Router();

router.post('/', createLead);
router.put('/:id', updateLead);
router.get('/analytics', LeadsAnalyticsController.getLeadsAnalytics);
router.get('/', getAllLeads);
router.get('/:id', getLeadById);
router.delete('/:id', deleteLead);

export default router;
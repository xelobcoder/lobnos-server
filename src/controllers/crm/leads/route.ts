import { Router } from 'express';
import { createLead, updateLead, getAllLeads, getLeadById, deleteLead } from './leads.controller';

const router = Router();

router.post('/', createLead);
router.put('/:id', updateLead);
router.get('/', getAllLeads);
router.get('/:id', getLeadById);
router.delete('/:id', deleteLead);

export default router;
import { Router } from 'express';
import {
     createFollowUp,
     updateFollowUp,
     getAllFollowUps,
     getFollowUpById,
     getFollowUpsByLeadId,
     getFollowUpsByStatus,
     getPendingFollowUps,
     deleteFollowUp
} from './followups.controller';

const router = Router();

router.post('/', createFollowUp);
router.put('/:id', updateFollowUp);
router.get('/', getAllFollowUps);
router.get('/:id', getFollowUpById);
router.get('/lead/:leadId', getFollowUpsByLeadId);
router.get('/status/:status', getFollowUpsByStatus);
router.get('/pending/all', getPendingFollowUps);
router.delete('/:id', deleteFollowUp);

export default router;
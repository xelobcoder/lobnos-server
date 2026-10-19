import { Router } from 'express';
import {
     createEntityOrderHandler,
     listEntityOrdersHandler,
     getEntityOrderHandler,
     submitEntityOrderHandler,
     approveEntityOrderHandler,
     holdEntityOrderHandler,
     rejectEntityOrderHandler,
     reviseEntityOrderHandler,
     convertEntityOrderHandler,
     cancelEntityOrderHandler,
     linkEntityOrdersToConsultationHandler,
     summarizeEntityOrdersHandler,
} from './entityOrdersHandlers';
import { handleOverLoad } from '../../hooks/helper';

const router = Router();

// NOTE: the test catalogue / billing-strategy prices are served by the existing
// billing endpoint GET /api/v1/billing/testpanel/strategies/panels/:entityType/:associatedid
// (and has-strategy at /api/v1/billing/strategies/:entityType/:entityid/has-strategy).
// This module does NOT re-implement catalogue resolution.

// collection
router.get('/api/v1/entityorders', handleOverLoad(listEntityOrdersHandler));
router.post('/api/v1/entityorders', handleOverLoad(createEntityOrderHandler));
router.put('/api/v1/entityorders/link-consultation', handleOverLoad(linkEntityOrdersToConsultationHandler));
router.get('/api/v1/entityorders/summary', handleOverLoad(summarizeEntityOrdersHandler));

// item
router.get('/api/v1/entityorders/:id', handleOverLoad(getEntityOrderHandler));

// lifecycle
router.post('/api/v1/entityorders/:id/submit', handleOverLoad(submitEntityOrderHandler));
router.post('/api/v1/entityorders/:id/approve', handleOverLoad(approveEntityOrderHandler));
router.post('/api/v1/entityorders/:id/hold', handleOverLoad(holdEntityOrderHandler));
router.post('/api/v1/entityorders/:id/reject', handleOverLoad(rejectEntityOrderHandler));
router.post('/api/v1/entityorders/:id/revise', handleOverLoad(reviseEntityOrderHandler));
router.post('/api/v1/entityorders/:id/convert', handleOverLoad(convertEntityOrderHandler));
router.post('/api/v1/entityorders/:id/cancel', handleOverLoad(cancelEntityOrderHandler));

export default router;

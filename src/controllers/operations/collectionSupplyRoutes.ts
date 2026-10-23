import { Router } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { LabWorkbenchService } from '../../models/operations/LabWorkbenchService';

const router = Router();
router.use((req, res, next) => {
     const actor = getAuthUser(req);
     if (!actor) return res.status(401).json({ success: false, message: 'Authentication required' });
     if (Number(req.query.tenantId) !== Number(actor.tenantId) || !roleAllowed(actor.role, ['admin', 'manager', 'scientist', 'phelobotomist', 'phlebotomist'])) {
          return res.status(403).json({ success: false, message: 'Collection supply access denied' });
     }
     next();
});
const handle = (write: boolean) => async (req: any, res: any) => {
     try {
          const actor = getAuthUser(req)!;
          const service = new LabWorkbenchService(actor.tenantId);
          const id = Number(req.params.sampleId);
          if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid collection sample' });
          const data = write ? await service.consumeCollectionSupplies(actor, id, req.body) : await service.collectionSupplies(actor, id, String(req.query.search || ''));
          res.json({ success: true, data: { ...data, tenantId: actor.tenantId } });
     } catch (error: any) {
          const status = Number(error.statusCode) || 500;
          res.status(status).json({ success: false, statusCode: status, message: status < 500 ? error.message : 'Unable to record collection supplies' });
     }
};
router.get('/:sampleId', handle(false));
router.post('/:sampleId', handle(true));
export default router;

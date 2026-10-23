import { Router } from 'express';
import { requireLaboratoryWorkflowRole } from '../../middleware/laboratoryWorkflowAuthority';
import { getAuthUser } from '../../middleware/authority';
import { LabWorkbenchService } from '../../models/operations/LabWorkbenchService';

const router = Router();
router.use(requireLaboratoryWorkflowRole);
const handle = (operation: (service: LabWorkbenchService, actor: any, req: any) => Promise<any>) => async (req: any, res: any) => {
     try {
          const actor = getAuthUser(req)!;
          res.json({ success: true, data: await operation(new LabWorkbenchService(actor.tenantId), actor, req) });
     } catch (error: any) {
          const status = Number(error.statusCode) || 500;
          res.status(status).json({ success: false, message: status < 500 ? error.message : 'Laboratory operation failed' });
     }
};
router.get('/options', handle((service, actor) => service.options(actor)));
router.get('/', handle((service, actor, req) => service.list(actor, req.query)));
router.patch('/:id', handle((service, actor, req) => service.update(actor, Number(req.params.id), req.body)));
router.put('/tests/:testId/targets', handle((service, actor, req) => service.targets(actor, Number(req.params.testId), req.body)));
router.get('/:id/history', handle((service, actor, req) => service.history(actor, Number(req.params.id))));
router.get('/:id/consumption', handle((service, actor, req) => service.consumptionPlan(actor, Number(req.params.id), req.query.template_id ? Number(req.query.template_id) : undefined)));
router.post('/:id/consumption', handle((service, actor, req) => service.consume(actor, Number(req.params.id), req.body)));
export default router;

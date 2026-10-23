import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { PhysicalSampleController, requireSampleCollectionRole } from './PhysicalSampleController';
import { SpecimenLifecycleController } from './SpecimenLifecycleController';
import { CollectionPlanService } from '../../models/samples/CollectionPlanService';
import { getAuthUser } from '../../middleware/authority';

const router = Router();

router.use(checkTokenExists, requireSampleCollectionRole);
router.get('/collection-plan/options', async (req, res) => {
     try { const actor = getAuthUser(req)!; res.json({ success: true, data: { ...await new CollectionPlanService(actor.tenantId).options(), tenantId: actor.tenantId } }); }
     catch { res.status(500).json({ success: false, message: 'Unable to load specimen and container types' }); }
});
router.post('/collection-plan', async (req, res) => {
     try { const actor = getAuthUser(req)!; res.json({ success: true, data: await new CollectionPlanService(actor.tenantId).create(actor, req.body) }); }
     catch (error: any) { const status = error.code ? 500 : 409; res.status(status).json({ success: false, statusCode: status, message: status === 500 ? 'Unable to save collection plan. Retry the same plan.' : error.message || 'Unable to save collection plan' }); }
});
router.get('/lifecycle/worklist', SpecimenLifecycleController.worklist);
router.get('/storage/positions', SpecimenLifecycleController.positions);
router.post('/storage/positions', SpecimenLifecycleController.createPosition);
router.get('/:id/lifecycle', SpecimenLifecycleController.detail);
router.post('/:id/aliquots', SpecimenLifecycleController.aliquot);
router.post('/:id/storage', SpecimenLifecycleController.store);
router.post('/:id/retrieve', SpecimenLifecycleController.retrieve);
router.put('/:id/retention', SpecimenLifecycleController.retention);
router.post('/:id/dispose', SpecimenLifecycleController.dispose);
router.get('/worklists/samples', PhysicalSampleController.worklist);
router.get('/worklists/reviews', PhysicalSampleController.reviewWorklist);
router.get('/worklists/communications', PhysicalSampleController.communicationWorklist);
router.get('/worklists/samples/:id', PhysicalSampleController.auditDetail);
router.get('/candidates', PhysicalSampleController.candidates);
router.get('/barcode/:barcode', PhysicalSampleController.barcode);
router.get('/ascension/:ascensionId', PhysicalSampleController.byAscension);
router.post('/receive', PhysicalSampleController.receiveMany);
router.post('/', PhysicalSampleController.create);
router.get('/:id', PhysicalSampleController.detail);
router.patch('/:id/status', PhysicalSampleController.transition);
router.post('/:id/reviews', PhysicalSampleController.requestReview);
router.post('/:id/reviews/:reviewId/decision', PhysicalSampleController.decideReview);
router.get('/:id/communications', PhysicalSampleController.communications);
router.post('/:id/recollect', PhysicalSampleController.recollect);

export default router;

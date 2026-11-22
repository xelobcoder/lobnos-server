import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { PhysicalSampleController, requireSampleCollectionRole } from './PhysicalSampleController';
import { SpecimenLifecycleController } from './SpecimenLifecycleController';
import { CollectionPlanService } from '../../models/samples/CollectionPlanService';
import { getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import KnexConnection from '../../database/KnexConnections';
import { collectionCentersTable } from '../../models/samples/SampleCollectionCenters';

const router = Router();

router.use(checkTokenExists, requireSampleCollectionRole);
router.get('/collection-centers', async (req, res) => {
     const actor = getAuthUser(req)!;
     const canManage = Boolean(actor.branch && roleAllowed(actor.role, ['admin', 'manager']));
     try {
          if (!actor.branch) return res.json({ success: true, data: [], canManage });
          const db = await KnexConnection(actor.tenantId);
          const query = db(collectionCentersTable).where({ branch_id: actor.branch }).select('id', 'name', 'active').orderBy('name');
          if (!canManage) query.where({ active: true });
          return res.json({ success: true, data: await query, canManage });
     } catch {
          return res.status(500).json({ success: false, message: 'Unable to load collection centers' });
     }
});
router.post('/collection-centers', async (req, res) => {
     const actor = getAuthUser(req)!;
     if (!actor.branch || !roleAllowed(actor.role, ['admin', 'manager'])) {
          return res.status(403).json({ success: false, message: 'Only administrators and managers can configure collection centers for their branch' });
     }
     const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
     if (!name || name.length > 100) return res.status(400).json({ success: false, message: 'Enter a collection center name up to 100 characters' });
     try {
          const db = await KnexConnection(actor.tenantId);
          const [id] = await db(collectionCentersTable).insert({ branch_id: actor.branch, name });
          return res.status(201).json({ success: true, data: { id, name, active: true } });
     } catch (error: any) {
          if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'This branch already has a center with that name' });
          return res.status(500).json({ success: false, message: 'Unable to create collection center' });
     }
});
router.patch('/collection-centers/:id', async (req, res) => {
     const actor = getAuthUser(req)!;
     if (!actor.branch || !roleAllowed(actor.role, ['admin', 'manager'])) {
          return res.status(403).json({ success: false, message: 'Only administrators and managers can update their branch collection centers' });
     }
     const id = Number(req.params.id);
     const active = req.body?.active;
     if (!Number.isSafeInteger(id) || id < 1 || typeof active !== 'boolean') {
          return res.status(400).json({ success: false, message: 'Select a collection center and provide its active status' });
     }
     try {
          const db = await KnexConnection(actor.tenantId);
          const changed = await db(collectionCentersTable).where({ id, branch_id: actor.branch }).update({ active });
          if (!changed) return res.status(404).json({ success: false, message: 'Collection center was not found in your branch' });
          return res.json({ success: true });
     } catch {
          return res.status(500).json({ success: false, message: 'Unable to update collection center' });
     }
});
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
router.get('/consent-mode', PhysicalSampleController.collectionConsentMode);
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

import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { PhysicalSampleController, requireSampleCollectionRole } from './PhysicalSampleController';
import { SpecimenLifecycleController } from './SpecimenLifecycleController';

const router = Router();

router.use(checkTokenExists, requireSampleCollectionRole);
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

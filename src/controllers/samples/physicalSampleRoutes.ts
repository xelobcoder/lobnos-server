import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { PhysicalSampleController, requireSampleCollectionRole } from './PhysicalSampleController';

const router = Router();

router.use(checkTokenExists, requireSampleCollectionRole);
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

import { Router } from 'express';
import { checkTokenExists, isAuthorizedRoleScientistPhelobotomist } from '../../../middleware/validateTenancy';
import { HomeCollectionController } from './HomeCollectionController';

const router = Router();

router.use(checkTokenExists);

router.post('/api/v1/home-collection/areas', isAuthorizedRoleScientistPhelobotomist, HomeCollectionController.createArea);
router.get('/api/v1/home-collection/areas', HomeCollectionController.listAreas);
router.put('/api/v1/home-collection/areas/:id', isAuthorizedRoleScientistPhelobotomist, HomeCollectionController.updateArea);

router.post('/api/v1/home-collection/staff', isAuthorizedRoleScientistPhelobotomist, HomeCollectionController.createStaff);
router.get('/api/v1/home-collection/staff', HomeCollectionController.listStaff);
router.put('/api/v1/home-collection/staff/:id', isAuthorizedRoleScientistPhelobotomist, HomeCollectionController.updateStaff);

router.post('/api/v1/home-collection/orders', HomeCollectionController.createOrder);
router.post('/api/v1/home-collection/orders/from-billing', HomeCollectionController.createOrderFromBilling);
router.get('/api/v1/home-collection/orders', HomeCollectionController.listOrders);
router.get('/api/v1/home-collection/orders/:id', HomeCollectionController.getOrder);
router.put('/api/v1/home-collection/orders/:id/status', isAuthorizedRoleScientistPhelobotomist, HomeCollectionController.updateOrderStatus);
router.put('/api/v1/home-collection/orders/:id/assign', isAuthorizedRoleScientistPhelobotomist, HomeCollectionController.assignOrder);

router.get('/api/v1/home-collection/orders/:id/checklist', HomeCollectionController.getChecklist);
router.put('/api/v1/home-collection/checklist/:id', isAuthorizedRoleScientistPhelobotomist, HomeCollectionController.updateChecklistItem);

export default router;

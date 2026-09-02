import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { PharmacyCatalogueController } from './PharmacyCatalogueController';
import { PharmacyDashboardController } from './PharmacyDashboardController';
import { PharmacySaleController } from './PharmacySaleController';
import { pharmacyAccess, pharmacyReversalAccess } from './pharmacyAccess.middleware';

const router = Router();

router.use(checkTokenExists, pharmacyAccess);

router.get('/catalogue', PharmacyCatalogueController.getCatalogue);
router.get('/stock', PharmacyCatalogueController.getStock);
router.get('/dashboard', PharmacyDashboardController.getDashboard);

router.get('/sales-history', PharmacySaleController.getSalesHistory);
router.post('/sales', PharmacySaleController.completeSale);
router.get('/sales/:saleId', PharmacySaleController.getSaleDetail);
router.post('/sales/:saleId/reverse', pharmacyReversalAccess, PharmacySaleController.reverseSale);

export default router;
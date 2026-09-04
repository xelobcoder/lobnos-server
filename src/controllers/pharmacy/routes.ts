import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { PharmacyCatalogueController } from './PharmacyCatalogueController';
import { PharmacyDashboardController } from './PharmacyDashboardController';
import { PharmacySaleController } from './PharmacySaleController';
import { pharmacyAccess, pharmacyReversalAccess } from './pharmacyAccess.middleware';

const router = Router();

router.use(checkTokenExists);

// Read-only catalogue: needed by clinicians prescribing drugs during consultation
// (they are the ordering party, not pharmacy staff). Sales, stock and dispensing
// remain restricted to pharmacy roles below.
router.get('/catalogue', PharmacyCatalogueController.getCatalogue);

router.use(pharmacyAccess);

router.get('/stock', PharmacyCatalogueController.getStock);
router.get('/dashboard', PharmacyDashboardController.getDashboard);

router.get('/sales-history', PharmacySaleController.getSalesHistory);
router.get('/sales/reversals', PharmacySaleController.getReversedSales);
router.post('/sales', PharmacySaleController.completeSale);
router.get('/sales/:saleId', PharmacySaleController.getSaleDetail);
router.post('/sales/:saleId/reverse', pharmacyReversalAccess, PharmacySaleController.reverseSale);

export default router;
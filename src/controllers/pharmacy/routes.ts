import { Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { PharmacyCatalogueController } from './PharmacyCatalogueController';
import { PharmacyDashboardController } from './PharmacyDashboardController';
import { PharmacySaleController } from './PharmacySaleController';
import { pharmacyAccess, pharmacyReversalAccess, pharmacySalesAccess, pharmacyStockAccess, pharmacyFinanceAccess, pharmacyShiftAccess, pharmacyCatalogueAccess, pharmacyAdministratorAccess } from './pharmacyAccess.middleware';
import { pharmacyOperation as op } from './PharmacyManagementController';
import { PharmacyOperationsController } from './PharmacyOperationsController';

const router = Router();

router.use(checkTokenExists);

// Read-only catalogue: needed by clinicians prescribing drugs during consultation
// (they are the ordering party, not pharmacy staff). Sales, stock and dispensing
// remain restricted to pharmacy roles below.
router.get('/catalogue', pharmacyCatalogueAccess, PharmacyCatalogueController.getCatalogue);
router.use(pharmacyAccess);
router.get('/checkout-setup', op(s => s.setup()));
router.get('/management/setup', pharmacyReversalAccess, op(s => s.setup()));
router.post('/management/open-day', pharmacyFinanceAccess, op((s, r) => s.openDay(r.body)));
router.post('/management/reopen-day', pharmacyAdministratorAccess, op((s, r) => s.reopenDay(r.body)));
router.post('/management/destinations', pharmacyReversalAccess, op((s, r) => s.saveDestination(r.body)));
router.put('/management/payment-route', pharmacyReversalAccess, op((s, r) => s.saveRoute(r.body)));
router.get('/management/reports', pharmacyFinanceAccess, op(s => s.reports()));
router.get('/management/legacy-stock', pharmacyReversalAccess, op(s => s.legacyPreview()));
router.post('/management/import-stock', pharmacyReversalAccess, op((s, r) => s.importLegacy(r.body)));
router.post('/management/close-day', pharmacyFinanceAccess, op((s, r) => s.closeDay(r.body)));
router.post('/management/expenses', pharmacyFinanceAccess, op((s, r) => s.disburse('expense', r.body)));
router.post('/management/supplier-payments', pharmacyFinanceAccess, op((s, r) => s.disburse('supplier_payment', r.body)));
router.post('/management/journals', pharmacyFinanceAccess, op((s, r) => s.manualJournal(r.body)));
router.post('/management/reconcile', pharmacyFinanceAccess, op((s, r) => s.reconcileDestination(r.body)));
router.post('/management/shifts/:shiftId/review', pharmacyReversalAccess, op((s, r) => s.reviewShift(String(r.params.shiftId), r.body)));
router.post('/management/shifts/:shiftId/close', pharmacyReversalAccess, op((s, r) => s.closeManagedShift(String(r.params.shiftId), r.body)));
router.get('/suppliers', op(s => s.suppliers()));
router.post('/suppliers', pharmacyStockAccess, op((s, r) => s.createSupplier(r.body)));
router.post('/items', pharmacyStockAccess, op((s, r) => s.createItem(r.body)));
router.put('/items/:itemId', pharmacyReversalAccess, op((s, r) => s.updateItem(String(r.params.itemId), r.body)));
router.get('/items/:itemId/batches', pharmacyStockAccess, op((s, r) => s.batches(String(r.params.itemId))));
router.post('/items/:itemId/write-off', pharmacyReversalAccess, op((s, r) => s.writeOff(String(r.params.itemId), r.body)));
router.post('/items/:itemId/stock-up', pharmacyStockAccess, op((s, r) => s.receive(String(r.params.itemId), r.body)));
router.get('/orders', pharmacyStockAccess, op(s => s.orders()));
router.get('/receipts', pharmacyStockAccess, op((s, r) => s.receipts(r.query)));
router.post('/orders', pharmacyStockAccess, op((s, r) => s.createOrder(r.body)));
router.post('/orders/:orderId/cancel', pharmacyReversalAccess, op((s, r) => s.cancelOrder(String(r.params.orderId))));
router.post('/shifts/open', pharmacyShiftAccess, op((s, r) => s.openShift(r.body)));
router.post('/shifts/close', pharmacyShiftAccess, op((s, r) => s.closeShift(r.body)));
router.get('/collection-accounts', PharmacyOperationsController.collectionAccounts);
router.get('/cashier', PharmacyOperationsController.cashier);
router.post('/cashier/reconcile', PharmacyOperationsController.reconcile);
router.put('/catalogue/:itemId/profile', pharmacyReversalAccess, PharmacyOperationsController.updateItemProfile);
router.get('/stock', PharmacyCatalogueController.getStock);
router.get('/dashboard', PharmacyDashboardController.getDashboard);
router.get('/sales-history', PharmacySaleController.getSalesHistory);
router.get('/sales/reversals', PharmacySaleController.getReversedSales);
router.post('/sales/held', pharmacySalesAccess, PharmacySaleController.holdSale);
router.get('/sales/held', PharmacySaleController.getHeldSales);
router.get('/sales/held/:heldSaleId', PharmacySaleController.getHeldSale);
router.post('/sales/held/:heldSaleId/complete', pharmacySalesAccess, PharmacySaleController.completeHeldSale);
router.delete('/sales/held/:heldSaleId', PharmacySaleController.deleteHeldSale);
router.post('/sales', pharmacySalesAccess, PharmacySaleController.completeSale);
router.post('/sales/:saleId/reconcile-collection', pharmacyReversalAccess, PharmacyOperationsController.reconcileHistoricalCollection);
router.get('/sales/:saleId', PharmacySaleController.getSaleDetail);
router.post('/sales/:saleId/reverse', pharmacyReversalAccess, PharmacySaleController.reverseSale);

export default router;

import { Router } from 'express';
import brandRoutes from './brandRoutes';
import categoryRoutes from './categoryRoutes';
import supplierRoutes from './supplierRoutes';
import storageLocationRoutes from './storageLocationRoutes';
import inventoryItemRoutes from './inventoryItemRoutes';
import inventoryTemplateRoutes from './inventoryTemplateRoutes';
import purchaseOrderRoutes from './purchaseOrderRoutes';
import inventoryConsumptionRoutes from './inventoryConsumptionRoutes';
import inventoryStockRoutes from './inventoryStockRoutes';
import supplierPaymentRoutes from './supplierPaymentRoutes';
import journalRoutes from './journalRoutes';
import analyticsRoutes from './analyticsRoutes';


const router = Router();

// Mount all inventory routes
router.use('/', brandRoutes);
router.use('/', categoryRoutes);
router.use('/', supplierRoutes);
router.use('/', storageLocationRoutes);
router.use('/', inventoryItemRoutes);
router.use('/', inventoryTemplateRoutes);
router.use('/', purchaseOrderRoutes);
router.use('/transactions', inventoryConsumptionRoutes);
router.use('/transactions', inventoryStockRoutes);
router.use('/supplier-payments', supplierPaymentRoutes);
router.use('/', journalRoutes);
router.use('/', analyticsRoutes);


export default router;
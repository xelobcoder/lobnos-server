import { Router } from 'express';
import brandRoutes from './brandRoutes';
import categoryRoutes from './categoryRoutes';
import supplierRoutes from './supplierRoutes';
import storageLocationRoutes from './storageLocationRoutes';
import inventoryItemRoutes from './inventoryItemRoutes';
import purchaseOrderRoutes from './purchaseOrderRoutes';
import inventoryTransactionRoutes from './inventoryTransactionRoutes';
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
router.use('/', purchaseOrderRoutes);
router.use('/transactions', inventoryTransactionRoutes);
router.use('/supplier-payments', supplierPaymentRoutes);
router.use('/', journalRoutes);
router.use('/', analyticsRoutes);


export default router;
import { Router } from 'express';
import brandRoutes from './brandRoutes';
import categoryRoutes from './categoryRoutes';
import supplierRoutes from './supplierRoutes';
import storageLocationRoutes from './storageLocationRoutes';
import inventoryItemRoutes from './inventoryItemRoutes';
import purchaseOrderRoutes from './purchaseOrderRoutes';
import inventoryTransactionRoutes from './inventoryTransactionRoutes';


const router = Router();

// Mount all inventory routes
router.use('/', brandRoutes);
router.use('/', categoryRoutes);
router.use('/', supplierRoutes);
router.use('/', storageLocationRoutes);
router.use('/', inventoryItemRoutes);
router.use('/', purchaseOrderRoutes);
router.use('/transactions', inventoryTransactionRoutes);


export default router;
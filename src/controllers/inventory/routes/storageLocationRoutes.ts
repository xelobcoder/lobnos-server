import { Router } from 'express';
import { StorageLocationController } from '..';

const router = Router();
const storageLocationController = new StorageLocationController();

// Storage Location routes
router.post('/storage-locations', (req, res) => storageLocationController.createStorageLocation(req, res));
router.get('/storage-locations/:id', (req, res) => storageLocationController.getStorageLocationById(req, res));
router.get('/storage-locations', (req, res) => storageLocationController.getStorageLocations(req, res));
router.put('/storage-locations/:id', (req, res) => storageLocationController.updateStorageLocation(req, res));
router.delete('/storage-locations/:id', (req, res) => storageLocationController.deleteStorageLocation(req, res));

export default router;
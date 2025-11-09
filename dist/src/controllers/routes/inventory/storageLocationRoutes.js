"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_1 = require("../../inventory");
const router = (0, express_1.Router)();
const storageLocationController = new inventory_1.StorageLocationController();
// Storage Location routes
router.post('/storage-locations', (req, res) => storageLocationController.createStorageLocation(req, res));
router.get('/storage-locations/:id', (req, res) => storageLocationController.getStorageLocationById(req, res));
router.get('/storage-locations', (req, res) => storageLocationController.getStorageLocations(req, res));
router.put('/storage-locations/:id', (req, res) => storageLocationController.updateStorageLocation(req, res));
router.delete('/storage-locations/:id', (req, res) => storageLocationController.deleteStorageLocation(req, res));
exports.default = router;

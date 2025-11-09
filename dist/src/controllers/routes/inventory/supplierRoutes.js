"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_1 = require("../../inventory");
const router = (0, express_1.Router)();
const supplierController = new inventory_1.SupplierController();
// Supplier routes
router.post('/suppliers', (req, res) => supplierController.createSupplier(req, res));
router.get('/suppliers/:id', (req, res) => supplierController.getSupplierById(req, res));
router.get('/suppliers', (req, res) => supplierController.getSuppliers(req, res));
router.put('/suppliers/:id', (req, res) => supplierController.updateSupplier(req, res));
router.delete('/suppliers/:id', (req, res) => supplierController.deleteSupplier(req, res));
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_1 = require("../../inventory");
const router = (0, express_1.Router)();
const brandController = new inventory_1.BrandController();
// Brand routes
router.post('/brands', (req, res) => brandController.createBrand(req, res));
router.get('/brands/:id', (req, res) => brandController.getBrandById(req, res));
router.get('/brands', (req, res) => brandController.getBrands(req, res));
router.put('/brands/:id', (req, res) => brandController.updateBrand(req, res));
router.delete('/brands/:id', (req, res) => brandController.deleteBrand(req, res));
router.get('/brands-stats', (req, res) => brandController.getBrandStats(req, res));
exports.default = router;
